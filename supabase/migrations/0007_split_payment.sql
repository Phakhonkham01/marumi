-- Split payment: part cash, part transfer (payment_method 'mixed').
-- Run after 0006_cash_received.sql.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cash', 'transfer', 'cod', 'mixed'));
alter table public.orders
  add column if not exists transfer_lak int check (transfer_lak > 0);

drop function if exists public.store_sale(jsonb, text, int, text, text, int);

create function public.store_sale(
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
  if not is_staff() then
    raise exception 'forbidden';
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

revoke execute on function public.store_sale(jsonb, text, int, text, text, int, int) from public, anon;
grant execute on function public.store_sale(jsonb, text, int, text, text, int, int) to authenticated;
