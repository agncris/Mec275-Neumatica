/**
 * Diagrama de fase por pasos (desplazamiento-paso), como lo define la guía del
 * curso: el eje horizontal no es el tiempo sino los pasos de la secuencia.
 *
 * Se construye a partir del registro de posiciones de la simulación: cada vez
 * que un actuador completa una carrera hay un movimiento, y los movimientos que
 * terminan casi a la vez (p. ej. «C y D regresan simultáneamente») comparten el
 * mismo paso.
 */

export interface Muestra {
  t: number
  pos: Record<string, number>
}

export interface Paso {
  /** Movimientos que ocurren en este paso, p. ej. ['C−', 'D−']. */
  movimientos: string[]
  /** Estado de cada actuador (0 dentro, 1 fuera) al terminar el paso. */
  estado: Record<string, 0 | 1>
}

export interface DiagramaPasos {
  /** Estado de cada actuador antes del primer paso. */
  inicial: Record<string, 0 | 1>
  pasos: Paso[]
}

/** Dos movimientos a menos de este margen se consideran simultáneos. */
const SIMULTANEO = 0.2

export function diagramaPorPasos(
  muestras: Muestra[],
  actuadores: Array<{ id: string; letra: string }>,
  maxPasos = 12,
): DiagramaPasos {
  const estadoDe = (p: number): 0 | 1 => (p >= 0.5 ? 1 : 0)
  const inicial: Record<string, 0 | 1> = {}
  for (const a of actuadores) inicial[a.id] = estadoDe(muestras[0]?.pos[a.id] ?? 0)

  // Carreras completadas, en orden
  const eventos: Array<{ t: number; id: string; letra: string; fuera: boolean }> = []
  for (let k = 1; k < muestras.length; k++) {
    for (const a of actuadores) {
      const antes = muestras[k - 1].pos[a.id] ?? 0
      const ahora = muestras[k].pos[a.id] ?? 0
      if (ahora >= 1 && antes < 1) eventos.push({ t: muestras[k].t, id: a.id, letra: a.letra, fuera: true })
      if (ahora <= 0 && antes > 0) eventos.push({ t: muestras[k].t, id: a.id, letra: a.letra, fuera: false })
    }
  }

  const pasos: Paso[] = []
  const estado = { ...inicial }
  let tPaso = -Infinity
  for (const ev of eventos) {
    const nuevo = ev.t - tPaso > SIMULTANEO || pasos.length === 0
    if (nuevo) {
      if (pasos.length >= maxPasos) break
      pasos.push({ movimientos: [], estado: { ...estado } })
      tPaso = ev.t
    }
    const paso = pasos[pasos.length - 1]
    paso.movimientos.push(`${ev.letra}${ev.fuera ? '+' : '−'}`)
    estado[ev.id] = ev.fuera ? 1 : 0
    paso.estado = { ...estado }
  }
  return { inicial, pasos }
}
