-- DVS Gestionale — Build 6
-- Eseguire una sola volta.

alter table public.computers
  add column if not exists dismissed_at timestamptz,
  add column if not exists dismissal_reason text,
  add column if not exists dismissal_note text;

alter table public.hardware
  add column if not exists dismissed_at timestamptz,
  add column if not exists dismissal_reason text,
  add column if not exists dismissal_note text;

alter table public.licenses
  add column if not exists dismissed_at timestamptz,
  add column if not exists dismissal_reason text,
  add column if not exists dismissal_note text;

alter table public.computers drop constraint if exists computers_code_key;
alter table public.hardware drop constraint if exists hardware_code_key;
alter table public.licenses drop constraint if exists licenses_code_key;

drop index if exists computers_code_active_unique;
create unique index computers_code_active_unique on public.computers (upper(code)) where archived_at is null;

drop index if exists hardware_code_active_unique;
create unique index hardware_code_active_unique on public.hardware (upper(code)) where archived_at is null;

drop index if exists licenses_code_active_unique;
create unique index licenses_code_active_unique on public.licenses (upper(code)) where archived_at is null;

alter table public.computers drop constraint if exists computers_mac17_forbidden;
alter table public.computers add constraint computers_mac17_forbidden
check (archived_at is not null or upper(regexp_replace(trim(code),'\s+','','g')) <> 'MAC17');
