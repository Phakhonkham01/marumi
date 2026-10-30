# Marumi Phonecase · ມາຣູມິໂຟນເຄສ

ເວັບຮ້ານ + ລະບົບຫຼັງບ້ານ (Next.js 16 + Supabase)

- **ໜ້າຮ້ານ** `/` — ລາຍການສິນຄ້າ, ກອງຕາມລຸ້ນໂທລະສັບ, ຄົ້ນຫາ, ກະຕ່າ, ສັ່ງຊື້ (ບໍ່ຕ້ອງສະໝັກສະມາຊິກ)
- **ຫຼັງບ້ານ** `/admin` — ສິນຄ້າ & ຮູບ, ສະຕັອກ (ຮັບເຂົ້າ/ປັບ + ປະຫວັດ), ອໍເດີອອນລາຍ, ຂາຍໜ້າຮ້ານ (POS), ລາຍງານກຳໄລ

## ເລີ່ມຕົ້ນ

1. ສ້າງໂປຣເຈັກໃນ [supabase.com](https://supabase.com) (ເລືອກ region Singapore)
2. SQL Editor → ແລ່ນ `supabase/migrations/0001_init.sql`, `0002_payment_slips.sql` ແລ້ວ `supabase/seed.sql` (ຂໍ້ມູນຕົວຢ່າງ, ຂ້າມໄດ້)
3. Authentication → Users → **Add user** (ອີເມວ + ລະຫັດຜ່ານ ຂອງເຈົ້າຂອງຮ້ານ) ແລ້ວແລ່ນ:

   ```sql
   insert into public.profiles (id, display_name, role)
   select id, 'ເຈົ້າຂອງຮ້ານ', 'owner' from auth.users where email = 'owner@example.com';
   ```

4. ສຳເນົາ `.env.example` ເປັນ `.env.local` ແລະ ໃສ່ຄ່າຈາກ Project Settings → API
5. `pnpm install && pnpm dev` → ເປີດ http://localhost:3000/admin

### ເພີ່ມພະນັກງານ

ສ້າງ user ໃນ Authentication ແລ້ວແລ່ນ (role `staff` ບໍ່ເຫັນຕົ້ນທຶນ/ກຳໄລ):

```sql
insert into public.profiles (id, display_name, role)
select id, 'ຊື່ພະນັກງານ', 'staff' from auth.users where email = 'staff@example.com';
```

## ກົດເກນທາງທຸລະກິດ

| ເຫດການ | ສະຕັອກ |
|---|---|
| ລູກຄ້າສັ່ງອອນລາຍ | ກວດວ່າພໍ ແຕ່ **ຍັງບໍ່ຕັດ** (ສະຖານະ ລໍຖ້າຢືນຢັນ) |
| ພະນັກງານກົດ “ຢືນຢັນ” | ຕັດສະຕັອກ + ບັນທຶກຕົ້ນທຶນ ນັບເປັນຍອດຂາຍ |
| ຂາຍໜ້າຮ້ານ (POS) | ຕັດສະຕັອກທັນທີ, ສຳເລັດທັນທີ |
| ຍົກເລີກອໍເດີທີ່ຢືນຢັນແລ້ວ | ຄືນສະຕັອກ |
| ຮັບສິນຄ້າເຂົ້າພ້ອມຕົ້ນທຶນ | ຕົ້ນທຶນ = ສະເລ່ຍຖ່ວງນ້ຳໜັກ |

- ສະຕັອກປ່ຽນໄດ້ຜ່ານ RPC ເທົ່ານັ້ນ (trigger ກັນ) ທຸກການປ່ຽນແປງຢູ່ໃນ `stock_movements`
- ລາຄາໃນອໍເດີອອນລາຍຄິດຈາກຖານຂໍ້ມູນສະເໝີ ບໍ່ເຊື່ອລາຄາຈາກ browser
- ຕົ້ນທຶນເກັບແຍກ (`variant_costs`, `order_item_costs`) ສະເພາະ owner ອ່ານໄດ້

## Deploy

- Vercel: ແພັກເກດ Hobby ໃຊ້ສະເພາະງານບໍ່ແມ່ນການຄ້າ → ໃຊ້ Pro ຫຼື ໂຮສອື່ນ
- ຕັ້ງ `NEXT_PUBLIC_SITE_URL` ເປັນໂດເມນຈິງ (ໃຊ້ໃນລິ້ງແຊຣ໌ Facebook)
- Supabase → Authentication → URL Configuration → ໃສ່ໂດເມນ
