-- DVS Gestionale v4.3.1 — Trial Avid
-- Se hai già eseguito la precedente migrazione Trial, NON eseguire nuovamente questo file.

alter table public.stations
  add column if not exists avid_trial_status text not null default 'none',
  add column if not exists avid_trial_expiry date;

alter table public.stations
  drop constraint if exists stations_avid_trial_status_check;

alter table public.stations
  add constraint stations_avid_trial_status_check
  check (avid_trial_status in ('none','pending','active'));

update public.stations
set avid_trial_status='none',
    avid_trial_expiry=null
where avid_license_id is not null;
