'use client'

import { useState } from 'react'
import { formatKip } from '@/lib/format'

export type SalesDay = { day: string; online: number; store: number; orders: number; profit: number | null }

// Validated with the dataviz palette checker (CVD-safe, >= 3:1 on white).
const SERIES = [
  { key: 'online', label: 'ອອນລາຍ', color: '#3f66b5' },
  { key: 'store', label: 'ໜ້າຮ້ານ', color: '#c9823a' },
] as const

function shortKip(value: number) {
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

/** Rounds the axis top up to 1, 2 or 5 × 10ⁿ so ticks land on readable numbers. */
function niceMax(value: number) {
  if (value <= 0) return 100_000
  const step = 10 ** Math.floor(Math.log10(value / 3))
  for (const m of [1, 2, 2.5, 5, 10]) if (step * m * 3 >= value) return step * m * 3
  return step * 30
}

const dayLabel = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}`

export function SalesChart({ days }: { days: SalesDay[] }) {
  const [active, setActive] = useState<number | null>(null)
  const max = niceMax(Math.max(...days.map((d) => d.online + d.store)))
  const ticks = [max, (max * 2) / 3, max / 3]
  const totals = { online: 0, store: 0 }
  for (const d of days) {
    totals.online += d.online
    totals.store += d.store
  }
  const shown = active == null ? null : days[active]

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="font-semibold text-ink">{formatKip(totals[s.key])}</span>
          </span>
        ))}
      </div>

      <div className="relative flex h-48 gap-2" onMouseLeave={() => setActive(null)}>
        <div className="flex w-10 shrink-0 flex-col justify-between pb-6 text-right text-[11px] text-muted">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2">{shortKip(t)}</span>
          ))}
          <span className="translate-y-1/2">0</span>
        </div>

        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {[...ticks, 0].map((t) => (
              <div key={t} className={`border-t ${t === 0 ? 'border-sky' : 'border-dashed border-line'}`} />
            ))}
          </div>

          <div className="absolute inset-0 flex">
            {days.map((d, i) => {
              const total = d.online + d.store
              const isToday = i === days.length - 1
              return (
                <button
                  key={d.day}
                  type="button"
                  className="group flex h-full flex-1 flex-col items-center outline-none"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive((a) => (a === i ? null : i))}
                  aria-label={`${dayLabel(d.day)}: ${formatKip(total)}`}
                >
                  <div className="flex w-full flex-1 flex-col justify-end px-[18%] pb-px">
                    <div
                      className={`flex flex-col gap-[2px] transition-opacity ${active != null && active !== i ? 'opacity-40' : ''}`}
                      style={{ height: `${(total / max) * 100}%` }}
                    >
                      {[...SERIES].map((s, si) => {
                        const value = d[s.key]
                        if (!value) return null
                        const onTop = si === 0 || !d.online
                        return (
                          <div
                            key={s.key}
                            className={onTop ? 'rounded-t-[4px]' : ''}
                            style={{ background: s.color, flexGrow: value, minHeight: 2 }}
                          />
                        )
                      })}
                    </div>
                  </div>
                  <span
                    className={`flex h-6 items-end text-[10px] ${isToday ? 'font-bold text-navy' : 'text-muted'} ${
                      i % 2 === (days.length - 1) % 2 ? '' : 'max-sm:invisible'
                    }`}
                  >
                    {isToday ? 'ມື້ນີ້' : dayLabel(d.day)}
                  </span>
                </button>
              )
            })}
          </div>

          {shown && active != null && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-44 rounded-xl border border-line bg-white p-3 text-xs shadow-lg"
              style={{
                left: `${((active + 0.5) / days.length) * 100}%`,
                transform: `translateX(${active < days.length / 2 ? '8px' : 'calc(-100% - 8px)'})`,
              }}
            >
              <p className="mb-1 font-bold text-navy">{dayLabel(shown.day)} · {shown.orders} ບິນ</p>
              {SERIES.map((s) => (
                <p key={s.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span>{formatKip(shown[s.key])}</span>
                </p>
              ))}
              <p className="mt-1 flex justify-between border-t border-line pt-1 font-semibold">
                <span>ລວມ</span>
                <span>{formatKip(shown.online + shown.store)}</span>
              </p>
              {shown.profit != null && (
                <p className="flex justify-between font-semibold text-success">
                  <span>ກຳໄລ</span>
                  <span>{formatKip(shown.profit)}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-muted">ເບິ່ງເປັນຕາຕະລາງ</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-normal">ວັນທີ</th>
              <th className="py-1 text-right font-normal">ບິນ</th>
              {SERIES.map((s) => (
                <th key={s.key} className="py-1 text-right font-normal">{s.label}</th>
              ))}
              <th className="py-1 text-right font-normal">ລວມ</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.day} className="border-t border-line">
                <td className="py-1.5 text-muted">{dayLabel(d.day)}</td>
                <td className="py-1.5 text-right">{d.orders}</td>
                <td className="py-1.5 text-right whitespace-nowrap">{shortKip(d.online)}</td>
                <td className="py-1.5 text-right whitespace-nowrap">{shortKip(d.store)}</td>
                <td className="py-1.5 text-right font-semibold whitespace-nowrap">{formatKip(d.online + d.store)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
