-- DVS Gestionale v4.2 — Web Push
-- Eseguire una sola volta nel SQL Editor di Supabase.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  device_label text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  license_id uuid not null references public.licenses(id) on delete cascade,
  event_key text not null,
  sent_at timestamptz not null default now(),
  unique(subscription_id,license_id,event_key)
);

alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists own_push_subscriptions on public.push_subscriptions;
create policy own_push_subscriptions
on public.push_subscriptions
for all
to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

-- notification_deliveries è accessibile soltanto dalla Edge Function tramite service role.

create or replace function public.touch_push_subscription()
returns trigger language plpgsql as $$
begin
  new.updated_at=now();
  return new;
end $$;

drop trigger if exists trg_touch_push_subscription on public.push_subscriptions;
create trigger trg_touch_push_subscription
before update on public.push_subscriptions
for each row execute function public.touch_push_subscription();

grant select,insert,update,delete on public.push_subscriptions to authenticated;
