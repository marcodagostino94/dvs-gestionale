-- DVS Gestionale V 8
-- Abilita Supabase Realtime sulle tabelle operative.
-- Eseguire una sola volta nel SQL Editor di Supabase.
--
-- Lo script è idempotente: controlla ogni tabella prima di aggiungerla
-- alla publication supabase_realtime.

do $$
declare
  table_name text;
  realtime_tables text[] := array[
    'rooms',
    'stations',
    'computers',
    'hardware',
    'licenses',
    'station_plugins',
    'reminders',
    'audit_log'
  ];
begin
  foreach table_name in array realtime_tables loop
    if to_regclass(format('public.%I', table_name)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = table_name
       ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end
$$;
