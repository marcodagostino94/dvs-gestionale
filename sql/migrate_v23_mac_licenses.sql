-- V23: eseguire dopo la migrazione V22. Tutte le modifiche sono atomiche.
begin;
lock table public.computers,public.licenses,public.rooms,public.stations,public.station_plugins in share row exclusive mode;
do $$
declare problems text;
begin
 select string_agg(r.name||' / postazione '||s.position,', ') into problems
 from public.stations s join public.rooms r on r.id=s.room_id
 where s.computer_id is null and (s.avid_license_id is not null or s.avid_trial_status<>'none'
 or exists(select 1 from public.station_plugins p where p.station_id=s.id));
 if problems is not null then raise exception 'Prima della V23 assegna un Mac oppure rimuovi licenze/Trial da: %',problems; end if;
end $$;
alter table public.licenses add column if not exists computer_id uuid references public.computers(id) on delete set null;
alter table public.computers add column if not exists avid_trial_status text not null default 'none';
alter table public.computers add column if not exists avid_trial_expiry date;
alter table public.computers drop constraint if exists computers_trial_status_check;
alter table public.computers add constraint computers_trial_status_check check(avid_trial_status in ('none','pending','active'));
update public.licenses l set computer_id=s.computer_id from public.stations s
 where s.avid_license_id=l.id and l.computer_id is null;
update public.licenses l set computer_id=s.computer_id from public.station_plugins p join public.stations s on s.id=p.station_id
 where p.license_id=l.id and l.computer_id is null;
update public.computers c set avid_trial_status=s.avid_trial_status,avid_trial_expiry=s.avid_trial_expiry
 from public.stations s where s.computer_id=c.id and c.avid_trial_status='none' and s.avid_trial_status<>'none';
create unique index if not exists licenses_one_avid_per_mac on public.licenses(computer_id)
 where category='avid' and computer_id is not null and archived_at is null;

create or replace function public.dvs_check_active_room()
returns trigger language plpgsql security invoker set search_path=public as $$
declare target_room uuid; target_mac uuid; enabled boolean;
begin
 if tg_table_name='stations' then
   if new.computer_id is null and (new.avid_license_id is not null or new.avid_trial_status<>'none') then
     raise exception 'Assegna prima un Mac alla postazione';
   end if;
   if new.computer_id is null and new.hardware_id is null and new.avid_license_id is null and new.avid_trial_status='none' then return new; end if;
   target_room:=new.room_id;
 else
   select room_id,computer_id into target_room,target_mac from stations where id=new.station_id;
   if target_mac is null then raise exception 'Assegna prima un Mac alla postazione'; end if;
 end if;
 select (remote_index is null or is_active) into enabled from rooms where id=target_room for share;
 if enabled is distinct from true then raise exception 'Sala remota disattivata'; end if;
 return new;
end $$;

-- La postazione è una proiezione della posizione del Mac: i legami restano
-- validi anche quando il computer non è in una sala.
create or replace function public.dvs_sync_mac_licenses()
returns void language plpgsql security invoker set search_path=public as $$
begin
 update stations set avid_license_id=null where avid_license_id is not null;
 update stations s set avid_license_id=(select l.id from licenses l where l.computer_id=s.computer_id and l.category='avid' and l.archived_at is null),
 avid_trial_status=coalesce((select c.avid_trial_status from computers c where c.id=s.computer_id),'none'),
 avid_trial_expiry=(select c.avid_trial_expiry from computers c where c.id=s.computer_id);
 delete from station_plugins p where not exists(select 1 from stations s join licenses l on l.computer_id=s.computer_id
 where s.id=p.station_id and l.id=p.license_id and l.category='plugin' and l.archived_at is null);
 insert into station_plugins(station_id,license_id)
 select s.id,l.id from stations s join licenses l on l.computer_id=s.computer_id
 where l.category='plugin' and l.archived_at is null on conflict(license_id) do nothing;
end $$;

create or replace function public.assign_license_mac(p_license_id uuid,p_computer_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare l licenses%rowtype;
begin
 if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
 perform pg_advisory_xact_lock(230023);
 select * into l from licenses where id=p_license_id for update;
 if not found or l.archived_at is not null then raise exception 'Licenza non disponibile'; end if;
 if p_computer_id is not null and not exists(select 1 from computers where id=p_computer_id and archived_at is null) then raise exception 'Computer non disponibile'; end if;
 if p_computer_id is not null and l.category='avid' then
   update licenses set computer_id=null where computer_id=p_computer_id and category='avid' and id<>l.id;
   update computers set avid_trial_status='none',avid_trial_expiry=null where id=p_computer_id;
 end if;
 update licenses set computer_id=p_computer_id where id=l.id;
 perform dvs_sync_mac_licenses();
end $$;

create or replace function public.set_mac_trial(p_computer_id uuid,p_status text,p_expiry date default null)
returns void language plpgsql security invoker set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
 perform pg_advisory_xact_lock(230023);
 if not exists(select 1 from computers where id=p_computer_id and archived_at is null) then raise exception 'Assegna prima un Mac alla postazione'; end if;
 if p_status is null or p_status not in ('none','pending','active') then raise exception 'Stato Trial non valido'; end if;
 if p_status='active' and p_expiry is null then raise exception 'Inserisci la scadenza della Trial'; end if;
 if p_status<>'none' then update licenses set computer_id=null where computer_id=p_computer_id and category='avid'; end if;
 update computers set avid_trial_status=p_status,avid_trial_expiry=case when p_status='active' then p_expiry else null end where id=p_computer_id;
 perform dvs_sync_mac_licenses();
end $$;

create or replace function public.assign_resource(p_kind text,p_resource_id uuid,p_station_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare mac uuid; current_license uuid;
begin
 if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
 perform pg_advisory_xact_lock(230023);
 if p_station_id is not null and not exists(select 1 from stations s join rooms r on r.id=s.room_id
 where s.id=p_station_id and (r.remote_index is null or r.is_active)) then raise exception 'Postazione non disponibile'; end if;
 if p_kind='computer' then
   if p_resource_id is not null and not exists(select 1 from computers where id=p_resource_id and archived_at is null) then raise exception 'Computer non disponibile'; end if;
   if p_resource_id is not null then update stations set computer_id=null,avid_license_id=null,avid_trial_status='none',avid_trial_expiry=null where computer_id=p_resource_id; end if;
   if p_station_id is not null then update stations set computer_id=p_resource_id,avid_license_id=null,avid_trial_status='none',avid_trial_expiry=null where id=p_station_id; end if;
   perform dvs_sync_mac_licenses();
 elsif p_kind='hardware' then
   if p_resource_id is not null then update stations set hardware_id=null where hardware_id=p_resource_id; end if;
   if p_station_id is not null then update stations set hardware_id=p_resource_id where id=p_station_id; end if;
 elsif p_kind='license' then
   if p_resource_id is not null and not exists(select 1 from licenses where id=p_resource_id and category='avid') then raise exception 'La licenza non è Avid'; end if;
   if p_station_id is not null then
     select computer_id,avid_license_id into mac,current_license from stations where id=p_station_id;
     if p_resource_id is not null and mac is null then raise exception 'Assegna prima un Mac alla postazione'; end if;
     if p_resource_id is null then
       if mac is not null then
         update licenses set computer_id=null where computer_id=mac and category='avid';
         perform set_mac_trial(mac,'none',null);
       end if;
     else perform assign_license_mac(p_resource_id,mac);
     end if;
   elsif p_resource_id is not null then perform assign_license_mac(p_resource_id,null);
   end if;
 else raise exception 'Tipo risorsa non valido'; end if;
end $$;

create or replace function public.assign_plugin(p_license_id uuid,p_station_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare mac uuid;
begin
 if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
 perform pg_advisory_xact_lock(230023);
 if not exists(select 1 from licenses where id=p_license_id and category='plugin') then raise exception 'La licenza non è un plugin'; end if;
 if p_station_id is not null then
   select s.computer_id into mac from stations s join rooms r on r.id=s.room_id
     where s.id=p_station_id and (r.remote_index is null or r.is_active);
   if mac is null then raise exception 'Assegna prima un Mac a una postazione attiva'; end if;
 end if;
 perform assign_license_mac(p_license_id,mac);
end $$;

create or replace function public.set_remote_room_active(p_room_id uuid,p_active boolean,p_release boolean default false)
returns void language plpgsql security invoker set search_path=public as $$
declare r rooms%rowtype;
begin
 if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
 perform pg_advisory_xact_lock(230023);
 select * into r from rooms where id=p_room_id for update;
 if not found or r.remote_index is null or p_active is null then raise exception 'Sala remota non valida'; end if;
 if r.is_active=p_active then return; end if;
 if not p_active then
   if not p_release and exists(select 1 from stations where room_id=r.id and (computer_id is not null or hardware_id is not null)) then raise exception 'Conferma la disattivazione'; end if;
   update stations set computer_id=null,hardware_id=null,avid_license_id=null,avid_trial_status='none',avid_trial_expiry=null where room_id=r.id;
   perform dvs_sync_mac_licenses();
 end if;
 update rooms set is_active=p_active where id=r.id;
 insert into audit_log(action,entity_type,entity_id,details) values(case when p_active then 'activate_remote' else 'deactivate_remote' end,'rooms',r.id,jsonb_build_object('room',r.name,'mac_links_preserved',true));
end $$;

-- Dismissione: libera i legami, senza lasciare licenze su Mac archiviati.
create or replace function public.dvs_mac_archive_links()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.archived_at is not null and old.archived_at is null then
   if tg_table_name='computers' then
     update licenses set computer_id=null where computer_id=new.id;
     new.avid_trial_status='none'; new.avid_trial_expiry=null;
   else new.computer_id=null;
   end if;
 end if;
 return new;
end $$;
drop trigger if exists dvs_mac_archive_links on public.computers;
create trigger dvs_mac_archive_links before update on public.computers for each row execute function public.dvs_mac_archive_links();
drop trigger if exists dvs_license_archive_links on public.licenses;
create trigger dvs_license_archive_links before update on public.licenses for each row execute function public.dvs_mac_archive_links();

-- Salvataggio del modulo licenza e collegamento al Mac nella stessa transazione.
create or replace function public.save_license_mac(p_payload jsonb,p_computer_id uuid)
returns public.licenses language plpgsql security invoker set search_path=public as $$
declare v licenses%rowtype; result licenses%rowtype;
begin
 if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
 perform pg_advisory_xact_lock(230023);
 v:=jsonb_populate_record(null::licenses,p_payload);
 if exists(select 1 from licenses where id=v.id and archived_at is not null) then raise exception 'Licenza archiviata'; end if;
 update licenses set computer_id=null where id=v.id;
 insert into licenses(id,code,category,avid_type,plugin_type,system_id,activation_code,plugin_serial,version,billing_cycle,is_trial,activation_date,expiry_date,deactivation_requested,notes,attachments_count)
 values(v.id,v.code,v.category,v.avid_type,v.plugin_type,v.system_id,v.activation_code,v.plugin_serial,v.version,v.billing_cycle,false,v.activation_date,v.expiry_date,coalesce(v.deactivation_requested,false),coalesce(v.notes,''),coalesce(v.attachments_count,0))
 on conflict(id) do update set code=excluded.code,category=excluded.category,avid_type=excluded.avid_type,
 plugin_type=excluded.plugin_type,system_id=excluded.system_id,activation_code=excluded.activation_code,
 plugin_serial=excluded.plugin_serial,version=excluded.version,billing_cycle=excluded.billing_cycle,is_trial=false,
 activation_date=excluded.activation_date,expiry_date=excluded.expiry_date,deactivation_requested=excluded.deactivation_requested,
 notes=excluded.notes,attachments_count=excluded.attachments_count;
 perform assign_license_mac(v.id,p_computer_id);
 select * into result from licenses where id=v.id;
 return result;
end $$;
revoke all on function public.save_license_mac(jsonb,uuid) from public;
grant execute on function public.save_license_mac(jsonb,uuid) to authenticated;
select public.dvs_sync_mac_licenses();
revoke all on function public.dvs_sync_mac_licenses() from public;
grant execute on function public.dvs_sync_mac_licenses() to authenticated;
revoke all on function public.assign_license_mac(uuid,uuid),public.set_mac_trial(uuid,text,date) from public;
grant execute on function public.assign_license_mac(uuid,uuid),public.set_mac_trial(uuid,text,date) to authenticated;
notify pgrst,'reload schema';
commit;
