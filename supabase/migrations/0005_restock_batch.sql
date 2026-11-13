-- Receive a whole delivery in one go (from the scan-to-receive page).
-- All lines are saved or none are; each line goes through restock(), so the
-- stock log, owner-only cost rule and weighted-average cost all still apply.
-- p_items: [{"variant_id": 1, "qty": 5, "unit_cost_lak": 120000 (optional, owner only)}]
create or replace function public.restock_batch(p_items jsonb, p_note text default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_lines int := 0;
begin
  if not is_staff() then
    raise exception 'forbidden';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 200 then
    raise exception 'invalid_items';
  end if;

  for r in
    select (e ->> 'variant_id')::bigint as variant_id,
           (e ->> 'qty')::int as qty,
           nullif(e ->> 'unit_cost_lak', '')::int as unit_cost
    from jsonb_array_elements(p_items) e
  loop
    perform restock(r.variant_id, r.qty, r.unit_cost, p_note);
    v_lines := v_lines + 1;
  end loop;
  return v_lines;
end $$;

revoke execute on function public.restock_batch(jsonb, text) from public, anon;
grant execute on function public.restock_batch(jsonb, text) to authenticated;
