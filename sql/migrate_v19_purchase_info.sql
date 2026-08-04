-- DVS Workspace V19.0
-- Informazioni di acquisto, volutamente testuali e facoltative.

alter table public.computers
  add column if not exists purchase_date_text text not null default '',
  add column if not exists purchase_vendor text not null default '';

alter table public.hardware
  add column if not exists purchase_date_text text not null default '',
  add column if not exists purchase_vendor text not null default '';

comment on column public.computers.purchase_date_text is
  'Data o indicazione libera relativa all acquisto del computer';
comment on column public.computers.purchase_vendor is
  'Negozio, fornitore o luogo di acquisto del computer';
comment on column public.hardware.purchase_date_text is
  'Data o indicazione libera relativa all acquisto dell hardware';
comment on column public.hardware.purchase_vendor is
  'Negozio, fornitore o luogo di acquisto dell hardware';
