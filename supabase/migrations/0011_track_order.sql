-- Customers look up their own order with the order code AND the phone number
-- they ordered with (the code alone is not enough, so nobody can browse other
-- people's orders). Returns no address or phone, only what the customer needs.
create or replace function public.track_order(p_code text, p_phone text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_order orders;
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if length(v_digits) < 8 then
    return null;
  end if;
  select * into v_order from orders where code = upper(btrim(coalesce(p_code, '')));
  if not found
     or right(regexp_replace(coalesce(v_order.customer_phone, ''), '\D', '', 'g'), 8) <> right(v_digits, 8) then
    return null;
  end if;

  return jsonb_build_object(
    'code', v_order.code,
    'status', v_order.status,
    'channel', v_order.channel,
    'customer_name', v_order.customer_name,
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
end $$;

revoke execute on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;
