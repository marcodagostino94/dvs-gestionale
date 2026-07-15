-- DVS Gestionale — Build 5
-- Aggiunge la Configurazione Server alle Sale.
-- Eseguire una sola volta nel SQL Editor di Supabase.

alter table public.rooms
  add column if not exists server_config text;
