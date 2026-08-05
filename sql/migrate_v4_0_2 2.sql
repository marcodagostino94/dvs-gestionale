-- DVS Gestionale v4.0.2
-- Eseguire una sola volta nel SQL Editor di Supabase.

alter table public.licenses
  add column if not exists is_trial boolean not null default false;

-- RLS resta invariata: la tabella licenses è già protetta dalle policy della v4.0.
