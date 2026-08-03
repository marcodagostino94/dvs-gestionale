# DVS Workspace V18 — Configurazione notifiche push affidabili

## File da usare

1. `sql/migrate_v4_2_push.sql`
2. `supabase/functions/send-expiry-notifications/index.ts`
3. `sql/configure_push_cron.sql`
4. `sql/migrate_v18_push_reliability.sql`

La chiave pubblica VAPID è già inclusa nell'app:

`BLidTsO_r-SgpMHvPD0KC3jv39ZHLcdOfoTAR0IHDemM1dTQrLUM7WoUCA8FwfxXlCmA_KV4rnEXdBqlCXixNJc`

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

## Aggiornamento obbligatorio per la V18

Per un database già configurato:

1. eseguire una sola volta `sql/migrate_v18_push_reliability.sql`;
2. ridistribuire `supabase/functions/send-expiry-notifications/index.ts` nella Edge Function esistente;
3. rieseguire `sql/configure_push_cron.sql` per impostare correttamente le 09:00 Europe/Rome;
4. pubblicare la V18 dell’app;
5. aprire una volta la V18 su ciascun dispositivo con notifiche attive, così viene registrato l’URL necessario al Web Push dichiarativo;
6. in Settings → Notifiche premere `Prova dal server`.

La prova V18 non è una notifica locale: chiama la stessa Edge Function utilizzata dal cron. Se arriva, sottoscrizione, chiavi VAPID, server e consegna Web Push sono operativi.

Il nuovo formato Declarative Web Push consente ai dispositivi Apple compatibili di mostrare l’avviso direttamente dal messaggio ricevuto, senza dipendere dall’esecuzione JavaScript dell’app o del Service Worker. I browser precedenti continuano a usare il Service Worker.

## Frequenza degli avvisi

- 10 giorni prima
- 5 giorni prima
- 3 giorni prima
- 1 giorno prima
- giorno della scadenza
- ogni giorno dopo la scadenza, finché la data non viene aggiornata

## Sicurezza

La chiave privata VAPID e la service_role key non devono essere pubblicate né inserite nel repository GitHub.


## Correzione v4.2.1

Nuova chiave pubblica VAPID:

`BLidTsO_r-SgpMHvPD0KC3jv39ZHLcdOfoTAR0IHDemM1dTQrLUM7WoUCA8FwfxXlCmA_KV4rnEXdBqlCXixNJc`

Aggiornare i secret `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`, quindi eseguire
`Deploy updates` sulla Edge Function.

Dopo aver pubblicato l'app v4.2.1, aprire Settings → Notifiche e premere
`Aggiorna notifiche` sui dispositivi già registrati.
