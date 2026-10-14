/**
 * La rueda (o el trackpad) desplaza el contenido aunque el puntero esté sobre la
 * cuadrícula de fondo, un margen o una barra: si lo que hay bajo el puntero no
 * puede desplazarse, el movimiento pasa a la zona de trabajo más cercana.
 * En las vistas donde la página entera se desplaza no hace nada.
 */
import { useEffect } from 'react'

function puedeDesplazar(el: Element, dx: number, dy: number): boolean {
  const cs = getComputedStyle(el)
  const vertical = dy !== 0 && /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1 && (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0)
  const horizontal = dx !== 0 && /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && (dx > 0 ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : el.scrollLeft > 0)
  return vertical || horizontal
}

export function useDesplazarEnBordes() {
  useEffect(() => {
    const alRodar = (e: WheelEvent) => {
      if (e.defaultPrevented || e.ctrlKey || (!e.deltaX && !e.deltaY)) return
      const raiz = document.scrollingElement
      if (raiz && raiz.scrollHeight > raiz.clientHeight + 1) return
      const objetivo = e.target as Element | null
      if (!objetivo || !document.querySelector('.banco, .estudiar')) return
      // Si algo bajo el puntero puede moverse en ese sentido, el navegador ya lo hace.
      for (let n: Element | null = objetivo; n && n !== document.documentElement; n = n.parentElement) {
        if (puedeDesplazar(n, e.deltaX, e.deltaY)) return
      }
      let mejor: HTMLElement | null = null
      let distancia = Infinity
      document.querySelectorAll<HTMLElement>('.banco__area, .panel-acoplado__contenido, .banco-panel, .estudiar__contenido').forEach((el) => {
        if (!puedeDesplazar(el, e.deltaX, e.deltaY)) return
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) return
        const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right)
        const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom)
        const d = Math.hypot(dx, dy)
        if (d < distancia) {
          distancia = d
          mejor = el
        }
      })
      const destino = mejor as HTMLElement | null
      if (destino) destino.scrollBy({ left: e.deltaX, top: e.deltaY })
    }
    window.addEventListener('wheel', alRodar, { passive: true })
    return () => window.removeEventListener('wheel', alRodar)
  }, [])
}
