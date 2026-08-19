/**
 * Paleta y primitivas de dibujo compartidas por las vistas en corte,
 * al estilo de las láminas técnicas de taller.
 */

// Aire
export const AZUL_PRESION = '#1f7bd4'
export const CELESTE_ATM = '#bfe3f7'
export const NEUTRO = '#dde4ea' // cavidad sin conexión

// Cuerpos de válvula (fundición gris)
export const CUERPO = '#c9ced6'
export const CUERPO_BORDE = '#828a94'

// Cuerpo de cilindro (aluminio anodizado, como en las láminas)
export const CUERPO_CIL = '#f0a94c'
export const CUERPO_CIL_BORDE = '#c07d22'

// Metales
export const METAL = '#9aa2ad'
export const METAL_CLARO = '#b8c0ca'
export const METAL_OSCURO = '#6d7580'

// Juntas
export const JUNTA = '#14181d'
export const JUNTA_ROJA = '#d1342f'

export const TEXTO = '#33475c'
export const TEXTO_SUAVE = '#5a6b7d'

/** Azul intenso si hay presión; celeste si está a la atmósfera. */
export const colorP = (p: number | undefined): string =>
  p !== undefined && p > 0.1 ? AZUL_PRESION : CELESTE_ATM

/** Muelle helicoidal de eje horizontal, entre xIzq y xDer. */
export function resorteHorizontal(
  xIzq: number,
  xDer: number,
  cy: number,
  ry: number,
  vueltas: number,
): string {
  const paso = (xDer - xIzq) / Math.max(1, vueltas)
  let d = `M${xIzq},${cy - ry}`
  for (let i = 0; i < vueltas; i++) {
    const x = xIzq + paso * i
    d += ` A${paso / 2},${ry} 0 1 1 ${x + paso},${cy - ry}`
  }
  return d
}

/** Muelle helicoidal de eje vertical, entre yArriba e yAbajo. */
export function resorteVertical(
  yArriba: number,
  yAbajo: number,
  cx: number,
  rx: number,
  vueltas: number,
): string {
  const paso = (yAbajo - yArriba) / Math.max(1, vueltas)
  let d = `M${cx - rx},${yArriba}`
  for (let i = 0; i < vueltas; i++) {
    const y = yArriba + paso * i
    d += ` A${rx},${paso / 2} 0 1 1 ${cx - rx},${y + paso}`
  }
  return d
}

/** Transición estándar de las piezas móviles y de los colores de aire. */
export const T_MOVIL = 'transform 130ms ease-out'
export const T_AIRE = 'fill 150ms'
