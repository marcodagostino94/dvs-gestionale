-- DVS Gestionale v4.1
-- Eseguire una sola volta nel SQL Editor di Supabase.

alter table public.rooms
  add column if not exists client_type text not null default '',
  add column if not exists production_name text not null default '';

-- Le policy RLS già presenti sulla tabella rooms continuano a proteggere i nuovi campi.
