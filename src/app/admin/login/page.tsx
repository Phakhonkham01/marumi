'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useDialog } from '@/components/dialog'
import { ArrowLeftIcon, EyeIcon, EyeOffIcon } from '@/components/icons'
import { signIn } from './actions'

const LOGIN_ERRORS: Record<string, string> = {
  invalid_credentials: 'ເບີໂທ/ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ',
  email_not_confirmed: 'ບັນຊີນີ້ຍັງບໍ່ໄດ້ຢືນຢັນອີເມວ (ໃນ Supabase ໃຫ້ກົດ Confirm user)',
  over_request_rate_limit: 'ລອງຫຼາຍເທື່ອເກີນໄປ ກະລຸນາລໍຖ້າຈັກໜ້ອຍ',
  user_banned: 'ບັນຊີນີ້ຖືກປິດແລ້ວ ກະລຸນາຕິດຕໍ່ເຈົ້າຂອງຮ້ານ',
}

export default function LoginPage() {
  const dialog = useDialog()
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setPending(true)
    // Phone or email; the server works out which account it is.
    const { error, code } = await signIn(String(form.get('login')), String(form.get('password')))
    if (error) {
      setPending(false)
      dialog.alert({ tone: 'error', title: 'ເຂົ້າລະບົບບໍ່ສຳເລັດ', message: LOGIN_ERRORS[code ?? ''] ?? error })
      return
    }
    // Full page load so the new session cookie is sent and no cached
    // "signed-out" redirect from the client router is reused.
    window.location.replace('/admin')
  }

  return (
    <div className="bg-waves flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image src="/logo.jpg" alt="" width={80} height={80} className="rounded-full ring-2 ring-sky" />
          <h1 className="text-xl font-bold text-navy">Marumi ຫຼັງບ້ານ</h1>
        </div>
        <div>
          <label className="label" htmlFor="login">ເບີໂທ ຫຼື ອີເມວ</label>
          <input id="login" name="login" type="text" className="input" required autoComplete="username" placeholder="020 5555 1234" />
        </div>
        <div>
          <label className="label" htmlFor="password">ລະຫັດຜ່ານ</label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className="input w-full pr-12"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-navy"
              aria-label={showPassword ? 'ເຊື່ອງລະຫັດຜ່ານ' : 'ສະແດງລະຫັດຜ່ານ'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
            </button>
          </div>
        </div>
        <button className="btn btn-primary w-full" disabled={pending}>
          {pending ? 'ກຳລັງເຂົ້າລະບົບ...' : 'ເຂົ້າລະບົບ'}
        </button>
        <Link href="/" className="btn btn-ghost w-full">
          <ArrowLeftIcon size={18} /> ກັບໄປໜ້າຮ້ານ
        </Link>
        <p className="text-center text-xs text-muted">ເວີຊັນ {process.env.NEXT_PUBLIC_APP_VERSION}</p>
      </form>
    </div>
  )
}
