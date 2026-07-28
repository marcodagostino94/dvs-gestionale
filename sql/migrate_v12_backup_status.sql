-- DVS Workspace V12 — stato backup condiviso.
-- Eseguire una sola volta nel SQL Editor di Supabase prima di usare il backup V12.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.app_settings enable row level security;
drop policy if exists authenticated_all on public.app_settings;
create policy authenticated_all on public.app_settings
  for all to authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.app_settings;
exception
  when duplicate_object then null;
end $$;
