-- Save the product record and its variants/costs atomically.
create or replace function public.save_product(p_product jsonb, p_variants jsonb) returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_product_id bigint;
  v_variant_id bigint;
  v_name text := btrim(coalesce(p_product ->> 'name', ''));
  v_slug text;
  v_variant jsonb;
  v_cost bigint;
begin
  if not is_staff() then
    raise exception 'forbidden';
  end if;
  if length(v_name) < 1 or length(v_name) > 200 then
    raise exception 'invalid_name';
  end if;
  if (p_product ->> 'price_lak') !~ '^[0-9]+$' then
    raise exception 'invalid_price';
  end if;
  if jsonb_typeof(p_variants) is distinct from 'array' or jsonb_array_length(p_variants) < 1 then
    raise exception 'invalid_variants';
  end if;

  v_product_id := nullif(p_product ->> 'id', '')::bigint;
  if v_product_id is null then
    v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    if v_slug = '' then
      v_slug := 'item';
    end if;
    v_slug := v_slug || '-' || lower(substr(md5(gen_random_uuid()::text), 1, 4));
    insert into products (category_id, name, slug, description, price_lak, compare_at_lak, specs, is_active, is_featured)
    values (
      nullif(p_product ->> 'category_id', '')::bigint,
      v_name,
      v_slug,
      coalesce(p_product ->> 'description', ''),
      (p_product ->> 'price_lak')::int,
      nullif(p_product ->> 'compare_at_lak', '')::int,
      coalesce(p_product -> 'specs', '[]'::jsonb),
      coalesce((p_product ->> 'is_active')::boolean, true),
      coalesce((p_product ->> 'is_featured')::boolean, false)
    )
    returning id into v_product_id;
  else
    update products
    set category_id = nullif(p_product ->> 'category_id', '')::bigint,
        name = v_name,
        description = coalesce(p_product ->> 'description', ''),
        price_lak = (p_product ->> 'price_lak')::int,
        compare_at_lak = nullif(p_product ->> 'compare_at_lak', '')::int,
        specs = coalesce(p_product -> 'specs', '[]'::jsonb),
        is_active = coalesce((p_product ->> 'is_active')::boolean, true),
        is_featured = coalesce((p_product ->> 'is_featured')::boolean, false)
    where id = v_product_id;
    if not found then
      raise exception 'product_not_found';
    end if;
  end if;

  for v_variant in select value from jsonb_array_elements(p_variants)
  loop
    if length(btrim(coalesce(v_variant ->> 'name', ''))) < 1 then
      raise exception 'invalid_variant_name';
    end if;
    if nullif(v_variant ->> 'price_lak', '') is not null
       and (v_variant ->> 'price_lak') !~ '^[0-9]+$' then
      raise exception 'invalid_price';
    end if;
    v_variant_id := nullif(v_variant ->> 'id', '')::bigint;
    if v_variant_id is null then
      insert into product_variants (product_id, name, device_model_id, price_lak, stock, sort, is_active)
      values (
        v_product_id,
        btrim(v_variant ->> 'name'),
        nullif(v_variant ->> 'device_model_id', '')::bigint,
        nullif(v_variant ->> 'price_lak', '')::int,
        greatest(0, coalesce(nullif(v_variant ->> 'initial_stock', '')::int, 0)),
        coalesce((v_variant ->> 'sort')::int, 0),
        coalesce((v_variant ->> 'is_active')::boolean, true)
      )
      returning id into v_variant_id;
    else
      update product_variants
      set name = btrim(v_variant ->> 'name'),
          device_model_id = nullif(v_variant ->> 'device_model_id', '')::bigint,
          price_lak = nullif(v_variant ->> 'price_lak', '')::int,
          sort = coalesce((v_variant ->> 'sort')::int, 0),
          is_active = coalesce((v_variant ->> 'is_active')::boolean, true)
      where id = v_variant_id and product_id = v_product_id;
      if not found then
        raise exception 'variant_not_found';
      end if;
    end if;

    if p_product ? 'is_owner' and (p_product ->> 'is_owner')::boolean then
      v_cost := nullif(v_variant ->> 'cost_lak', '')::bigint;
      if v_cost is null then
        delete from variant_costs where variant_id = v_variant_id;
      else
        insert into variant_costs (variant_id, cost_lak)
        values (v_variant_id, v_cost)
        on conflict (variant_id) do update set cost_lak = excluded.cost_lak, updated_at = now();
      end if;
    end if;
  end loop;

  return v_product_id;
end
$$;

grant execute on function public.save_product(jsonb, jsonb) to authenticated;
