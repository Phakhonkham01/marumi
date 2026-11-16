import Image from 'next/image'
import { imageUrl } from '@/lib/format'

/** SaArdPOS-style tile body: category tag, square photo, navy footer with name, price and stock. */
export function TileBody({
  name,
  category,
  image,
  price,
  priceNote,
  stock,
  badge,
}: {
  name: string
  category?: string | null
  image?: string | null
  price: string
  priceNote?: string
  stock: number
  badge?: React.ReactNode
}) {
  return (
    <>
      <div className="relative aspect-[4/3] w-full shrink-0 bg-white">
        {category && <span className="pcard-tag">{category}</span>}
        {badge}
        <Image
          src={imageUrl(image)}
          alt={name}
          fill
          sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw"
          className={image ? 'object-cover' : 'object-contain p-8 opacity-40 grayscale'}
        />
      </div>
      <div className="pcard-foot">
        <p className="line-clamp-2 min-h-[2.6em] text-sm font-semibold leading-[1.3]">{name}</p>
        <hr />
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-bold">
            {priceNote && <span className="text-xs font-normal text-white/70">{priceNote} </span>}
            {price}
          </span>
          <span className={`text-xs font-semibold ${stock === 0 ? 'text-blush' : 'text-white/80'}`}>
            {stock === 0 ? 'ໝົດ' : `Stock ${stock}`}
          </span>
        </div>
      </div>
    </>
  )
}
