-- DVS Gestionale v4.0 — eseguire una volta nel SQL Editor di Supabase.
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position integer not null default 1,
  client_type text not null default '',
  production_name text not null default '',
  server_config text,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.computers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  model text not null default '', variant text not null default '', cpu text not null default '',
  ram text not null default '', gpu text not null default '', storage text not null default '',
  serial text not null default '', os_name text not null default '', os_version text not null default '',
  formatted_at date, notes text not null default '', attachments_count integer not null default 0,
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.hardware (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  category text not null default '', model text not null default '', serial text not null default '',
  driver_version text not null default '', notes text not null default '', attachments_count integer not null default 0,
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  category text not null check (category in ('avid','plugin')),
  avid_type text check (avid_type in ('Singolo','Ultimate')),
  plugin_type text check (plugin_type in ('Continuum','Sapphire')),
  system_id text, activation_code text, plugin_serial text, version text,
  billing_cycle text not null default 'annual' check (billing_cycle in ('monthly','annual')),
  is_trial boolean not null default false,
  activation_date date, expiry_date date, deactivation_requested boolean not null default false,
  notes text not null default '', attachments_count integer not null default 0,
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint license_kind_fields check (
    (category='avid' and avid_type is not null and plugin_type is null) or
    (category='plugin' and plugin_type is not null and avid_type is null)
  )
);

create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
  position integer not null default 1,
  computer_id uuid unique references public.computers(id) on delete set null,
  hardware_id uuid unique references public.hardware(id) on delete set null,
  avid_license_id uuid unique references public.licenses(id) on delete set null,
  notes text not null default '', created_at timestamptz not null default now(),
  unique(room_id,position)
);

create table if not exists public.station_plugins (
  station_id uuid not null references public.stations(id) on delete cascade,
  license_id uuid primary key references public.licenses(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  text text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(), action text not null, entity_type text not null,
  entity_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

-- 15 sale iniziali, senza dati reali.
insert into public.rooms(name,position)
select 'Sala '||n,n from generate_series(1,15) n
on conflict(name) do nothing;
insert into public.stations(room_id,position)
select r.id,1 from public.rooms r
where not exists(select 1 from public.stations s where s.room_id=r.id and s.position=1);

-- RLS: l'app è leggibile/scrivibile soltanto dagli utenti autenticati.
do $$ declare t text; begin
  foreach t in array array['rooms','computers','hardware','licenses','stations','station_plugins','reminders','audit_log'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists authenticated_all on public.%I',t);
    execute format('create policy authenticated_all on public.%I for all to authenticated using (true) with check (true)',t);
  end loop;
end $$;

-- Assegnazione con sostituzione automatica: l'elemento precedente torna non assegnato.
create or replace function public.assign_resource(p_kind text,p_resource_id uuid,p_station_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if p_kind='computer' then
    if p_resource_id is not null then update stations set computer_id=null where computer_id=p_resource_id; end if;
    if p_station_id is not null then update stations set computer_id=p_resource_id where id=p_station_id; end if;
  elsif p_kind='hardware' then
    if p_resource_id is not null then update stations set hardware_id=null where hardware_id=p_resource_id; end if;
    if p_station_id is not null then update stations set hardware_id=p_resource_id where id=p_station_id; end if;
  elsif p_kind='license' then
    if p_resource_id is not null then
      if not exists(select 1 from licenses where id=p_resource_id and category='avid') then raise exception 'La licenza non è Avid'; end if;
      update stations set avid_license_id=null where avid_license_id=p_resource_id;
    end if;
    if p_station_id is not null then update stations set avid_license_id=p_resource_id where id=p_station_id; end if;
  else raise exception 'Tipo risorsa non valido'; end if;
end $$;

grant execute on function public.assign_resource(text,uuid,uuid) to authenticated;

create or replace function public.assign_plugin(p_license_id uuid,p_station_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if not exists(select 1 from licenses where id=p_license_id and category='plugin') then raise exception 'La licenza non è un plugin'; end if;
  delete from station_plugins where license_id=p_license_id;
  if p_station_id is not null then insert into station_plugins(station_id,license_id) values(p_station_id,p_license_id); end if;
end $$;
grant execute on function public.assign_plugin(uuid,uuid) to authenticated;

-- updated_at automatico.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
do $$ declare t text; begin foreach t in array array['computers','hardware','licenses'] loop
  execute format('drop trigger if exists trg_touch_updated_at on public.%I',t);
  execute format('create trigger trg_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
end loop; end $$;
