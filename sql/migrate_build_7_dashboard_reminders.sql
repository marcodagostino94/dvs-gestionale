-- DVS Gestionale — Build 7
-- Promemoria persistenti della Dashboard.
-- Eseguire una sola volta nel SQL Editor di Supabase.

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  text text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reminders enable row level security;

drop policy if exists authenticated_all on public.reminders;
create policy authenticated_all
  on public.reminders
  for all
  to authenticated
  using (true)
  with check (true);
