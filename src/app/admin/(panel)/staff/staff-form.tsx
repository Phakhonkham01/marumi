'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { appendAvatar, AvatarPicker, type AvatarChange } from '@/components/admin/avatar-picker'
import { useDialog } from '@/components/dialog'
import { EyeIcon, EyeOffIcon } from '@/components/icons'
import { PERMISSION_PRESETS, PERMISSIONS, type Permission } from '@/lib/permissions'
import { createStaff, updateStaff } from './actions'

export type StaffFormValues = {
  id?: string
  name: string
  phone: string
  role: 'owner' | 'staff'
  permissions: Permission[]
  active: boolean
  avatarUrl: string | null
}

export function PasswordInput({ name, placeholder, required }: { name: string; placeholder?: string; required?: boolean }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        name={name}
        type={show ? 'text' : 'password'}
        className="input w-full pr-12"
        placeholder={placeholder}
        required={required}
        minLength={6}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-navy"
        aria-label={show ? 'ເຊື່ອງລະຫັດຜ່ານ' : 'ສະແດງລະຫັດຜ່ານ'}
      >
        {show ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
      </button>
    </div>
  )
}

/**
 * Add / edit a staff member. `grantable` is what the person filling the form
 * may hand out; other boxes are shown but locked.
 */
export function StaffForm({ initial, grantable, isSelf }: { initial: StaffFormValues; grantable: Permission[]; isSelf: boolean }) {
  const router = useRouter()
  const dialog = useDialog()
  const isNew = !initial.id
  const isOwner = initial.role === 'owner'
  const [name, setName] = useState(initial.name)
  const [perms, setPerms] = useState<Set<Permission>>(new Set(initial.permissions))
  const [active, setActive] = useState(initial.active)
  const [avatar, setAvatar] = useState<AvatarChange>({ file: null, remove: false })
  const [busy, setBusy] = useState(false)

  const toggle = (key: Permission) =>
    setPerms((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const applyPreset = (keys: Permission[]) =>
    setPerms((prev) => new Set([...keys.filter((k) => grantable.includes(k)), ...[...prev].filter((k) => !grantable.includes(k))]))

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    form.delete('permissions')
    for (const p of perms) form.append('permissions', p)
    form.set('active', active ? '1' : '0')
    appendAvatar(form, avatar)
    setBusy(true)
    const result = isNew ? await createStaff(form) : await updateStaff(initial.id!, form)
    setBusy(false)
    if (!result.ok) return dialog.alert({ tone: 'error', title: 'ບັນທຶກບໍ່ສຳເລັດ', message: result.error })
    await dialog.alert({ tone: 'success', title: isNew ? 'ເພີ່ມພະນັກງານແລ້ວ' : 'ບັນທຶກແລ້ວ', message: isNew ? 'ພະນັກງານລ໋ອກອິນດ້ວຍເບີໂທ ແລະ ລະຫັດຜ່ານທີ່ຕັ້ງໄວ້' : undefined })
    router.push('/admin/staff')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <section className="card space-y-4 p-5">
        <h2 className="font-bold text-navy">ຂໍ້ມູນພະນັກງານ</h2>
        <AvatarPicker currentUrl={initial.avatarUrl} name={name} onChange={setAvatar} />
        <div>
          <label className="label" htmlFor="name">ຊື່ (ສະແດງໃນໃບບິນ)</label>
          <input id="name" name="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        </div>
        <div>
          <label className="label" htmlFor="phone">ເບີໂທ {!isOwner && '(ໃຊ້ລ໋ອກອິນ)'}</label>
          <input
            id="phone"
            name="phone"
            className="input"
            type="tel"
            inputMode="tel"
            defaultValue={initial.phone}
            placeholder="020 5555 1234"
            required={!isOwner}
          />
          {isOwner && <p className="mt-1 text-xs text-muted">ເຈົ້າຂອງຮ້ານລ໋ອກອິນດ້ວຍອີເມວຄືເກົ່າ</p>}
        </div>
        <div>
          <label className="label">{isNew ? 'ລະຫັດຜ່ານ' : 'ລະຫັດຜ່ານໃໝ່'}</label>
          <PasswordInput name="password" required={isNew} placeholder={isNew ? 'ຢ່າງໜ້ອຍ 6 ຕົວ' : 'ປ່ອຍຫວ່າງ ຖ້າບໍ່ປ່ຽນ'} />
        </div>
        {!isNew && !isOwner && !isSelf && (
          <label className="flex items-center gap-3 rounded-lg border-[1.5px] border-line p-3">
            <input type="checkbox" className="h-5 w-5" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>
              <span className="block font-semibold text-navy">ເປີດໃຊ້ບັນຊີ</span>
              <span className="block text-xs text-muted">ປິດແລ້ວ ລ໋ອກອິນບໍ່ໄດ້ ແຕ່ຊື່ຍັງຢູ່ໃນໃບບິນເກົ່າ</span>
            </span>
          </label>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold text-navy">ສິດໃນລະບົບ</h2>
        {isOwner ? (
          <p className="text-sm text-muted">ເຈົ້າຂອງຮ້ານມີທຸກສິດສະເໝີ</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-sm text-muted">ເລືອກໄວ:</span>
              {PERMISSION_PRESETS.map((p) => (
                <button key={p.label} type="button" className="chip hover:border-navy" onClick={() => applyPreset(p.keys)}>
                  {p.label}
                </button>
              ))}
              <button type="button" className="chip hover:border-navy" onClick={() => applyPreset([])}>
                ລ້າງ
              </button>
            </div>
            <ul className="divide-y divide-line rounded-lg border-[1.5px] border-line">
              {PERMISSIONS.map((p) => {
                const locked = !grantable.includes(p.key) || (isSelf && p.key === 'staff')
                return (
                  <li key={p.key}>
                    <label className={`flex items-center gap-3 px-3 py-2.5 ${locked ? 'opacity-60' : 'cursor-pointer hover:bg-mist'}`}>
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0"
                        checked={perms.has(p.key)}
                        disabled={locked}
                        onChange={() => toggle(p.key)}
                      />
                      <span>
                        <span className="block font-semibold text-navy">{p.label}</span>
                        {p.hint && <span className="block text-xs text-muted">{p.hint}</span>}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <div className="flex gap-2 lg:col-span-2">
        <Link href="/admin/staff" className="btn btn-ghost">
          ຍົກເລີກ
        </Link>
        <button className="btn btn-primary flex-1 sm:flex-none" disabled={busy}>
          {busy ? 'ກຳລັງບັນທຶກ...' : isNew ? 'ເພີ່ມພະນັກງານ' : 'ບັນທຶກ'}
        </button>
      </div>
    </form>
  )
}
