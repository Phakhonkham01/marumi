'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { PlusIcon, TrashIcon, UploadIcon } from '@/components/icons'
import { compressImage, extensionFor } from '@/lib/image'
import { errorMessage, formatKip, imageUrl, slugify } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import { IMAGE_BUCKET } from '@/lib/supabase/env'
import type { Category, DeviceModel, ProductWithRelations, Spec } from '@/lib/types'

type VariantRow = {
  key: string
  id?: number
  name: string
  device_model_id: number | null
  price: string
  initialStock: string
  cost: string
  is_active: boolean
}

type ImageRow = { key: string; id?: number; path?: string; file?: File; preview: string }

const newKey = () => Math.random().toString(36).slice(2)
const toInt = (s: string) => (s.trim() === '' ? null : Math.max(0, Math.round(Number(s.replace(/[,\s]/g, '')))))

export function ProductForm({
  product,
  categories,
  models,
  costs,
  isOwner,
}: {
  product?: ProductWithRelations
  categories: Category[]
  models: DeviceModel[]
  costs: Record<number, number>
  isOwner: boolean
}) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState<number | ''>(product?.category_id ?? categories[0]?.id ?? '')
  const [price, setPrice] = useState(product ? String(product.price_lak) : '')
  const [compareAt, setCompareAt] = useState(product?.compare_at_lak ? String(product.compare_at_lak) : '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [specs, setSpecs] = useState<Spec[]>(product?.specs ?? [])
  const [isActive, setIsActive] = useState(product?.is_active ?? true)
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false)
  const [images, setImages] = useState<ImageRow[]>(
    [...(product?.product_images ?? [])]
      .sort((a, b) => a.sort - b.sort)
      .map((img) => ({ key: String(img.id), id: img.id, path: img.path, preview: imageUrl(img.path) })),
  )
  const [removedImages, setRemovedImages] = useState<ImageRow[]>([])
  const [variants, setVariants] = useState<VariantRow[]>(() => {
    const rows = [...(product?.product_variants ?? [])]
      .sort((a, b) => a.sort - b.sort || a.id - b.id)
      .map((v) => ({
        key: String(v.id),
        id: v.id,
        name: v.name,
        device_model_id: v.device_model_id,
        price: v.price_lak == null ? '' : String(v.price_lak),
        initialStock: '',
        cost: costs[v.id] == null ? '' : String(costs[v.id]),
        is_active: v.is_active,
      }))
    return rows.length ? rows : [blankVariant('ມາດຕະຖານ')]
  })

  function blankVariant(variantName = '', deviceModelId: number | null = null): VariantRow {
    return {
      key: newKey(),
      name: variantName,
      device_model_id: deviceModelId,
      price: '',
      initialStock: '0',
      cost: '',
      is_active: true,
    }
  }

  const updateVariant = (key: string, patch: Partial<VariantRow>) =>
    setVariants((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  function addModels(ids: number[]) {
    const existing = new Set(variants.map((v) => v.device_model_id))
    const added = models
      .filter((m) => ids.includes(m.id) && !existing.has(m.id))
      .map((m) => blankVariant(m.name, m.id))
    setVariants((rows) => {
      // Replace the untouched default row when generating per-model variants.
      const keep = rows.filter((r) => r.id || r.name !== 'ມາດຕະຖານ' || r.device_model_id !== null)
      return [...keep, ...added]
    })
  }

  function onPickFiles(files: FileList | null) {
    if (!files) return
    const rows = Array.from(files).map((file) => ({ key: newKey(), file, preview: URL.createObjectURL(file) }))
    setImages((prev) => [...prev, ...rows])
  }

  function removeImage(row: ImageRow) {
    setImages((prev) => prev.filter((r) => r.key !== row.key))
    if (row.id) setRemovedImages((prev) => [...prev, row])
  }

  function moveImage(index: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function onSave() {
    setError(null)
    const basePrice = toInt(price)
    if (!name.trim()) return setError('ກະລຸນາໃສ່ຊື່ສິນຄ້າ')
    if (basePrice == null) return setError('ກະລຸນາໃສ່ລາຄາ')
    if (variants.length === 0) return setError('ຕ້ອງມີຢ່າງໜ້ອຍ 1 ຕົວເລືອກ')
    if (variants.some((v) => !v.name.trim())) return setError('ກະລຸນາໃສ່ຊື່ຕົວເລືອກໃຫ້ຄົບ')

    setSaving(true)
    const supabase = createClient()
    try {
      const payload = {
        name: name.trim(),
        category_id: categoryId === '' ? null : categoryId,
        price_lak: basePrice,
        compare_at_lak: toInt(compareAt),
        description: description.trim(),
        specs: specs.filter((s) => s.k.trim() && s.v.trim()),
        is_active: isActive,
        is_featured: isFeatured,
      }

      let productId = product?.id
      if (productId) {
        const { error } = await supabase.from('products').update(payload).eq('id', productId)
        if (error) throw error
      } else {
        const slug = `${slugify(payload.name)}-${newKey().slice(0, 4)}`
        const { data, error } = await supabase.from('products').insert({ ...payload, slug }).select('id').single()
        if (error) throw error
        productId = data.id as number
      }

      // Variants: update existing (never stock), insert new with their opening stock.
      const costRows: { variant_id: number; cost_lak: number }[] = []
      for (const [sort, v] of variants.entries()) {
        const fields = {
          name: v.name.trim(),
          device_model_id: v.device_model_id,
          price_lak: toInt(v.price),
          sort,
          is_active: v.is_active,
        }
        let variantId = v.id
        if (variantId) {
          const { error } = await supabase.from('product_variants').update(fields).eq('id', variantId)
          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from('product_variants')
            .insert({ ...fields, product_id: productId, stock: toInt(v.initialStock) ?? 0 })
            .select('id')
            .single()
          if (error) throw error
          variantId = data.id as number
        }
        const cost = toInt(v.cost)
        if (isOwner && cost != null && cost !== costs[variantId]) costRows.push({ variant_id: variantId, cost_lak: cost })
      }
      if (costRows.length) {
        const { error } = await supabase.from('variant_costs').upsert(costRows)
        if (error) throw error
      }

      // Images: drop removed, upload new, then persist order.
      if (removedImages.length) {
        await supabase.from('product_images').delete().in('id', removedImages.map((r) => r.id!))
        await supabase.storage.from(IMAGE_BUCKET).remove(removedImages.map((r) => r.path!))
      }
      for (const [sort, img] of images.entries()) {
        if (img.id) {
          await supabase.from('product_images').update({ sort }).eq('id', img.id)
          continue
        }
        const blob = await compressImage(img.file!)
        const path = `${productId}/${crypto.randomUUID()}.${extensionFor(blob)}`
        const upload = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
          contentType: blob.type,
          cacheControl: '31536000',
        })
        if (upload.error) throw upload.error
        const { error } = await supabase.from('product_images').insert({ product_id: productId, path, sort })
        if (error) throw error
      }

      if (product) {
        router.refresh()
        setRemovedImages([])
        setSaving(false)
      } else {
        router.replace(`/admin/products/${productId}`)
      }
    } catch (e) {
      setError(errorMessage((e as Error).message))
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!product || !confirm(`ລຶບ "${product.name}" ແທ້ບໍ? ຖ້າພຽງຢາກເຊົາຂາຍ ໃຫ້ປິດ "ສະແດງໃນໜ້າຮ້ານ" ແທນ`)) return
    setSaving(true)
    const supabase = createClient()
    const paths = product.product_images.map((i) => i.path)
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) {
      setError(errorMessage(error.message))
      setSaving(false)
      return
    }
    if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths)
    router.replace('/admin/products')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4">
        <div>
          <label className="label" htmlFor="name">ຊື່ສິນຄ້າ</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ເຊັ່ນ Eloop E29 30000mAh" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="category">ໝວດ</label>
            <select
              id="category"
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— ບໍ່ມີ —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="price">ລາຄາຂາຍ (ກີບ)</label>
            <input id="price" className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="385000" />
          </div>
          <div>
            <label className="label" htmlFor="compare">ລາຄາກ່ອນຫຼຸດ (ຖ້າມີ)</label>
            <input id="compare" className="input" inputMode="numeric" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4" />
            ສະແດງໃນໜ້າຮ້ານ
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="h-4 w-4" />
            ⭐ ສິນຄ້າແນະນຳ
          </label>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-bold text-navy">ຮູບສິນຄ້າ</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {images.map((img, i) => (
            <div key={img.key} className="group relative aspect-square overflow-hidden rounded-xl bg-mist">
              <Image src={img.preview} alt="" fill sizes="120px" className="object-cover" unoptimized />
              {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-navy px-2 text-[10px] text-white">ຮູບຫຼັກ</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/50 p-1 text-white">
                <button type="button" onClick={() => moveImage(i, -1)} className="px-2" aria-label="ຍ້າຍຊ້າຍ">‹</button>
                <button type="button" onClick={() => removeImage(img)} aria-label="ລຶບຮູບ"><TrashIcon size={16} /></button>
                <button type="button" onClick={() => moveImage(i, 1)} className="px-2" aria-label="ຍ້າຍຂວາ">›</button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sky text-sm text-navy"
          >
            <UploadIcon size={22} /> ເພີ່ມຮູບ
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            onPickFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <p className="text-xs text-muted">ຮູບຈະຖືກຫຍໍ້ຂະໜາດອັດຕະໂນມັດກ່ອນອັບໂຫຼດ. ແນະນຳໃຊ້ຮູບບໍ່ມີຂໍ້ຄວາມລາຄາ.</p>
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-navy">ຕົວເລືອກ (ລຸ້ນ / ສີ) ແລະ ສະຕັອກ</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVariants((r) => [...r, blankVariant()])}>
            <PlusIcon size={16} /> ເພີ່ມຕົວເລືອກ
          </button>
        </div>
        <ModelBulkAdd models={models} onAdd={addModels} />
        <div className="space-y-2">
          {variants.map((v) => (
            <div key={v.key} className={`rounded-2xl border-[1.5px] border-line p-3 ${v.is_active ? '' : 'opacity-60'}`}>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
                <input
                  className="input"
                  value={v.name}
                  onChange={(e) => updateVariant(v.key, { name: e.target.value })}
                  placeholder="ຊື່ຕົວເລືອກ ເຊັ່ນ ສີຟ້າ"
                  aria-label="ຊື່ຕົວເລືອກ"
                />
                <select
                  className="input"
                  value={v.device_model_id ?? ''}
                  onChange={(e) => updateVariant(v.key, { device_model_id: e.target.value ? Number(e.target.value) : null })}
                  aria-label="ໃຊ້ກັບລຸ້ນ"
                >
                  <option value="">ໃຊ້ກັບລຸ້ນ: ທຸກລຸ້ນ</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  inputMode="numeric"
                  value={v.price}
                  onChange={(e) => updateVariant(v.key, { price: e.target.value })}
                  placeholder="ລາຄາຕ່າງ"
                  aria-label="ລາຄາສະເພາະຕົວເລືອກ"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                {v.id ? (
                  <span className="text-muted">ສະຕັອກ: ປັບຢູ່ລຸ່ມ ↓</span>
                ) : (
                  <label className="flex items-center gap-2">
                    ສະຕັອກເລີ່ມຕົ້ນ
                    <input
                      className="input w-20! py-1!"
                      inputMode="numeric"
                      value={v.initialStock}
                      onChange={(e) => updateVariant(v.key, { initialStock: e.target.value })}
                    />
                  </label>
                )}
                {isOwner && (
                  <label className="flex items-center gap-2">
                    ຕົ້ນທຶນ
                    <input
                      className="input w-28! py-1!"
                      inputMode="numeric"
                      value={v.cost}
                      onChange={(e) => updateVariant(v.key, { cost: e.target.value })}
                      placeholder="ກີບ"
                    />
                  </label>
                )}
                {v.id ? (
                  <label className="ml-auto flex items-center gap-2">
                    <input type="checkbox" checked={v.is_active} onChange={(e) => updateVariant(v.key, { is_active: e.target.checked })} />
                    ເປີດຂາຍ
                  </label>
                ) : (
                  <button
                    type="button"
                    className="ml-auto text-danger"
                    onClick={() => setVariants((rows) => rows.filter((r) => r.key !== v.key))}
                    aria-label="ລຶບຕົວເລືອກ"
                  >
                    <TrashIcon size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">
          ລາຄາຕ່າງ: ປ່ອຍວ່າງ = ໃຊ້ລາຄາຫຼັກ {price && toInt(price) != null ? `(${formatKip(toInt(price)!)})` : ''}
        </p>
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-navy">ສະເປັກ</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSpecs((s) => [...s, { k: '', v: '' }])}>
            <PlusIcon size={16} /> ເພີ່ມ
          </button>
        </div>
        {specs.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input"
              value={s.k}
              placeholder="ເຊັ່ນ ຄວາມຈຸ"
              onChange={(e) => setSpecs((rows) => rows.map((r, j) => (j === i ? { ...r, k: e.target.value } : r)))}
            />
            <input
              className="input"
              value={s.v}
              placeholder="ເຊັ່ນ 10000 mAh"
              onChange={(e) => setSpecs((rows) => rows.map((r, j) => (j === i ? { ...r, v: e.target.value } : r)))}
            />
            <button type="button" className="px-2 text-danger" onClick={() => setSpecs((rows) => rows.filter((_, j) => j !== i))} aria-label="ລຶບ">
              <TrashIcon size={18} />
            </button>
          </div>
        ))}
        <div>
          <label className="label" htmlFor="description">ລາຍລະອຽດ</label>
          <textarea id="description" className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </section>

      {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="sticky bottom-20 z-20 flex gap-2 md:bottom-4">
        <button className="btn btn-primary flex-1 shadow-lg" onClick={onSave} disabled={saving}>
          {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
        </button>
        {product && isOwner && (
          <button className="btn btn-danger" onClick={onDelete} disabled={saving}>
            ລຶບ
          </button>
        )}
      </div>
    </div>
  )
}

function ModelBulkAdd({ models, onAdd }: { models: DeviceModel[]; onAdd: (ids: number[]) => void }) {
  const [selected, setSelected] = useState<number[]>([])
  const brands = [...new Set(models.map((m) => m.brand))]
  return (
    <details className="rounded-2xl bg-mist/60 p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-navy">ສ້າງຕົວເລືອກຕາມລຸ້ນໂທລະສັບ (ສຳລັບເຄສ)</summary>
      <div className="mt-3 space-y-3">
        {brands.map((brand) => (
          <div key={brand}>
            <p className="mb-1 font-semibold">{brand}</p>
            <div className="flex flex-wrap gap-1.5">
              {models
                .filter((m) => m.brand === brand)
                .map((m) => {
                  const on = selected.includes(m.id)
                  return (
                    <button
                      type="button"
                      key={m.id}
                      className="chip py-1! text-xs!"
                      data-active={on}
                      onClick={() => setSelected((s) => (on ? s.filter((id) => id !== m.id) : [...s, m.id]))}
                    >
                      {m.name}
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-butter btn-sm"
          disabled={selected.length === 0}
          onClick={() => {
            onAdd(selected)
            setSelected([])
          }}
        >
          ເພີ່ມ {selected.length} ລຸ້ນ
        </button>
      </div>
    </details>
  )
}
