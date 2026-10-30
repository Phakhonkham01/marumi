'use client'

import { useRouter } from 'next/navigation'
import type { DeviceModel } from '@/lib/types'

/** "Which phone do you have?" select that filters the product list by model. */
export function DevicePicker({
  models,
  value,
  baseQuery = '',
}: {
  models: DeviceModel[]
  value?: number
  baseQuery?: string
}) {
  const router = useRouter()
  const brands = [...new Set(models.map((m) => m.brand))]

  function onChange(id: string) {
    const params = new URLSearchParams(baseQuery)
    if (id) params.set('device', id)
    else params.delete('device')
    const qs = params.toString()
    router.push(qs ? `/products?${qs}` : '/products')
  }

  return (
    <select
      className="input cursor-pointer font-semibold text-navy"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label="ເລືອກລຸ້ນໂທລະສັບ"
    >
      <option value="">📱 ເລືອກລຸ້ນໂທລະສັບ / AirPods ຂອງເຈົ້າ</option>
      {brands.map((brand) => (
        <optgroup key={brand} label={brand}>
          {models
            .filter((m) => m.brand === brand)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  )
}
