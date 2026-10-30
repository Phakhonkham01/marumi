'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useDialog } from '@/components/dialog'
import { TrashIcon } from '@/components/icons'
import { errorMessage, slugify } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import type { Category, DeviceModel } from '@/lib/types'

function useMutation() {
  const router = useRouter()
  const dialog = useDialog()
  const [busy, setBusy] = useState(false)
  async function run(success: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    const { error } = await fn()
    setBusy(false)
    if (error) {
      dialog.alert({ tone: 'error', title: 'ບັນທຶກບໍ່ສຳເລັດ', message: errorMessage(error.message) })
      return false
    }
    router.refresh()
    dialog.alert({ tone: 'success', title: success })
    return true
  }
  const confirmDelete = (title: string, message?: string) =>
    dialog.confirm({ title, message, okLabel: 'ລຶບ', danger: true })
  return { busy, run, confirmDelete }
}

export function CategoryEditor({ categories }: { categories: Category[] }) {
  const { busy, run, confirmDelete } = useMutation()
  const [name, setName] = useState('')
  const supabase = createClient()

  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-bold text-navy">ໝວດສິນຄ້າ</h2>
      <ul className="divide-y divide-line text-sm">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            <input
              className="input py-1!"
              defaultValue={c.name}
              onBlur={(e) => {
                const value = e.target.value.trim()
                if (value && value !== c.name) run(`ປ່ຽນຊື່ເປັນ "${value}" ແລ້ວ`, () => supabase.from('categories').update({ name: value }).eq('id', c.id))
              }}
              aria-label="ຊື່ໝວດ"
            />
            <button
              className="p-2 text-danger"
              aria-label="ລຶບໝວດ"
              onClick={async () =>
                (await confirmDelete(`ລຶບໝວດ "${c.name}"?`, 'ສິນຄ້າໃນໝວດນີ້ຈະບໍ່ມີໝວດ')) &&
                run(`ລຶບໝວດ "${c.name}" ແລ້ວ`, () => supabase.from('categories').delete().eq('id', c.id))
              }
            >
              <TrashIcon size={18} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const value = name.trim()
          if (!value) return
          const ok = await run(`ເພີ່ມໝວດ "${value}" ແລ້ວ`, () =>
            supabase.from('categories').insert({
              name: value,
              slug: `${slugify(value)}-${Date.now().toString(36).slice(-4)}`,
              sort: categories.length + 1,
            }),
          )
          if (ok) setName('')
        }}
      >
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ໝວດໃໝ່" />
        <button className="btn btn-primary btn-sm" disabled={busy}>
          ເພີ່ມ
        </button>
      </form>
    </section>
  )
}

export function DeviceModelEditor({ models }: { models: DeviceModel[] }) {
  const { busy, run, confirmDelete } = useMutation()
  const [brand, setBrand] = useState('iPhone')
  const [name, setName] = useState('')
  const supabase = createClient()
  const brands = [...new Set(models.map((m) => m.brand))]

  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-bold text-navy">ລຸ້ນໂທລະສັບ / AirPods</h2>
      <div className="space-y-2">
        {brands.map((b) => (
          <div key={b}>
            <p className="mb-1 text-sm font-semibold">{b}</p>
            <div className="flex flex-wrap gap-1.5">
              {models
                .filter((m) => m.brand === b)
                .map((m) => (
                  <span key={m.id} className="chip py-1! text-xs!">
                    {m.name}
                    <button
                      aria-label={`ລຶບ ${m.name}`}
                      className="text-danger"
                      onClick={async () =>
                        (await confirmDelete(`ລຶບ ${m.name}?`)) &&
                        run(`ລຶບ ${m.name} ແລ້ວ`, () => supabase.from('device_models').delete().eq('id', m.id))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!brand.trim() || !name.trim()) return
          const ok = await run(`ເພີ່ມ ${name.trim()} ແລ້ວ`, () =>
            supabase.from('device_models').insert({
              brand: brand.trim(),
              name: name.trim(),
              sort: models.filter((m) => m.brand === brand.trim()).length + 1,
            }),
          )
          if (ok) setName('')
        }}
      >
        <input className="input w-32!" value={brand} onChange={(e) => setBrand(e.target.value)} list="brands" placeholder="ຍີ່ຫໍ້" />
        <datalist id="brands">
          {brands.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ເຊັ່ນ Galaxy S25" />
        <button className="btn btn-primary btn-sm" disabled={busy}>
          ເພີ່ມ
        </button>
      </form>
    </section>
  )
}
