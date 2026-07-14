-- DVS Gestionale v4.4 Experimental Build 3
-- Consente di eliminare completamente la produzione da una Sala.
-- Eseguire una sola volta nel SQL Editor di Supabase.

alter table public.rooms
  alter column client_type drop not null,
  alter column production_name drop not null;
