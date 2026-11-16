'use client'

import { useEffect, useState } from 'react'
import { CameraIcon } from '@/components/icons'
import { compressImage } from '@/lib/image'
import { Avatar } from './avatar'

export type AvatarChange = { file: Blob | null; remove: boolean }

/**
 * Photo picker for a staff profile. The photo is shrunk in the browser; the
 * parent puts `change` into the form data (`avatar` / `removeAvatar`).
 */
export function AvatarPicker({
  currentUrl,
  name,
  onChange,
}: {
  currentUrl: string | null
  name: string
  onChange: (change: AvatarChange) => void
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const blob = await compressImage(file, 400)
      setPreview(URL.createObjectURL(blob))
      onChange({ file: blob, remove: false })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar url={preview} name={name || '?'} size={80} />
      <div className="flex flex-wrap gap-2">
        <label className="btn btn-ghost btn-sm cursor-pointer">
          <CameraIcon size={16} /> {busy ? 'ກຳລັງຫຍໍ້ຮູບ...' : preview ? 'ປ່ຽນຮູບ' : 'ໃສ່ຮູບ'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {preview && (
          <button
            type="button"
            className="btn btn-ghost btn-sm text-danger"
            onClick={() => {
              setPreview(null)
              onChange({ file: null, remove: true })
            }}
          >
            ລົບຮູບ
          </button>
        )}
      </div>
    </div>
  )
}

export function appendAvatar(form: FormData, change: AvatarChange) {
  if (change.file) form.set('avatar', new File([change.file], 'avatar', { type: change.file.type }))
  else if (change.remove) form.set('removeAvatar', '1')
}
