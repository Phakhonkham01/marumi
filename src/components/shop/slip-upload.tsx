'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { useDialog } from '@/components/dialog'
import { TrashIcon, UploadIcon } from '@/components/icons'
import { compressImage, extensionFor } from '@/lib/image'
import { createClient } from '@/lib/supabase/client'

export const SLIP_BUCKET = 'payment-slips'

/** Uploads a transfer slip straight to the private bucket and submits its path with the form. */
export function SlipUpload({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [path, setPath] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const dialog = useDialog()
  const [busy, setBusy] = useState(false)

  async function onPick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    onBusyChange(true)
    try {
      const blob = await compressImage(file, 1600)
      const name = `slips/${crypto.randomUUID()}.${extensionFor(blob)}`
      const { error } = await createClient().storage.from(SLIP_BUCKET).upload(name, blob, { contentType: blob.type })
      if (error) throw error
      setPath(name)
      setPreview(URL.createObjectURL(blob))
    } catch {
      dialog.alert({ tone: 'error', title: 'ອັບໂຫຼດບິນບໍ່ສຳເລັດ', message: 'ກະລຸນາລອງໃໝ່ອີກຄັ້ງ' })
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  function clear() {
    setPath(null)
    setPreview(null)
  }

  return (
    <div>
      <p className="label">ແນບບິນໂອນ (ຖ້າໂອນແລ້ວ)</p>
      {path && <input type="hidden" name="payment_slip_path" value={path} />}
      {preview ? (
        <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-line p-2">
          <div className="relative h-20 w-16 overflow-hidden rounded-lg bg-mist">
            <Image src={preview} alt="ບິນໂອນ" fill sizes="64px" className="object-cover" />
          </div>
          <p className="flex-1 text-sm text-success">✓ ແນບບິນແລ້ວ</p>
          <button type="button" onClick={clear} className="p-2 text-danger" aria-label="ລຶບບິນ">
            <TrashIcon size={18} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky py-4 text-sm font-semibold text-navy disabled:opacity-60"
        >
          <UploadIcon size={20} /> {busy ? 'ກຳລັງອັບໂຫຼດ...' : 'ເລືອກຮູບບິນໂອນ'}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onPick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
