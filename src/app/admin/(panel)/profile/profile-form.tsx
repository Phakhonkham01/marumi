'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { appendAvatar, AvatarPicker, type AvatarChange } from '@/components/admin/avatar-picker'
import { useDialog } from '@/components/dialog'
import { changeMyPassword, updateMyProfile } from '../staff/actions'
import { PasswordInput } from '../staff/staff-form'

export function ProfileForm({ name: initialName, phone, avatarUrl, isOwner }: { name: string; phone: string; avatarUrl: string | null; isOwner: boolean }) {
  const router = useRouter()
  const dialog = useDialog()
  const [name, setName] = useState(initialName)
  const [avatar, setAvatar] = useState<AvatarChange>({ file: null, remove: false })
  const [busy, setBusy] = useState<'profile' | 'password' | null>(null)

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    appendAvatar(form, avatar)
    setBusy('profile')
    const result = await updateMyProfile(form)
    setBusy(null)
    if (!result.ok) return dialog.alert({ tone: 'error', title: 'ບັນທຶກບໍ່ສຳເລັດ', message: result.error })
    setAvatar({ file: null, remove: false })
    router.refresh()
    dialog.alert({ tone: 'success', title: 'ບັນທຶກແລ້ວ' })
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const el = e.currentTarget
    const form = new FormData(el)
    if (form.get('next') !== form.get('again')) {
      return dialog.alert({ tone: 'error', title: 'ລະຫັດໃໝ່ບໍ່ກົງກັນ', message: 'ພິມລະຫັດໃໝ່ທັງສອງຊ່ອງໃຫ້ຄືກັນ' })
    }
    setBusy('password')
    const result = await changeMyPassword(form)
    setBusy(null)
    if (!result.ok) return dialog.alert({ tone: 'error', title: 'ປ່ຽນລະຫັດບໍ່ສຳເລັດ', message: result.error })
    el.reset()
    dialog.alert({ tone: 'success', title: 'ປ່ຽນລະຫັດຜ່ານແລ້ວ' })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={saveProfile} className="card space-y-4 p-5">
        <h2 className="font-bold text-navy">ຂໍ້ມູນສ່ວນຕົວ</h2>
        <AvatarPicker currentUrl={avatarUrl} name={name} onChange={setAvatar} />
        <div>
          <label className="label" htmlFor="name">ຊື່ (ສະແດງໃນໃບບິນ)</label>
          <input id="name" name="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        </div>
        <div>
          <label className="label" htmlFor="phone">ເບີໂທ {!isOwner && '(ໃຊ້ລ໋ອກອິນ)'}</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" className="input" defaultValue={phone} placeholder="020 5555 1234" required={!isOwner} />
          <p className="mt-1 text-xs text-muted">
            {isOwner ? 'ໃສ່ເບີໂທແລ້ວ ລ໋ອກອິນໄດ້ທັງອີເມວ ແລະ ເບີໂທນີ້' : 'ປ່ຽນເບີໂທແລ້ວ ຄັ້ງໜ້າໃຫ້ລ໋ອກອິນດ້ວຍເບີໃໝ່'}
          </p>
        </div>
        <button className="btn btn-primary" disabled={busy !== null}>
          {busy === 'profile' ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
        </button>
      </form>

      <form onSubmit={savePassword} className="card space-y-3 p-5">
        <h2 className="font-bold text-navy">ປ່ຽນລະຫັດຜ່ານ</h2>
        <div>
          <label className="label">ລະຫັດປັດຈຸບັນ</label>
          <PasswordInput name="current" required />
        </div>
        <div>
          <label className="label">ລະຫັດໃໝ່</label>
          <PasswordInput name="next" required placeholder="ຢ່າງໜ້ອຍ 6 ຕົວ" />
        </div>
        <div>
          <label className="label">ພິມລະຫັດໃໝ່ອີກຄັ້ງ</label>
          <PasswordInput name="again" required />
        </div>
        <button className="btn btn-primary" disabled={busy !== null}>
          {busy === 'password' ? 'ກຳລັງປ່ຽນ...' : 'ປ່ຽນລະຫັດຜ່ານ'}
        </button>
      </form>
    </div>
  )
}
