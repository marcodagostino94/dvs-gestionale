# DVS Gestionale v4.2 — Configurazione notifiche push

## File da usare

1. `sql/migrate_v4_2_push.sql`
2. `supabase/functions/send-expiry-notifications/index.ts`
3. `sql/configure_push_cron.sql`

La chiave pubblica VAPID è già inclusa nell'app:

`BH3-UsCmM4AuQHKdfZLCwRi5j-qM8HsfItLcr9eezb8dBSAZQz72yvzVaPI9bNOBXkjdqdZvnjDkRoNAPgb4L3o`

La chiave privata è fornita separatamente e non deve essere inserita su GitHub.

## Ordine corretto

### 1. Aggiornare il database

Supabase → SQL Editor → New query.

Eseguire tutto `sql/migrate_v4_2_push.sql`.

### 2. Pubblicare l'app v4.2

Sostituire i file nel repository Git, quindi Commit e Push.

### 3. Creare la Edge Function

Supabase → Edge Functions → Deploy a new function → Via Editor.

Nome:

`send-expiry-notifications`

Sostituire il codice con `supabase/functions/send-expiry-notifications/index.ts` e distribuire.

### 4. Inserire i secret della funzione

Supabase → Edge Functions → Secrets.

Aggiungere:

- `VAPID_PUBLIC_KEY` = la chiave pubblica riportata sopra
- `VAPID_PRIVATE_KEY` = la chiave privata del file separato
- `VAPID_SUBJECT` = `mailto:marco@digitalvideoservice.it`

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono normalmente già disponibili nell'ambiente delle Edge Functions.

### 5. Attivare le notifiche sui dispositivi

Nell'app:

Settings → Notifiche → Attiva notifiche.

Su iPhone/iPad l'app deve prima essere aggiunta alla schermata Home da Safari.

Ripetere l'attivazione separatamente su ogni Mac, iPhone e iPad.

### 6. Programmare l'invio giornaliero

Aprire `sql/configure_push_cron.sql`.

Sostituire `YOUR_SERVICE_ROLE_KEY` con la chiave `service_role` del progetto Supabase, eseguire la query e non salvare la chiave nel repository Git.

## Frequenza degli avvisi

- 10 giorni prima
- 5 giorni prima
- 3 giorni prima
- 1 giorno prima
- giorno della scadenza
- ogni giorno dopo la scadenza, finché la data non viene aggiornata

## Sicurezza

La chiave privata VAPID e la service_role key non devono essere pubblicate né inserite nel repository GitHub.
