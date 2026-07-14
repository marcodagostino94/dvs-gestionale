-- DVS Gestionale v4.3.1 — Gestione Trial Avid
-- Eseguire una sola volta nel SQL Editor di Supabase.

alter table public.stations
  add column if not exists avid_trial_status text not null default 'none',
  add column if not exists avid_trial_expiry date;

alter table public.stations
  drop constraint if exists stations_avid_trial_status_check;

alter table public.stations
  add constraint stations_avid_trial_status_check
  check (avid_trial_status in ('none','pending','active'));

-- Coerenza iniziale: una postazione con licenza Avid reale non deve risultare Trial.
update public.stations
set avid_trial_status='none',
    avid_trial_expiry=null
where avid_license_id is not null;


create table if not exists public.trial_notification_deliveries (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete cascade,
  event_key text not null,
  sent_at timestamptz not null default now(),
  unique(subscription_id,station_id,event_key)
);

alter table public.trial_notification_deliveries enable row level security;
