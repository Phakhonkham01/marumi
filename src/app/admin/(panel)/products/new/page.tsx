import Link from 'next/link'
import { ProductForm } from '@/components/admin/product-form'
import { ArrowLeftIcon } from '@/components/icons'
import { createClient, getStaffSession } from '@/lib/supabase/server'
import type { Category, DeviceModel } from '@/lib/types'

export default async function NewProductPage() {
  const session = (await getStaffSession())!
  const supabase = await createClient()
  const [{ data: categories }, { data: models }] = await Promise.all([
    supabase.from('categories').select('*').order('sort'),
    supabase.from('device_models').select('*').order('brand').order('sort'),
  ])

  return (
    <div className="space-y-4">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeftIcon size={16} /> ສິນຄ້າ
      </Link>
      <h1 className="text-2xl font-bold text-navy">ເພີ່ມສິນຄ້າໃໝ່</h1>
      <ProductForm
        categories={(categories as Category[]) ?? []}
        models={(models as DeviceModel[]) ?? []}
        costs={{}}
        isOwner={session.role === 'owner'}
      />
    </div>
  )
}
