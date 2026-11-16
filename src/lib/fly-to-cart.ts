/** Small "added!" bounce on the cart icon. */
export function pulse(el: Element) {
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], {
    duration: 320,
    easing: 'ease-out',
  })
}

/**
 * "Fly to cart": a copy of the product photo arcs from the tile into the cart and shrinks.
 * The outer box moves sideways at a steady pace while the inner photo first lifts, then
 * drops, which together draws the curve.
 */
export function flyToCart(source: Element | null, target: Element | null) {
  if (!target) return
  const img = source?.querySelector('img')
  if (!img || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return pulse(target)
  const from = img.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)

  const box = document.createElement('div')
  Object.assign(box.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    zIndex: '70',
    pointerEvents: 'none',
  })
  const ghost = document.createElement('img')
  ghost.src = img.currentSrc || img.src
  Object.assign(ghost.style, {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '14px',
    background: 'white',
    boxShadow: '0 8px 24px rgb(29 43 72 / 0.35)',
  })
  box.append(ghost)
  document.body.append(box)

  const duration = 700
  box.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { duration, easing: 'linear' })
  ghost
    .animate(
      [
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: `translateY(${dy}px) scale(0.12)`, opacity: 0.6 },
      ],
      // Overshooting control points: rises first, then falls into the cart.
      { duration, easing: 'cubic-bezier(0.3, -0.5, 0.7, 0.9)', fill: 'forwards' },
    )
    .finished.then(() => {
      box.remove()
      pulse(target)
    })
}
