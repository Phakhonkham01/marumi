-- Starter categories, phone models and a few products taken from the Facebook page.
-- Safe to edit or delete from /admin afterwards.

insert into public.categories (name, slug, sort) values
  ('ເຄສໂທລະສັບ', 'phone-cases', 1),
  ('ເຄສ AirPods', 'airpods-cases', 2),
  ('ແບັດສຳຮອງ', 'power-banks', 3),
  ('ສາຍສາກ & ຫົວສາກ', 'chargers', 4),
  ('ຫູຟັງ', 'earphones', 5),
  ('ສາຍຄ້ອງ & ພວງກະແຈ', 'straps', 6);

insert into public.device_models (brand, name, sort)
select 'iPhone', m, ord
from unnest(array[
  'iPhone 11', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
  'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
  'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
  'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
  'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
  'iPhone 17', 'iPhone 17 Air', 'iPhone 17 Pro', 'iPhone 17 Pro Max'
]) with ordinality as t(m, ord);

insert into public.device_models (brand, name, sort)
select 'AirPods', m, ord
from unnest(array['AirPods 2', 'AirPods 3', 'AirPods 4', 'AirPods Pro', 'AirPods Pro 2', 'AirPods Pro 3'])
  with ordinality as t(m, ord);

with pb as (select id from public.categories where slug = 'power-banks')
insert into public.products (category_id, name, slug, price_lak, specs, is_featured)
select pb.id, v.name, v.slug, v.price, v.specs::jsonb, v.featured
from pb, (values
  ('Remax FP60 Mini', 'remax-fp60-mini', 385000,
   '[{"k":"ຄວາມຈຸ","v":"10000 mAh"},{"k":"ສາກໄວ","v":"22.5W"},{"k":"ສາຍໃນຕົວ","v":"USB-C, Lightning"},{"k":"ມາດຕະຖານ","v":"CCC"}]', true),
  ('Soundit SD D11', 'soundit-sd-d11', 920000,
   '[{"k":"ຄວາມຈຸ","v":"80000 mAh"},{"k":"ສາກໄວ","v":"22.5W"},{"k":"ມາດຕະຖານ","v":"ມອກ"}]', false),
  ('MaiMi Mi53', 'maimi-mi53', 480000,
   '[{"k":"ຄວາມຈຸ","v":"15000 mAh"},{"k":"ສາກໄວ","v":"20W"},{"k":"ສາຍໃນຕົວ","v":"USB-C, Lightning"},{"k":"ມາດຕະຖານ","v":"ມອກ"}]', true),
  ('DUDAO K13 Pro', 'dudao-k13-pro', 480000,
   '[{"k":"ຄວາມຈຸ","v":"20000 mAh"},{"k":"ສາກໄວ","v":"20W"},{"k":"ສາຍໃນຕົວ","v":"USB-C, Lightning"},{"k":"ມາດຕະຖານ","v":"CCC"}]', false),
  ('Orsen Eloop E29', 'orsen-eloop-e29', 600000,
   '[{"k":"ຄວາມຈຸ","v":"30000 mAh"},{"k":"ສາກໄວ","v":"30W"},{"k":"ມາດຕະຖານ","v":"ມອກ"}]', true),
  ('Soundit SD D03', 'soundit-sd-d03', 270000,
   '[{"k":"ຄວາມຈຸ","v":"10000 mAh"},{"k":"ສາກໄວ","v":"22.5W"},{"k":"ສາຍໃນຕົວ","v":"USB-C, Lightning"}]', false),
  ('Eloop E66', 'eloop-e66', 650000,
   '[{"k":"ຄວາມຈຸ","v":"20000 mAh"},{"k":"ສາກໄວ","v":"45W"},{"k":"ມາດຕະຖານ","v":"ມອກ"}]', false),
  ('DUDAO K14', 'dudao-k14', 350000,
   '[{"k":"ຄວາມຈຸ","v":"10000 mAh"},{"k":"ສາກໄວ","v":"22.5W"},{"k":"ສາຍໃນຕົວ","v":"USB-C, Lightning"},{"k":"ມາດຕະຖານ","v":"CCC"}]', false)
) as v(name, slug, price, specs, featured);

insert into public.product_variants (product_id, name, stock)
select id, 'ມາດຕະຖານ', 5 from public.products;
