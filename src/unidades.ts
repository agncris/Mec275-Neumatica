/**
 * Qué unidades se publican. Una unidad no publicada no entra en el sitio que
 * se sube (su código ni siquiera se incluye en la compilación): no aparece en
 * la barra y no hay forma de abrirla, ni con ?unidad= ni con un enlace.
 *
 * Para publicar una, se cambia su valor a true y se sube a main.
 * Con `npm run dev` (en tu computador) se ven todas, para revisarlas.
 */
export type Unidad = 'neumatica' | 'plc' | 'cnc' | 'robotica'

const CNC_PUBLICADA = false
const ROBOTICA_PUBLICADA = false

// Valores fijos al compilar: si son false, el compilador deja fuera esas unidades.
export const VER_CNC = CNC_PUBLICADA || import.meta.env.DEV
export const VER_ROBOTICA = ROBOTICA_PUBLICADA || import.meta.env.DEV

export function unidadVisible(u: Unidad): boolean {
  if (u === 'cnc') return VER_CNC
  if (u === 'robotica') return VER_ROBOTICA
  return true
}
