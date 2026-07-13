-- DVS Gestionale — Pulizia dati di prova
-- ATTENZIONE: operazione irreversibile.
-- Eseguire soltanto quando si desidera eliminare tutti i test
-- prima dell'importazione dei dati ufficiali.

begin;

-- Elimina relazioni e postazioni di prova.
delete from public.station_plugins;
delete from public.stations;

-- Elimina tutti gli elementi operativi, inclusi quelli archiviati.
delete from public.computers;
delete from public.hardware;
delete from public.licenses;

-- Elimina lo storico delle operazioni di prova.
truncate table public.audit_log restart identity;

-- Mantiene le 15 sale ma azzera produzione e note di test.
update public.rooms
set client_type='',
    production_name='',
    notes='';

-- Ricrea una postazione vuota per ciascuna sala.
insert into public.stations(room_id,position)
select id,1
from public.rooms
order by position;

commit;

-- Non vengono eliminati:
-- - utenti Supabase e credenziali di accesso;
-- - tabelle, policy RLS, funzioni e struttura del database;
-- - le 15 sale.
