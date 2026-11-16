'use client'

import { useState } from 'react'
import type { ShopSettings } from '@/lib/queries'

/** Bank details for transfer payments, with a copy button so the number can be pasted into the banking app. */
export function BankBox({ settings }: { settings: ShopSettings | null }) {
  const [copied, setCopied] = useState(false)
  if (!settings || (!settings.bank_account && !settings.bank_qr_url)) return null
  const { bank_name: name, bank_account: account, bank_holder: holder, bank_qr_url: qr } = settings

  async function copy() {
    try {
      await navigator.clipboard.writeText(account.replace(/\s/g, ''))
    } catch {
      // Older browsers: select-and-copy fallback.
      const el = document.createElement('textarea')
      el.value = account.replace(/\s/g, '')
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3 rounded-2xl bg-mist/70 p-3 text-sm">
      <p className="font-semibold text-navy">ໂອນເຂົ້າບັນຊີ {name}</p>
      {account && (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold tracking-wide">{account}</p>
            {holder && <p className="text-muted">{holder}</p>}
          </div>
          <button
            type="button"
            onClick={copy}
            className={`h-11 shrink-0 rounded-xl px-4 font-semibold ${copied ? 'bg-success text-white' : 'bg-navy text-white'}`}
          >
            {copied ? '✓ ສຳເນົາແລ້ວ' : 'ສຳເນົາເລກບັນຊີ'}
          </button>
        </div>
      )}
      {qr && (
        <div className="flex flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR from storage, shown as uploaded */}
          <img src={qr} alt={`QR ບັນຊີ ${name}`} className="h-56 w-56 rounded-xl bg-white object-contain p-2" />
          <p className="text-xs text-muted">ກົດຄ້າງທີ່ຮູບເພື່ອບັນທຶກ ແລ້ວສະແກນໃນແອັບທະນາຄານ</p>
        </div>
      )}
    </div>
  )
}
