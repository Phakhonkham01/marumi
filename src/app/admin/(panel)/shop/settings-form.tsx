'use client'

/* eslint-disable @next/next/no-img-element -- local preview of the picked QR */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useDialog } from '@/components/dialog'
import { UploadIcon } from '@/components/icons'
import { saveShopSettings } from './actions'

type Settings = { bank_name: string; bank_account: string; bank_holder: string; bank_qr_url: string | null }

export function ShopSettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter()
  const dialog = useDialog()
  const [qr, setQr] = useState<{ file: File | null; preview: string | null; remove: boolean }>({
    file: null,
    preview: initial.bank_qr_url,
    remove: false,
  })
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    form.delete('qr')
    // The QR is uploaded as is: shrinking or re-encoding it can make it unreadable.
    if (qr.file) form.set('qr', qr.file)
    if (qr.remove) form.set('removeQr', '1')
    setBusy(true)
    const result = await saveShopSettings(form)
    setBusy(false)
    if (!result.ok) return dialog.alert({ tone: 'error', title: 'ບັນທຶກບໍ່ສຳເລັດ', message: result.error })
    setQr((q) => ({ ...q, file: null, remove: false }))
    router.refresh()
    dialog.alert({ tone: 'success', title: 'ບັນທຶກແລ້ວ', message: 'ລູກຄ້າຈະເຫັນຂໍ້ມູນໃໝ່ຕອນເລືອກໂອນ' })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-4 p-5">
        <h2 className="font-bold text-navy">ບັນຊີຮັບເງິນໂອນ</h2>
        <div>
          <label className="label" htmlFor="bank_name">ທະນາຄານ</label>
          <input id="bank_name" name="bank_name" className="input" defaultValue={initial.bank_name} placeholder="BCEL One" />
        </div>
        <div>
          <label className="label" htmlFor="bank_account">ເລກບັນຊີ</label>
          <input
            id="bank_account"
            name="bank_account"
            className="input font-display text-lg tracking-wide"
            inputMode="numeric"
            defaultValue={initial.bank_account}
            placeholder="ເຊັ່ນ 010-12-00-01234567-001"
          />
        </div>
        <div>
          <label className="label" htmlFor="bank_holder">ຊື່ບັນຊີ</label>
          <input id="bank_holder" name="bank_holder" className="input" defaultValue={initial.bank_holder} placeholder="ຊື່ເຈົ້າຂອງບັນຊີ" />
        </div>
        <p className="text-xs text-muted">ປ່ອຍເລກບັນຊີຫວ່າງ ແລະ ບໍ່ມີ QR = ລູກຄ້າຈະບໍ່ເຫັນກ່ອງໂອນເງິນ</p>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-bold text-navy">QR ຮັບເງິນ</h2>
        {qr.preview ? (
          <div className="flex flex-col items-center gap-3">
            <img src={qr.preview} alt="QR ຮັບເງິນ" className="h-56 w-56 rounded-xl border border-line bg-white object-contain p-2" />
            <div className="flex gap-2">
              <label className="btn btn-ghost btn-sm cursor-pointer">
                <UploadIcon size={16} /> ປ່ຽນຮູບ
                <QrInput onPick={(file) => setQr({ file, preview: URL.createObjectURL(file), remove: false })} />
              </label>
              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setQr({ file: null, preview: null, remove: true })}>
                ລົບ QR
              </button>
            </div>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-sky py-10 text-sm font-semibold text-navy">
            <UploadIcon size={24} /> ເລືອກຮູບ QR (ແຄັບຈາກແອັບ BCEL One)
            <QrInput onPick={(file) => setQr({ file, preview: URL.createObjectURL(file), remove: false })} />
          </label>
        )}
        <p className="text-xs text-muted">ລູກຄ້າບັນທຶກຮູບ QR ແລ້ວສະແກນໃນແອັບທະນາຄານເພື່ອໂອນ</p>
      </section>

      <div className="lg:col-span-2">
        <button className="btn btn-primary w-full sm:w-auto" disabled={busy}>
          {busy ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
        </button>
      </div>
    </form>
  )
}

function QrInput({ onPick }: { onPick: (file: File) => void }) {
  return (
    <input
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0]
        if (file) onPick(file)
      }}
    />
  )
}
