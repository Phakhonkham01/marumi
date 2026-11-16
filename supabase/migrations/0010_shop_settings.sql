-- Shop settings edited from /admin/shop (bank account and QR shown at checkout).
-- One row only. Everyone may read it (customers see the bank details);
-- writes go through the server after a permission check (service role).
create table if not exists public.shop_settings (
  id int primary key default 1 check (id = 1),
  bank_name text not null default 'BCEL One',
  bank_account text not null default '',
  bank_holder text not null default '',
  bank_qr_url text,
  updated_at timestamptz not null default now()
);
insert into public.shop_settings (id) values (1) on conflict (id) do nothing;

alter table public.shop_settings enable row level security;
drop policy if exists shop_settings_read on public.shop_settings;
create policy shop_settings_read on public.shop_settings for select using (true);
grant select on public.shop_settings to anon, authenticated;

-- Public bucket for the bank QR image.
insert into storage.buckets (id, name, public)
values ('shop', 'shop', true)
on conflict (id) do nothing;
