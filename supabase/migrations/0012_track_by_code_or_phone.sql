-- Order tracking by order code OR by phone number (customer's choice).
-- To keep this safe without the second piece of information, the result never
-- includes the customer's name, phone or address: only status, items and totals.
-- By phone: online orders from the last 90 days, newest first, at most 10.

drop function if exists public.track_order(text, text);

create or replace function public._order_public(v_order orders)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', v_order.code,
    'status', v_order.status,
    'channel', v_order.channel,
    'delivery_method', v_order.delivery_method,
    'payment_method', v_order.payment_method,
    'subtotal_lak', v_order.subtotal_lak,
    'discount_lak', v_order.discount_lak,
    'total_lak', v_order.total_lak,
    'created_at', v_order.created_at,
    'confirmed_at', v_order.confirmed_at,
    'completed_at', v_order.completed_at,
    'cancelled_at', v_order.cancelled_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_name', oi.product_name, 'variant_name', oi.variant_name,
               'qty', oi.qty, 'unit_price_lak', oi.unit_price_lak) order by oi.id)
      from order_items oi where oi.order_id = v_order.id), '[]'::jsonb)
  );
$$;
revoke execute on function public._order_public(orders) from public, anon, authenticated;

-- One order by its code.
create or replace function public.track_order(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_order orders;
begin
  select * into v_order from orders where code = upper(btrim(coalesce(p_code, '')));
  if not found then
    return null;
  end if;
  return _order_public(v_order);
end $$;

-- Recent online orders placed with this phone number (any format: 020…, +856 20…).
create or replace function public.track_orders_by_phone(p_phone text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_digits text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
begin
  if length(v_digits) < 8 then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(_order_public(o) order by o.created_at desc)
    from (
      select * from orders
      where channel = 'online'
        and created_at > now() - interval '90 days'
        and right(regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g'), 8) = v_digits
      order by created_at desc
      limit 10
    ) o
  ), '[]'::jsonb);
end $$;

revoke execute on function public.track_order(text), public.track_orders_by_phone(text) from public;
grant execute on function public.track_order(text), public.track_orders_by_phone(text) to anon, authenticated;
