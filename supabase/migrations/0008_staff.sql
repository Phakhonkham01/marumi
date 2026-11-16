-- Staff accounts and per-menu permissions.
--
-- profiles gains phone, avatar, an on/off switch and a list of permissions.
-- The owner always has every permission. Staff accounts are created and edited
-- from /admin/staff (server side, with the service role key), so profiles has
-- no update policy for signed-in users any more.
--
-- Permission keys:
--   pos       ຂາຍໜ້າຮ້ານ               discount  ໃຫ້ສ່ວນຫຼຸດຕອນຂາຍ
--   receive   ຮັບສິນຄ້າເຂົ້າ             orders    ຈັດການອໍເດີອອນລາຍ
--   cancel    ຍົກເລີກບິນ / ອໍເດີ        sales     ເບິ່ງຍອດຂາຍ ແລະ ໃບບິນ
--   products  ສິນຄ້າ, ໝວດ, ລຸ້ນ, ສະຕັອກ  labels    ພິມສະຕິກເກີບາໂຄ້ດ
--   reports   ລາຍງານ, ຕົ້ນທຶນ, ກຳໄລ     staff     ຈັດການພະນັກງານ

alter table public.profiles
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists is_active boolean not null default true,
  add column if not exists permissions text[] not null default '{}';

create unique index if not exists profiles_phone_key on public.profiles (phone) where phone is not null;

-- Existing staff keep what they could do before: everything except costs and staff.
update public.profiles
set permissions = '{pos,discount,receive,orders,cancel,sales,products,labels}'
where role = 'staff' and permissions = '{}';

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active);
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner' and is_active);
$$;

create or replace function public.can(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_active and (role = 'owner' or p = any (permissions))
  );
$$;
revoke execute on function public.can(text) from public, anon;
grant execute on function public.can(text) to authenticated;

-- Writes to the catalogue need the products permission (save_product runs as the caller).
drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories for all using (can('products')) with check (can('products'));
drop policy if exists device_models_write on public.device_models;
create policy device_models_write on public.device_models for all using (can('products')) with check (can('products'));
drop policy if exists products_write on public.products;
create policy products_write on public.products for all using (can('products')) with check (can('products'));
drop policy if exists product_images_write on public.product_images;
create policy product_images_write on public.product_images for all using (can('products')) with check (can('products'));
drop policy if exists product_variants_write on public.product_variants;
create policy product_variants_write on public.product_variants for all using (can('products')) with check (can('products'));

-- Costs and profit follow the reports permission.
drop policy if exists variant_costs_owner on public.variant_costs;
create policy variant_costs_owner on public.variant_costs for all using (can('reports')) with check (can('reports'));
drop policy if exists order_item_costs_owner on public.order_item_costs;
create policy order_item_costs_owner on public.order_item_costs for select using (can('reports'));

-- Profiles are edited only through the server (service role).
drop policy if exists profiles_owner_write on public.profiles;

-- Profile photos: public bucket, uploads go through the server.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- RPCs: same as before, with permission checks.
create or replace function public.store_sale(
  p_items jsonb,
  p_payment text default 'cash',
  p_discount_lak int default 0,
  p_customer_name text default null,
  p_note text default null,
  p_cash_received_lak int default null,
  p_transfer_lak int default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_order_id bigint;
  v_code text;
  v_subtotal bigint := 0;
  v_cash int;
  v_total bigint;
  v_transfer int;
  r record;
begin
  if not can('pos') then
    raise exception 'forbidden';
  end if;
  if coalesce(p_discount_lak, 0) > 0 and not can('discount') then
    raise exception 'forbidden_discount';
  end if;
  if p_payment not in ('cash', 'transfer', 'mixed') then
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

  v_total := v_subtotal - p_discount_lak;

  -- Mixed: part by transfer, the rest in cash. Both parts must be above zero.
  v_transfer := case when p_payment = 'mixed' then p_transfer_lak end;
  if p_payment = 'mixed' and (v_transfer is null or v_transfer <= 0 or v_transfer >= v_total) then
    raise exception 'invalid_split';
  end if;

  -- Cash handed over must cover the cash part (whole bill, or what is left after the transfer).
  v_cash := case when p_payment in ('cash', 'mixed') then p_cash_received_lak end;
  if v_cash is not null and v_cash < v_total - coalesce(v_transfer, 0) then
    raise exception 'cash_too_low';
  end if;

  perform _deduct_order_stock(v_order_id);

  update orders set
    status = 'completed',
    subtotal_lak = v_subtotal,
    discount_lak = p_discount_lak,
    total_lak = v_subtotal - p_discount_lak,
    cash_received_lak = v_cash,
    transfer_lak = v_transfer,
    confirmed_at = now(),
    completed_at = now()
  where id = v_order_id;
  return v_code;
end $$;

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
  if not can('receive') then
    raise exception 'forbidden';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'invalid_qty';
  end if;
  if p_unit_cost_lak is not null and not can('reports') then
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

create or replace function public.adjust_stock(p_variant_id bigint, p_new_stock int, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_stock int;
begin
  if not can('products') then
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

create or replace function public.set_order_status(p_order_id bigint, p_status public.order_status)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old order_status;
begin
  if p_status = 'cancelled' and not can('cancel') then
    raise exception 'forbidden_cancel';
  end if;
  if not can('orders') and not (p_status = 'cancelled' and can('cancel')) then
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

create or replace function public.sales_report(p_from date, p_to date)
returns table (day date, order_count bigint, revenue_lak bigint, cost_lak bigint, profit_lak bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not can('reports') then
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
  if not can('reports') then
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
