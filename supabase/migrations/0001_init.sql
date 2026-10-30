-- Marumi Phonecase: catalog, stock, orders and profit tracking.
-- Run once in the Supabase SQL editor (or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'staff');
create type public.order_status as enum ('pending', 'confirmed', 'completed', 'cancelled');
create type public.order_channel as enum ('online', 'store');

-- ---------------------------------------------------------------------------
-- Staff profiles (one row per auth user who may use /admin)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner');
$$;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.device_models (
  id bigint generated always as identity primary key,
  brand text not null,
  name text not null,
  sort int not null default 0,
  unique (brand, name)
);

create table public.products (
  id bigint generated always as identity primary key,
  category_id bigint references public.categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null default '',
  price_lak int not null check (price_lak >= 0),
  compare_at_lak int check (compare_at_lak is null or compare_at_lak >= 0),
  -- [{"k": "ຄວາມຈຸ", "v": "10000 mAh"}, ...]
  specs jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products (category_id);

create table public.product_images (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  path text not null,
  sort int not null default 0
);
create index on public.product_images (product_id);

-- Every product has at least one variant; stock lives here.
create table public.product_variants (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  name text not null default 'ມາດຕະຖານ',
  device_model_id bigint references public.device_models (id) on delete set null,
  price_lak int check (price_lak is null or price_lak >= 0),
  stock int not null default 0 check (stock >= 0),
  sort int not null default 0,
  is_active boolean not null default true
);
create index on public.product_variants (product_id);
create index on public.product_variants (device_model_id);

-- Owner-only: cost price per variant (weighted average on restock).
create table public.variant_costs (
  variant_id bigint primary key references public.product_variants (id) on delete cascade,
  cost_lak int not null default 0 check (cost_lak >= 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id bigint generated always as identity primary key,
  code text not null unique default (
    'MR' || to_char(now() at time zone 'Asia/Vientiane', 'YYMMDD') || '-' ||
    upper(substr(md5(gen_random_uuid()::text), 1, 5))
  ),
  channel public.order_channel not null default 'online',
  status public.order_status not null default 'pending',
  customer_name text not null,
  customer_phone text,
  delivery_method text not null default 'pickup' check (delivery_method in ('pickup', 'delivery')),
  address text,
  note text,
  payment_method text not null default 'transfer' check (payment_method in ('cash', 'transfer', 'cod')),
  subtotal_lak int not null default 0,
  discount_lak int not null default 0 check (discount_lak >= 0),
  total_lak int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
create index on public.orders (status, created_at desc);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  variant_id bigint references public.product_variants (id) on delete set null,
  product_name text not null,
  variant_name text not null,
  qty int not null check (qty > 0),
  unit_price_lak int not null check (unit_price_lak >= 0)
);
create index on public.order_items (order_id);

-- Owner-only: cost snapshot taken when stock leaves the shop.
create table public.order_item_costs (
  order_item_id bigint primary key references public.order_items (id) on delete cascade,
  unit_cost_lak int not null default 0
);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  variant_id bigint not null references public.product_variants (id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('restock', 'sale', 'cancel', 'adjust')),
  order_id bigint references public.orders (id) on delete set null,
  note text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.stock_movements (variant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public._touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger products_touch before update on public.products
  for each row execute function public._touch_updated_at();

-- Stock may only change through the RPCs below, so every change is logged.
create or replace function public._guard_stock() returns trigger
language plpgsql as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('marumi.stock_ok', true), '') <> '1' then
    raise exception 'stock_must_use_rpc';
  end if;
  return new;
end $$;

create trigger product_variants_guard_stock before update on public.product_variants
  for each row execute function public._guard_stock();

create or replace function public._log_initial_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stock > 0 then
    insert into stock_movements (variant_id, delta, reason, note)
    values (new.id, new.stock, 'restock', 'ສະຕັອກເລີ່ມຕົ້ນ');
  end if;
  return new;
end $$;

create trigger product_variants_initial_stock after insert on public.product_variants
  for each row execute function public._log_initial_stock();

-- ---------------------------------------------------------------------------
-- Stock helpers (internal)
-- ---------------------------------------------------------------------------
create or replace function public._deduct_order_stock(p_order_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  perform set_config('marumi.stock_ok', '1', true);
  for r in
    select oi.id, oi.variant_id, oi.qty, oi.product_name, coalesce(c.cost_lak, 0) as cost
    from order_items oi
    left join variant_costs c on c.variant_id = oi.variant_id
    where oi.order_id = p_order_id and oi.variant_id is not null
  loop
    update product_variants set stock = stock - r.qty
    where id = r.variant_id and stock >= r.qty;
    if not found then
      raise exception 'insufficient_stock:%', r.product_name;
    end if;
    insert into stock_movements (variant_id, delta, reason, order_id)
    values (r.variant_id, -r.qty, 'sale', p_order_id);
    insert into order_item_costs (order_item_id, unit_cost_lak)
    values (r.id, r.cost)
    on conflict (order_item_id) do update set unit_cost_lak = excluded.unit_cost_lak;
  end loop;
  perform set_config('marumi.stock_ok', '', true);
end $$;

create or replace function public._restore_order_stock(p_order_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  perform set_config('marumi.stock_ok', '1', true);
  for r in
    select variant_id, qty from order_items
    where order_id = p_order_id and variant_id is not null
  loop
    update product_variants set stock = stock + r.qty where id = r.variant_id;
    insert into stock_movements (variant_id, delta, reason, order_id)
    values (r.variant_id, r.qty, 'cancel', p_order_id);
  end loop;
  perform set_config('marumi.stock_ok', '', true);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: customer checkout (anonymous). Prices are always taken from the DB.
-- Stock is checked here but only deducted when staff confirm the order.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(p_customer jsonb, p_items jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_customer ->> 'name', ''));
  v_phone text := btrim(coalesce(p_customer ->> 'phone', ''));
  v_delivery text := coalesce(p_customer ->> 'delivery_method', 'pickup');
  v_address text := nullif(btrim(coalesce(p_customer ->> 'address', '')), '');
  v_payment text := coalesce(p_customer ->> 'payment_method', 'transfer');
  v_order_id bigint;
  v_code text;
  v_subtotal bigint := 0;
  r record;
begin
  if length(v_name) < 2 or length(v_name) > 100 then
    raise exception 'invalid_name';
  end if;
  if v_phone !~ '^[0-9+ -]{8,20}$' then
    raise exception 'invalid_phone';
  end if;
  if v_delivery not in ('pickup', 'delivery') then
    raise exception 'invalid_delivery';
  end if;
  if v_delivery = 'delivery' and coalesce(length(v_address), 0) < 5 then
    raise exception 'address_required';
  end if;
  if v_payment not in ('transfer', 'cod', 'cash') then
    raise exception 'invalid_payment';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid_items';
  end if;

  insert into orders (channel, status, customer_name, customer_phone, delivery_method,
                      address, note, payment_method)
  values ('online', 'pending', v_name, v_phone, v_delivery, left(v_address, 500),
          left(nullif(btrim(coalesce(p_customer ->> 'note', '')), ''), 500), v_payment)
  returning id, code into v_order_id, v_code;

  for r in
    select i.variant_id, i.qty, v.name as variant_name, v.stock,
           coalesce(v.price_lak, p.price_lak) as price, p.name as product_name
    from (
      select (e ->> 'variant_id')::bigint as variant_id, sum((e ->> 'qty')::int) as qty
      from jsonb_array_elements(p_items) e
      group by 1
    ) i
    left join product_variants v on v.id = i.variant_id and v.is_active
    left join products p on p.id = v.product_id and p.is_active
  loop
    if r.product_name is null then
      raise exception 'variant_unavailable';
    end if;
    if r.qty < 1 or r.qty > 99 then
      raise exception 'invalid_qty';
    end if;
    if r.stock < r.qty then
      raise exception 'insufficient_stock:%', r.product_name;
    end if;
    insert into order_items (order_id, variant_id, product_name, variant_name, qty, unit_price_lak)
    values (v_order_id, r.variant_id, r.product_name, r.variant_name, r.qty, r.price);
    v_subtotal := v_subtotal + r.price * r.qty;
  end loop;

  update orders set subtotal_lak = v_subtotal, total_lak = v_subtotal where id = v_order_id;
  return v_code;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: staff order workflow
-- pending -> confirmed (stock deducted) -> completed; any -> cancelled (stock restored)
-- ---------------------------------------------------------------------------
create or replace function public.set_order_status(p_order_id bigint, p_status public.order_status)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old order_status;
begin
  if not is_staff() then
    raise exception 'forbidden';
  end if;
  select status into v_old from orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_old = p_status then
    return;
  end if;
  if v_old = 'cancelled' or p_status = 'pending'
     or (v_old = 'completed' and p_status <> 'cancelled') then
    raise exception 'invalid_transition';
  end if;

  if v_old = 'pending' and p_status in ('confirmed', 'completed') then
    perform _deduct_order_stock(p_order_id);
  elsif v_old in ('confirmed', 'completed') and p_status = 'cancelled' then
    perform _restore_order_stock(p_order_id);
  end if;

  update orders set
    status = p_status,
    confirmed_at = case when p_status in ('confirmed', 'completed') then coalesce(confirmed_at, now()) else confirmed_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
  where id = p_order_id;
end $$;

-- RPC: walk-in sale at the shop counter. Completed immediately.
-- p_items: [{"variant_id": 1, "qty": 2, "unit_price_lak": 380000 (optional)}]
create or replace function public.store_sale(
  p_items jsonb,
  p_payment text default 'cash',
  p_discount_lak int default 0,
  p_customer_name text default null,
  p_note text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_order_id bigint;
  v_code text;
  v_subtotal bigint := 0;
  r record;
begin
  if not is_staff() then
    raise exception 'forbidden';
  end if;
  if p_payment not in ('cash', 'transfer') then
    raise exception 'invalid_payment';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_items';
  end if;

  insert into orders (channel, status, customer_name, payment_method, note, created_by)
  values ('store', 'pending', coalesce(nullif(btrim(p_customer_name), ''), 'ລູກຄ້າໜ້າຮ້ານ'),
          p_payment, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning id, code into v_order_id, v_code;

  for r in
    select (e ->> 'variant_id')::bigint as variant_id, (e ->> 'qty')::int as qty,
           (e ->> 'unit_price_lak')::int as unit_price,
           v.name as variant_name, coalesce(v.price_lak, p.price_lak) as price, p.name as product_name
    from jsonb_array_elements(p_items) e
    left join product_variants v on v.id = (e ->> 'variant_id')::bigint
    left join products p on p.id = v.product_id
  loop
    if r.product_name is null then
      raise exception 'variant_unavailable';
    end if;
    if r.qty is null or r.qty < 1 then
      raise exception 'invalid_qty';
    end if;
    if r.unit_price is not null and r.unit_price < 0 then
      raise exception 'invalid_price';
    end if;
    insert into order_items (order_id, variant_id, product_name, variant_name, qty, unit_price_lak)
    values (v_order_id, r.variant_id, r.product_name, r.variant_name, r.qty, coalesce(r.unit_price, r.price));
    v_subtotal := v_subtotal + coalesce(r.unit_price, r.price) * r.qty;
  end loop;

  if p_discount_lak < 0 or p_discount_lak > v_subtotal then
    raise exception 'invalid_discount';
  end if;

  perform _deduct_order_stock(v_order_id);

  update orders set
    status = 'completed',
    subtotal_lak = v_subtotal,
    discount_lak = p_discount_lak,
    total_lak = v_subtotal - p_discount_lak,
    confirmed_at = now(),
    completed_at = now()
  where id = v_order_id;
  return v_code;
end $$;

-- RPC: receive goods. Cost (owner only) is folded into a weighted average.
create or replace function public.restock(
  p_variant_id bigint,
  p_qty int,
  p_unit_cost_lak int default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_stock int;
  v_cost int;
begin
  if not is_staff() then
    raise exception 'forbidden';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'invalid_qty';
  end if;
  if p_unit_cost_lak is not null and not is_owner() then
    raise exception 'forbidden_cost';
  end if;

  select stock into v_stock from product_variants where id = p_variant_id for update;
  if not found then
    raise exception 'variant_not_found';
  end if;

  if p_unit_cost_lak is not null then
    select cost_lak into v_cost from variant_costs where variant_id = p_variant_id;
    insert into variant_costs (variant_id, cost_lak, updated_at)
    values (
      p_variant_id,
      case when v_cost is null or v_stock <= 0 then p_unit_cost_lak
           else round((v_stock::numeric * v_cost + p_qty::numeric * p_unit_cost_lak) / (v_stock + p_qty))::int
      end,
      now()
    )
    on conflict (variant_id) do update set cost_lak = excluded.cost_lak, updated_at = now();
  end if;

  perform set_config('marumi.stock_ok', '1', true);
  update product_variants set stock = stock + p_qty where id = p_variant_id;
  perform set_config('marumi.stock_ok', '', true);
  insert into stock_movements (variant_id, delta, reason, note)
  values (p_variant_id, p_qty, 'restock', nullif(btrim(coalesce(p_note, '')), ''));
end $$;

-- RPC: correct the count after a stock take.
create or replace function public.adjust_stock(p_variant_id bigint, p_new_stock int, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_stock int;
begin
  if not is_staff() then
    raise exception 'forbidden';
  end if;
  if p_new_stock is null or p_new_stock < 0 then
    raise exception 'invalid_qty';
  end if;
  select stock into v_stock from product_variants where id = p_variant_id for update;
  if not found then
    raise exception 'variant_not_found';
  end if;
  if v_stock = p_new_stock then
    return;
  end if;
  perform set_config('marumi.stock_ok', '1', true);
  update product_variants set stock = p_new_stock where id = p_variant_id;
  perform set_config('marumi.stock_ok', '', true);
  insert into stock_movements (variant_id, delta, reason, note)
  values (p_variant_id, p_new_stock - v_stock, 'adjust', nullif(btrim(coalesce(p_note, '')), ''));
end $$;

-- ---------------------------------------------------------------------------
-- RPC: owner reports. Sales count from confirmed/completed orders,
-- dated by Vientiane local time.
-- ---------------------------------------------------------------------------
create or replace function public.sales_report(p_from date, p_to date)
returns table (day date, order_count bigint, revenue_lak bigint, cost_lak bigint, profit_lak bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_owner() then
    raise exception 'forbidden';
  end if;
  return query
  with o as (
    select ord.id, (coalesce(ord.confirmed_at, ord.created_at) at time zone 'Asia/Vientiane')::date as d,
           ord.total_lak as total
    from orders ord
    where ord.status in ('confirmed', 'completed')
  ), c as (
    select oi.order_id, sum(oi.qty * coalesce(oc.unit_cost_lak, 0))::bigint as cost
    from order_items oi
    left join order_item_costs oc on oc.order_item_id = oi.id
    group by oi.order_id
  )
  select o.d, count(*)::bigint, sum(o.total)::bigint, coalesce(sum(c.cost), 0)::bigint,
         (sum(o.total) - coalesce(sum(c.cost), 0))::bigint
  from o
  left join c on c.order_id = o.id
  where o.d between p_from and p_to
  group by o.d
  order by o.d;
end $$;

create or replace function public.top_products(p_from date, p_to date, p_limit int default 10)
returns table (product_name text, qty bigint, revenue_lak bigint, profit_lak bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_owner() then
    raise exception 'forbidden';
  end if;
  return query
  select oi.product_name,
         sum(oi.qty)::bigint,
         sum(oi.qty * oi.unit_price_lak)::bigint,
         sum(oi.qty * (oi.unit_price_lak - coalesce(oc.unit_cost_lak, 0)))::bigint
  from order_items oi
  join orders ord on ord.id = oi.order_id
  left join order_item_costs oc on oc.order_item_id = oi.id
  where ord.status in ('confirmed', 'completed')
    and (coalesce(ord.confirmed_at, ord.created_at) at time zone 'Asia/Vientiane')::date between p_from and p_to
  group by oi.product_name
  order by 3 desc
  limit p_limit;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.device_models enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.variant_costs enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_costs enable row level security;
alter table public.stock_movements enable row level security;

create policy profiles_read on public.profiles for select using (id = auth.uid() or is_staff());
create policy profiles_owner_write on public.profiles for update using (is_owner()) with check (is_owner());

create policy categories_read on public.categories for select using (true);
create policy categories_write on public.categories for all using (is_staff()) with check (is_staff());

create policy device_models_read on public.device_models for select using (true);
create policy device_models_write on public.device_models for all using (is_staff()) with check (is_staff());

create policy products_read on public.products for select using (is_active or is_staff());
create policy products_write on public.products for all using (is_staff()) with check (is_staff());

create policy product_images_read on public.product_images for select using (true);
create policy product_images_write on public.product_images for all using (is_staff()) with check (is_staff());

create policy product_variants_read on public.product_variants for select using (is_active or is_staff());
create policy product_variants_write on public.product_variants for all using (is_staff()) with check (is_staff());

create policy variant_costs_owner on public.variant_costs for all using (is_owner()) with check (is_owner());

create policy orders_read on public.orders for select using (is_staff());
create policy orders_owner_delete on public.orders for delete using (is_owner());
create policy order_items_read on public.order_items for select using (is_staff());
create policy order_item_costs_owner on public.order_item_costs for select using (is_owner());
create policy stock_movements_read on public.stock_movements for select using (is_staff());

-- ---------------------------------------------------------------------------
-- Grants (RLS above does the real gating)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.device_models, public.products,
  public.product_images, public.product_variants to anon, authenticated;
grant insert, update, delete on public.categories, public.device_models, public.products,
  public.product_images, public.product_variants, public.variant_costs to authenticated;
grant select on public.profiles, public.variant_costs, public.orders, public.order_items,
  public.order_item_costs, public.stock_movements to authenticated;
grant update on public.profiles to authenticated;
grant delete on public.orders to authenticated;

revoke execute on function public._deduct_order_stock(bigint), public._restore_order_stock(bigint)
  from public, anon, authenticated;
revoke execute on function public.set_order_status(bigint, public.order_status),
  public.store_sale(jsonb, text, int, text, text), public.restock(bigint, int, int, text),
  public.adjust_stock(bigint, int, text), public.sales_report(date, date),
  public.top_products(date, date, int) from public, anon;
grant execute on function public.set_order_status(bigint, public.order_status),
  public.store_sale(jsonb, text, int, text, text), public.restock(bigint, int, int, text),
  public.adjust_stock(bigint, int, text), public.sales_report(date, date),
  public.top_products(date, date, int) to authenticated;
grant execute on function public.place_order(jsonb, jsonb), public.is_staff(), public.is_owner()
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public product image bucket, staff-only writes
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy product_images_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());
create policy product_images_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_staff());
create policy product_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_staff());
