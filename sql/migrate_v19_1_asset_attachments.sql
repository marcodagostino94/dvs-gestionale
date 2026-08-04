-- DVS Workspace V19.1 — Allegati multipli per Computer e Hardware
-- Eseguire una volta in Supabase > SQL Editor dopo migrate_v19_purchase_info.sql.

create extension if not exists pgcrypto;

create table if not exists public.asset_attachments (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('computers','hardware')),
  asset_id uuid not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0 and size_bytes <= 10485760),
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists asset_attachments_asset_idx
on public.asset_attachments(asset_type,asset_id,created_at desc);

alter table public.asset_attachments enable row level security;
drop policy if exists authenticated_all on public.asset_attachments;
create policy authenticated_all on public.asset_attachments
for all to authenticated using (true) with check (true);

insert into storage.buckets(id,name,public,file_size_limit)
values('dvs-asset-attachments','dvs-asset-attachments',false,10485760)
on conflict(id) do update set public=false,file_size_limit=10485760;

drop policy if exists dvs_asset_attachments_authenticated on storage.objects;
create policy dvs_asset_attachments_authenticated on storage.objects
for all to authenticated
using (bucket_id='dvs-asset-attachments')
with check (bucket_id='dvs-asset-attachments');

create or replace function public.refresh_asset_attachments_count()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_type text;
  v_id uuid;
begin
  v_type=case when tg_op='DELETE' then old.asset_type else new.asset_type end;
  v_id=case when tg_op='DELETE' then old.asset_id else new.asset_id end;
  if v_type='computers' then
    update computers set attachments_count=(select count(*) from asset_attachments where asset_type=v_type and asset_id=v_id) where id=v_id;
  elsif v_type='hardware' then
    update hardware set attachments_count=(select count(*) from asset_attachments where asset_type=v_type and asset_id=v_id) where id=v_id;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_refresh_asset_attachments_count on public.asset_attachments;
create trigger trg_refresh_asset_attachments_count
after insert or delete on public.asset_attachments
for each row execute function public.refresh_asset_attachments_count();
