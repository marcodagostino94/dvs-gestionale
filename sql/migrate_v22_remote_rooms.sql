-- V22: eseguire una volta prima di pubblicare la nuova applicazione.
-- Ripetibile: non modifica lo stato delle remote già configurate.
begin;
alter table public.rooms add column if not exists remote_index integer;
alter table public.rooms add column if not exists is_active boolean not null default true;
create unique index if not exists rooms_remote_index_unique on public.rooms(remote_index);
alter table public.rooms drop constraint if exists rooms_remote_index_check;
alter table public.rooms add constraint rooms_remote_index_check
  check (remote_index is null or remote_index between 1 and 5);

insert into public.rooms(name,position,remote_index,is_active)
select 'Remoto '||n,15+n,n,false from generate_series(1,5) n
on conflict (remote_index) do nothing;
insert into public.stations(room_id,position)
select id,1 from public.rooms where remote_index is not null
on conflict(room_id,position) do nothing;

-- Controllo sul server: protegge anche finestre rimaste aperte su altri Mac.
create or replace function public.dvs_check_active_room()
returns trigger language plpgsql security invoker set search_path=public as $$
declare target_room uuid; enabled boolean;
begin
  if tg_table_name='stations' then
    if new.computer_id is null and new.hardware_id is null
      and new.avid_license_id is null and coalesce(new.avid_trial_status,'none')='none' then
      return new;
    end if;
    target_room:=new.room_id;
  else
    select room_id into target_room from stations where id=new.station_id;
  end if;
  select (remote_index is null or is_active) into enabled
    from rooms where id=target_room for share;
  if enabled is distinct from true then
    raise exception 'Sala remota disattivata. Aggiorna e scegli una sala attiva.';
  end if;
  return new;
end $$;
drop trigger if exists dvs_active_station_room on public.stations;
create trigger dvs_active_station_room before insert or update on public.stations
for each row execute function public.dvs_check_active_room();
drop trigger if exists dvs_active_plugin_room on public.station_plugins;
create trigger dvs_active_plugin_room before insert or update on public.station_plugins
for each row execute function public.dvs_check_active_room();

create or replace function public.set_remote_room_active(p_room_id uuid,p_active boolean,p_release boolean default false)
returns void language plpgsql security invoker set search_path=public as $$
declare r rooms%rowtype; occupied boolean;
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  if p_active is null then raise exception 'Stato non valido'; end if;
  select * into r from rooms where id=p_room_id for update;
  if not found or r.remote_index is null then raise exception 'Sala remota non valida'; end if;
  if r.is_active=p_active then return; end if;
  if not p_active then
    perform id from stations where room_id=r.id for update;
    select exists(select 1 from stations s where s.room_id=r.id and
      (s.computer_id is not null or s.hardware_id is not null or s.avid_license_id is not null
       or s.avid_trial_status<>'none' or exists(select 1 from station_plugins p where p.station_id=s.id))) into occupied;
    if occupied and not p_release then
      raise exception 'La sala contiene assegnazioni: conferma la disattivazione e la liberazione degli elementi.';
    end if;
    delete from station_plugins where station_id in(select id from stations where room_id=r.id);
    update stations set computer_id=null,hardware_id=null,avid_license_id=null,
      avid_trial_status='none',avid_trial_expiry=null where room_id=r.id;
  end if;
  update rooms set is_active=p_active where id=r.id;
  insert into audit_log(action,entity_type,entity_id,details)
    values(case when p_active then 'activate_remote' else 'deactivate_remote' end,
      'rooms',r.id,jsonb_build_object('room',r.name,'released',not p_active));
end $$;
revoke all on function public.set_remote_room_active(uuid,boolean,boolean) from public;
grant execute on function public.set_remote_room_active(uuid,boolean,boolean) to authenticated;
commit;
