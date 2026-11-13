'use client'

import { refreshCatalog } from '@/app/admin/actions'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { CameraScanner } from '@/components/camera-scanner'
import { useDialog } from '@/components/dialog'
import { CameraIcon, PlusIcon, TrashIcon, UploadIcon } from '@/components/icons'
import { generateShopBarcode, looksLikeBarcode, normalizeBarcode } from '@/lib/barcode'
import { compressImage, extensionFor } from '@/lib/image'
import { errorMessage, formatKip, imageUrl } from '@/lib/format'
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
  barcode: string
  is_active: boolean
}

type ImageRow = { key: string; id?: number; path?: string; file?: File; preview: string }

const newKey = () => Math.random().toString(36).slice(2)
const MAX_IMAGES = 10
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_INT = 2_147_483_647
const digitsOnly = (value: string) => value.replace(/\D/g, '')
const toInt = (s: string) => {
  const raw = s.trim().replace(/[,\s]/g, '')
  if (!raw) return null
  if (!/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value <= MAX_INT ? value : null
}

export function ProductForm({
  product,
  categories,
  models,
  costs,
  isOwner,
  initialBarcode = '',
}: {
  product?: ProductWithRelations
  categories: Category[]
  models: DeviceModel[]
  costs: Record<number, number>
  isOwner: boolean
  /** Prefills the first variant when a product is created from an unknown scan. */
  initialBarcode?: string
}) {
  const router = useRouter()
  const dialog = useDialog()
  const fileInput = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [scanningKey, setScanningKey] = useState<string | null>(null)

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
  const imagesRef = useRef<ImageRow[]>([])
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
        barcode: v.barcode ?? '',
        is_active: v.is_active,
      }))
    return rows.length ? rows : [{ ...blankVariant('ມາດຕະຖານ'), barcode: initialBarcode }]
  })

  imagesRef.current = images
  useEffect(() => {
    return () => {
      for (const image of imagesRef.current) if (image.file) URL.revokeObjectURL(image.preview)
    }
  }, [])

  function blankVariant(variantName = '', deviceModelId: number | null = null): VariantRow {
    return {
      key: newKey(),
      name: variantName,
      device_model_id: deviceModelId,
      price: '',
      initialStock: '0',
      cost: '',
      barcode: '',
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
    const remaining = MAX_IMAGES - images.length
    const selected = Array.from(files)
    if (remaining <= 0) return missing(`ເພີ່ມຮູບໄດ້ສູງສຸດ ${MAX_IMAGES} ຮູບ`)
    const accepted = selected.filter((file) => file.type.startsWith('image/') && file.size <= MAX_IMAGE_BYTES).slice(0, remaining)
    if (accepted.length !== selected.length) {
      missing(`ຮູບຕ້ອງເປັນຮູບພາບ ແລະ ຂະໜາດບໍ່ເກີນ 10 MB (ສູງສຸດ ${MAX_IMAGES} ຮູບ)`)
    }
    const rows = accepted.map((file) => ({ key: newKey(), file, preview: URL.createObjectURL(file) }))
    setImages((prev) => [...prev, ...rows])
  }

  function removeImage(row: ImageRow) {
    if (row.file) URL.revokeObjectURL(row.preview)
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

  const missing = (message: string) => dialog.alert({ tone: 'warning', title: 'ຂໍ້ມູນຍັງບໍ່ຄົບ', message })

  async function onSave() {
    const basePrice = toInt(price)
    if (!name.trim()) return missing('ກະລຸນາໃສ່ຊື່ສິນຄ້າ')
    if (basePrice == null) return missing('ລາຄາຂາຍຕ້ອງເປັນຈຳນວນເຕັມ 0–2,147,483,647 ກີບ')
    if (variants.length === 0) return missing('ຕ້ອງມີຢ່າງໜ້ອຍ 1 ຕົວເລືອກ')
    if (variants.some((v) => !v.name.trim())) return missing('ກະລຸນາໃສ່ຊື່ຕົວເລືອກໃຫ້ຄົບ')
    const barcodes = variants.map((v) => v.barcode).filter(Boolean)
    if (barcodes.some((b) => !looksLikeBarcode(b))) return missing('ບາໂຄ້ດບໍ່ຖືກຕ້ອງ: ໃຊ້ໄດ້ສະເພາະຕົວເລກ, A-Z ແລະ - (4–64 ຕົວ)')
    if (new Set(barcodes).size !== barcodes.length) return missing('ມີບາໂຄ້ດຊ້ຳກັນໃນສິນຄ້ານີ້')
    const comparePrice = toInt(compareAt)
    if (compareAt.trim() && comparePrice == null) return missing('ລາຄາກ່ອນຫຼຸດຕ້ອງເປັນຈຳນວນເຕັມ 0–2,147,483,647 ກີບ')
    if (comparePrice != null && comparePrice <= basePrice) return missing('ລາຄາກ່ອນຫຼຸດຕ້ອງສູງກວ່າລາຄາຂາຍ')
    const names = new Set<string>()
    const modelIds = new Set<number>()
    for (const variant of variants) {
      const key = variant.name.trim().toLocaleLowerCase()
      if (names.has(key)) return missing('ຊື່ຕົວເລືອກຫ້າມຊ້ຳກັນ')
      names.add(key)
      if (variant.device_model_id != null) {
        if (modelIds.has(variant.device_model_id)) return missing('ຫ້າມເລືອກລຸ້ນໂທລະສັບຊ້ຳກັນ')
        modelIds.add(variant.device_model_id)
      }
      if (variant.price.trim() && toInt(variant.price) == null) return missing('ລາຄາຕົວເລືອກຕ້ອງເປັນຈຳນວນເຕັມ 0–2,147,483,647 ກີບ')
      if (!variant.id && toInt(variant.initialStock) == null) return missing('ສະຕັອກເລີ່ມຕົ້ນຕ້ອງເປັນຈຳນວນເຕັມ 0–2,147,483,647')
      if (isOwner && variant.cost.trim() && toInt(variant.cost) == null) return missing('ຕົ້ນທຶນຕ້ອງເປັນຈຳນວນເຕັມ 0–2,147,483,647 ກີບ')
    }

    setSaving(true)
    const supabase = createClient()
    const uploadedPaths: string[] = []
    let savedProductId = product?.id
    try {
      const payload = {
        name: name.trim(),
        category_id: categoryId === '' ? null : categoryId,
        price_lak: basePrice,
        compare_at_lak: comparePrice,
        description: description.trim(),
        specs: specs.filter((s) => s.k.trim() && s.v.trim()),
        is_active: isActive,
        is_featured: isFeatured,
      }

      const { data: returnedProductId, error: saveError } = await supabase.rpc('save_product', {
        p_product: { ...payload, id: product?.id ?? '' },
        p_variants: variants.map((v, sort) => ({
          id: v.id ?? '',
          name: v.name.trim(),
          device_model_id: v.device_model_id ?? '',
          price_lak: toInt(v.price) ?? '',
          initial_stock: toInt(v.initialStock) ?? 0,
          cost_lak: isOwner ? toInt(v.cost) ?? '' : '',
          barcode: v.barcode,
          sort,
          is_active: v.is_active,
        })),
      })
      if (saveError) throw saveError
      const productId = Number(returnedProductId)
      if (!Number.isSafeInteger(productId)) throw new Error('product_not_found')
      savedProductId = productId

      // Images: drop removed, upload new, then persist order.
      if (removedImages.length) {
        const { error } = await supabase.from('product_images').delete().in('id', removedImages.map((r) => r.id!))
        if (error) throw error
        const { error: storageError } = await supabase.storage.from(IMAGE_BUCKET).remove(removedImages.map((r) => r.path!))
        if (storageError) throw storageError
      }
      for (const [sort, img] of images.entries()) {
        if (img.id) {
          const { error } = await supabase.from('product_images').update({ sort }).eq('id', img.id)
          if (error) throw error
          continue
        }
        const blob = await compressImage(img.file!)
        const path = `${productId}/${crypto.randomUUID()}.${extensionFor(blob)}`
        const upload = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
          contentType: blob.type,
          cacheControl: '31536000',
        })
        if (upload.error) throw upload.error
        uploadedPaths.push(path)
        const { error } = await supabase.from('product_images').insert({ product_id: productId, path, sort })
        if (error) throw error
      }

      await refreshCatalog()
      if (product) {
        router.refresh()
        setRemovedImages([])
        setSaving(false)
        dialog.alert({ tone: 'success', title: 'ບັນທຶກສຳເລັດ', message: `ອັບເດດ "${payload.name}" ແລ້ວ` })
      } else {
        await dialog.alert({
          tone: 'success',
          title: 'ເພີ່ມສິນຄ້າສຳເລັດ',
          message: `"${payload.name}" ຖືກເພີ່ມແລ້ວ ມີ ${variants.length} ຕົວເລືອກ ແລະ ${images.length} ຮູບ. ໜ້າຕໍ່ໄປໃຫ້ປັບສະຕັອກ ຫຼື ແກ້ໄຂລາຍລະອຽດໄດ້`,
        })
        router.replace('/admin/products')
      }
    } catch (e) {
      if (uploadedPaths.length) {
        if (savedProductId) await supabase.from('product_images').delete().eq('product_id', savedProductId).in('path', uploadedPaths)
        await supabase.storage.from(IMAGE_BUCKET).remove(uploadedPaths)
      }
      setSaving(false)
      dialog.alert({ tone: 'error', title: 'ບັນທຶກບໍ່ສຳເລັດ', message: errorMessage((e as Error).message) })
    }
  }

  async function onDelete() {
    if (!product) return
    const ok = await dialog.confirm({
      title: `ລຶບ "${product.name}" ແທ້ບໍ?`,
      message: 'ຖ້າພຽງຢາກເຊົາຂາຍ ໃຫ້ປິດ "ສະແດງໃນໜ້າຮ້ານ" ແທນ',
      okLabel: 'ລຶບ',
      danger: true,
    })
    if (!ok) return
    setSaving(true)
    const supabase = createClient()
    const paths = product.product_images.map((i) => i.path)
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) {
      setSaving(false)
      dialog.alert({ tone: 'error', title: 'ລຶບບໍ່ສຳເລັດ', message: errorMessage(error.message) })
      return
    }
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(IMAGE_BUCKET).remove(paths)
      if (storageError) {
        dialog.alert({
          tone: 'warning',
          title: 'ລຶບສິນຄ້າແລ້ວ ແຕ່ລຶບຮູບບາງສ່ວນບໍ່ສຳເລັດ',
          message: errorMessage(storageError.message),
        })
      }
    }
    await refreshCatalog()
    router.replace('/admin/products')
    router.refresh()
    dialog.alert({ tone: 'success', title: 'ລຶບສິນຄ້າແລ້ວ', message: `"${product.name}" ຖືກລຶບແລ້ວ` })
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4">
        <div>
          <label className="label" htmlFor="name">ຊື່ສິນຄ້າ</label>
          <input id="name" className="input" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="ເຊັ່ນ Eloop E29 30000mAh" />
          <p className="mt-1 text-xs text-muted">ຂໍ້ຄວາມບໍ່ເກີນ 200 ຕົວອັກສອນ</p>
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
            <input id="price" className="input" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={10} value={price} onChange={(e) => setPrice(digitsOnly(e.target.value))} placeholder="385000" />
            <p className="mt-1 text-xs text-muted">ໃສ່ຕົວເລກເຕັມເທົ່ານັ້ນ, ບໍ່ຕ້ອງໃສ່ຈຸດ ຫຼື ຕົວອັກສອນ</p>
          </div>
          <div>
            <label className="label" htmlFor="compare">ລາຄາກ່ອນຫຼຸດ (ຖ້າມີ)</label>
            <input id="compare" className="input" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={10} value={compareAt} onChange={(e) => setCompareAt(digitsOnly(e.target.value))} placeholder="ຕົວເລກເຕັມ (ກີບ)" />
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={v.price}
                  onChange={(e) => updateVariant(v.key, { price: digitsOnly(e.target.value) })}
                  placeholder="ລາຄາຕ່າງ"
                  aria-label="ລາຄາສະເພາະຕົວເລືອກ"
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="input font-mono tracking-wider"
                  value={v.barcode}
                  // A barcode gun types into the focused field; fix Lao-layout keys as it arrives.
                  onChange={(e) => updateVariant(v.key, { barcode: normalizeBarcode(e.target.value) })}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  placeholder="ບາໂຄ້ດ: ກົດແລ້ວສະແກນ ຫຼື ພິມ"
                  aria-label="ບາໂຄ້ດ"
                  maxLength={64}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm shrink-0"
                  onClick={() => setScanningKey(v.key)}
                  aria-label="ສະແກນດ້ວຍກ້ອງ"
                >
                  <CameraIcon size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm shrink-0"
                  onClick={() => updateVariant(v.key, { barcode: generateShopBarcode() })}
                  title="ສຳລັບສິນຄ້າທີ່ບໍ່ມີບາໂຄ້ດຈາກໂຮງງານ"
                >
                  ສ້າງລະຫັດ
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                {v.id ? (
                  <span className="text-muted">ສະຕັອກ: ປັບຢູ່ລຸ່ມ ↓</span>
                ) : (
                  <label className="flex items-center gap-2">
                    ສະຕັອກເລີ່ມຕົ້ນ
                    <input
                      className="input w-20! py-1!"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      value={v.initialStock}
                      onChange={(e) => updateVariant(v.key, { initialStock: digitsOnly(e.target.value) })}
                    />
                  </label>
                )}
                {isOwner && (
                  <label className="flex items-center gap-2">
                    ຕົ້ນທຶນ
                    <input
                      className="input w-28! py-1!"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      value={v.cost}
                      onChange={(e) => updateVariant(v.key, { cost: digitsOnly(e.target.value) })}
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
          ລາຄາຕ່າງ: ປ່ອຍວ່າງ = ໃຊ້ລາຄາຫຼັກ {price && toInt(price) != null ? `(${formatKip(toInt(price)!)})` : ''}. ລາຄາ, ສະຕັອກ ແລະ ຕົ້ນທຶນຮັບສະເພາະຕົວເລກເຕັມ.
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
              aria-label={`ຊື່ສະເປັກ ${i + 1}`}
              placeholder="ເຊັ່ນ ຄວາມຈຸ"
              onChange={(e) => setSpecs((rows) => rows.map((r, j) => (j === i ? { ...r, k: e.target.value } : r)))}
            />
            <input
              className="input"
              value={s.v}
              aria-label={`ຄ່າສະເປັກ ${i + 1}`}
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
          <textarea id="description" className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ຂໍ້ຄວາມອະທິບາຍສິນຄ້າ" />
        </div>
      </section>

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
      {scanningKey && (
        <CameraScanner
          title="ສະແກນບາໂຄ້ດສິນຄ້າ"
          onScan={(code) => {
            updateVariant(scanningKey, { barcode: code })
            setScanningKey(null)
          }}
          onClose={() => setScanningKey(null)}
        />
      )}
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
