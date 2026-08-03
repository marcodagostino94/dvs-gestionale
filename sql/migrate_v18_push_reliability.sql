-- DVS Workspace V18 — affidabilità Web Push ad app chiusa.
-- Eseguire una sola volta nel SQL Editor di Supabase.

alter table public.push_subscriptions
  add column if not exists app_url text;

comment on column public.push_subscriptions.app_url is
  'URL assoluto della PWA usato dal Web Push dichiarativo per apertura e consegna affidabile.';
