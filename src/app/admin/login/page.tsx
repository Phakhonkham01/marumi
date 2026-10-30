'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useDialog } from '@/components/dialog'
import { ArrowLeftIcon } from '@/components/icons'
import { createClient } from '@/lib/supabase/client'

const LOGIN_ERRORS: Record<string, string> = {
  invalid_credentials: 'ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ',
  email_not_confirmed: 'ບັນຊີນີ້ຍັງບໍ່ໄດ້ຢືນຢັນອີເມວ (ໃນ Supabase ໃຫ້ກົດ Confirm user)',
  over_request_rate_limit: 'ລອງຫຼາຍເທື່ອເກີນໄປ ກະລຸນາລໍຖ້າຈັກໜ້ອຍ',
}

export default function LoginPage() {
  const dialog = useDialog()
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setPending(true)
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get('email')).trim(),
      password: String(form.get('password')),
    })
    if (error) {
      setPending(false)
      dialog.alert({ tone: 'error', title: 'ເຂົ້າລະບົບບໍ່ສຳເລັດ', message: LOGIN_ERRORS[error.code ?? ''] ?? error.message })
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
          <label className="label" htmlFor="email">ອີເມວ</label>
          <input id="email" name="email" type="email" className="input" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">ລະຫັດຜ່ານ</label>
          <input id="password" name="password" type="password" className="input" required autoComplete="current-password" />
        </div>
        <button className="btn btn-primary w-full" disabled={pending}>
          {pending ? 'ກຳລັງເຂົ້າລະບົບ...' : 'ເຂົ້າລະບົບ'}
        </button>
        <Link href="/" className="btn btn-ghost w-full">
          <ArrowLeftIcon size={18} /> ກັບໄປໜ້າຮ້ານ
        </Link>
      </form>
    </div>
  )
}
