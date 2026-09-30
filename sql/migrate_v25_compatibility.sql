-- DVS Workspace V25: eseguire una volta nel SQL Editor di Supabase.
begin;
create table if not exists public.compatibility_entries (
 id text primary key,
 os_key text not null check (os_key in ('monterey','ventura','sonoma','sequoia','tahoe')),
 software_key text not null check (software_key in ('avid','blackmagic','server','adobe','davinci','office')),
 notes text not null default '' check (char_length(notes)<=10000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(os_key,software_key),
 check(id=os_key||':'||software_key)
);
insert into public.compatibility_entries(id,os_key,software_key)
 select o||':'||s,o,s from unnest(array['monterey','ventura','sonoma','sequoia','tahoe']) as o
 cross join unnest(array['avid','blackmagic','server','adobe','davinci','office']) as s
 on conflict(id) do nothing;
create or replace function public.touch_compatibility_entry()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=clock_timestamp();return new;end $$;
drop trigger if exists compatibility_entry_updated on public.compatibility_entries;
create trigger compatibility_entry_updated before update on public.compatibility_entries
 for each row execute function public.touch_compatibility_entry();
alter table public.compatibility_entries enable row level security;
revoke all on public.compatibility_entries from anon;
grant select,insert,update on public.compatibility_entries to authenticated;
drop policy if exists compatibility_read on public.compatibility_entries;
create policy compatibility_read on public.compatibility_entries for select to authenticated using(true);
drop policy if exists compatibility_update on public.compatibility_entries;
create policy compatibility_update on public.compatibility_entries for update to authenticated using(true) with check(true);
drop policy if exists compatibility_insert on public.compatibility_entries;
create policy compatibility_insert on public.compatibility_entries for insert to authenticated with check(true);
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
 select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='compatibility_entries') then
 alter publication supabase_realtime add table public.compatibility_entries;
 end if;
end $$;
commit;
