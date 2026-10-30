-- Customers can attach a bank-transfer slip to delivery orders.
-- Slips live in a private bucket: anyone may upload, only staff may view.

alter table public.orders add column payment_slip_path text unique;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-slips', 'payment-slips', false, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy payment_slips_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'payment-slips' and name ~ '^slips/[0-9a-f-]{36}\.(jpg|webp)$');
create policy payment_slips_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'payment-slips' and public.is_staff());
create policy payment_slips_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'payment-slips' and public.is_owner());

-- place_order: same as 0001, plus the optional payment_slip_path.
create or replace function public.place_order(p_customer jsonb, p_items jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_customer ->> 'name', ''));
  v_phone text := btrim(coalesce(p_customer ->> 'phone', ''));
  v_delivery text := coalesce(p_customer ->> 'delivery_method', 'pickup');
  v_address text := nullif(btrim(coalesce(p_customer ->> 'address', '')), '');
  v_payment text := coalesce(p_customer ->> 'payment_method', 'transfer');
  v_slip text := nullif(btrim(coalesce(p_customer ->> 'payment_slip_path', '')), '');
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
  if v_slip is not null and (
       v_slip !~ '^slips/[0-9a-f-]{36}\.(jpg|webp)$'
       or not exists (select 1 from storage.objects where bucket_id = 'payment-slips' and name = v_slip)
       or exists (select 1 from orders where payment_slip_path = v_slip)
     ) then
    raise exception 'invalid_slip';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid_items';
  end if;

  insert into orders (channel, status, customer_name, customer_phone, delivery_method,
                      address, note, payment_method, payment_slip_path)
  values ('online', 'pending', v_name, v_phone, v_delivery, left(v_address, 500),
          left(nullif(btrim(coalesce(p_customer ->> 'note', '')), ''), 500), v_payment, v_slip)
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
