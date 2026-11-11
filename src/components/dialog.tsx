'use client'

import Swal, { type SweetAlertIcon } from 'sweetalert2'

type Tone = 'success' | 'error' | 'warning' | 'info'

type DialogOptions = {
  title: string
  message?: string
  tone?: Tone
  okLabel?: string
  cancelLabel?: string
  /** Paints the OK button red, for deletes and cancellations. */
  danger?: boolean
}

// Brand-styled SweetAlert2; buttons reuse the app's .btn classes.
const popupClass = (danger?: boolean) => ({
  popup: 'swal-marumi',
  confirmButton: `btn min-w-28 ${danger ? 'btn-solid-danger' : 'btn-primary'}`,
  cancelButton: 'btn btn-ghost min-w-28',
  actions: 'gap-2',
})

const Popup = Swal.mixin({ buttonsStyling: false, reverseButtons: true, customClass: popupClass() })

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2200,
  timerProgressBar: true,
  customClass: { popup: 'swal-marumi' },
})

async function alert({ title, message, tone = 'info', okLabel = 'ຕົກລົງ' }: DialogOptions) {
  // Successes are toasts so staff can keep working; everything else waits for OK.
  if (tone === 'success') {
    await Toast.fire({ icon: 'success', title, text: message })
    return
  }
  await Popup.fire({ icon: tone as SweetAlertIcon, title, text: message, confirmButtonText: okLabel })
}

async function confirm({ title, message, tone = 'warning', okLabel = 'ຕົກລົງ', cancelLabel = 'ຍົກເລີກ', danger }: DialogOptions) {
  const result = await Popup.fire({
    icon: tone as SweetAlertIcon,
    title,
    text: message,
    showCancelButton: true,
    confirmButtonText: okLabel,
    cancelButtonText: cancelLabel,
    focusCancel: danger,
    customClass: popupClass(danger),
  })
  return result.isConfirmed
}

const api = { alert, confirm }

/** SweetAlert2 popups: `alert` for results, `confirm` resolves true when the user accepts. */
export function useDialog() {
  return api
}
