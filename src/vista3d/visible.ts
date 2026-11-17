/**
 * Saber si una escena 3D se está viendo: el lienzo tiene que estar en pantalla
 * (IntersectionObserver) y la pestaña tiene que estar visible (visibilitychange).
 * Una escena que no se ve no debería dibujar: gasta batería y GPU.
 */

/**
 * Avisa con `alCambiar(visible)` cada vez que el elemento pasa de verse a no
 * verse, o al revés. No avisa del estado inicial (se supone visible).
 * Devuelve la función que deja de observar.
 */
export function alVerse(elemento: Element, alCambiar: (visible: boolean) => void): () => void {
  let enPantalla = true
  let pestana = typeof document === 'undefined' ? true : !document.hidden
  let ultimo = enPantalla && pestana
  const revisar = () => {
    const ahora = enPantalla && pestana
    if (ahora === ultimo) return
    ultimo = ahora
    alCambiar(ahora)
  }
  let observador: IntersectionObserver | null = null
  if (typeof IntersectionObserver !== 'undefined') {
    observador = new IntersectionObserver((entradas) => {
      const e = entradas[entradas.length - 1]
      if (!e) return
      enPantalla = e.isIntersecting
      revisar()
    })
    observador.observe(elemento)
  }
  const alCambiarPestana = () => {
    pestana = !document.hidden
    revisar()
  }
  document.addEventListener('visibilitychange', alCambiarPestana)
  return () => {
    observador?.disconnect()
    document.removeEventListener('visibilitychange', alCambiarPestana)
  }
}

export interface OpcionesBucle {
  /** La escena dejó de verse: es el momento de callar sonidos, por ejemplo. */
  alOcultar?: () => void
  /** La escena volvió a verse, justo antes de dibujar el primer cuadro. */
  alMostrar?: () => void
}

/**
 * Bucle de dibujo que solo corre mientras el elemento se ve. Al volver a verse
 * dibuja de inmediato (en el siguiente cuadro). Devuelve la función que lo detiene
 * del todo (para la limpieza del efecto).
 */
export function bucleVisible(elemento: Element, cuadro: () => void, opciones: OpcionesBucle = {}): () => void {
  let vivo = true
  let visible = true
  let id = 0
  const paso = () => {
    id = 0
    if (!vivo || !visible) return
    id = requestAnimationFrame(paso)
    cuadro()
  }
  id = requestAnimationFrame(paso)
  const quitar = alVerse(elemento, (v) => {
    visible = v
    if (!v) {
      opciones.alOcultar?.()
      return
    }
    opciones.alMostrar?.()
    if (!id && vivo) id = requestAnimationFrame(paso)
  })
  return () => {
    vivo = false
    if (id) cancelAnimationFrame(id)
    id = 0
    quitar()
  }
}
