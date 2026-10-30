const TZ = 'Asia/Vientiane'

/** YYYY-MM-DD in shop local time. */
export function localDate(date: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

/** Start of the given local day as an ISO timestamp (Vientiane is UTC+7, no DST). */
export function startOfLocalDay(day: string) {
  return new Date(`${day}T00:00:00+07:00`).toISOString()
}

export function addDays(day: string, days: number) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
