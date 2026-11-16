/* eslint-disable @next/next/no-img-element -- photos are already small; skip next/image */

/** Round staff photo, or the first letter of the name when there is no photo. */
export function Avatar({ url, name, size = 40, className = '' }: { url?: string | null; name: string; size?: number; className?: string }) {
  const style = { width: size, height: size }
  if (url) return <img src={url} alt="" style={style} className={`shrink-0 rounded-full object-cover ${className}`} />
  return (
    <span
      style={{ ...style, fontSize: size * 0.42 }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-sky font-bold text-navy ${className}`}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
