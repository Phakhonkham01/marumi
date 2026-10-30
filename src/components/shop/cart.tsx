'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type CartItem = {
  variantId: number
  productId: number
  slug: string
  productName: string
  variantName: string
  price: number
  image: string | null
  qty: number
  stock: number
}

type CartContextValue = {
  items: CartItem[]
  ready: boolean
  count: number
  subtotal: number
  add: (item: Omit<CartItem, 'qty'>, qty: number) => void
  setQty: (variantId: number, qty: number) => void
  remove: (variantId: number) => void
  replace: (items: CartItem[]) => void
  clear: () => void
}

const STORAGE_KEY = 'marumi-cart-v1'
const CartContext = createContext<CartContextValue | null>(null)

function readStorage(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CartItem[]) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setItems(readStorage())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Storage unavailable (private mode); the cart still works for this visit.
    }
  }, [items, ready])

  const add = useCallback((item: Omit<CartItem, 'qty'>, qty: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId)
      if (existing) {
        return prev.map((i) =>
          i.variantId === item.variantId ? { ...i, ...item, qty: Math.min(i.qty + qty, item.stock) } : i,
        )
      }
      return [...prev, { ...item, qty: Math.min(qty, item.stock) }]
    })
  }, [])

  const setQty = useCallback((variantId: number, qty: number) => {
    setItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, qty: Math.max(1, Math.min(qty, i.stock)) } : i)),
    )
  }, [])

  const remove = useCallback((variantId: number) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      ready,
      count: items.reduce((n, i) => n + i.qty, 0),
      subtotal: items.reduce((n, i) => n + i.qty * i.price, 0),
      add,
      setQty,
      remove,
      replace: setItems,
      clear,
    }),
    [items, ready, add, setQty, remove, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
