/**
 * Programas para probar el simulador con temporizadores y contadores. Ya no
 * están entre los ejemplos de la aplicación (no se ven en el curso), pero el
 * simulador los sigue ejecutando para abrir programas guardados.
 */
import { COLUMNAS, type Bobina, type Celda, type Escalon, type IdPlanta, type ProgramaPLC } from '../plc/ladder'
import { PLANTAS } from '../plc/plantas'

const NA = (dir: string): Celda => ({ tipo: 'contacto', modo: 'NA', dir })
const NC = (dir: string): Celda => ({ tipo: 'contacto', modo: 'NC', dir })
const _: Celda = { tipo: 'vacio' }
const B = (tipo: Bobina['tipo'], dir: string, preset?: number): Bobina => ({ tipo, dir, ...(preset !== undefined ? { preset } : {}) })

function escalon(filas: Celda[][], bobinas: Array<Bobina | null>, enlaces: Array<[number, number]> = []): Escalon {
  const celdas = filas.map((f) => [...f, ...Array(COLUMNAS - f.length).fill(_)] as Celda[])
  const matriz = Array.from({ length: Math.max(0, filas.length - 1) }, () => Array(COLUMNAS + 1).fill(false) as boolean[])
  for (const [f, n] of enlaces) matriz[f][n] = true
  return { celdas, enlaces: matriz, bobinas: [...bobinas, ...Array(filas.length - bobinas.length).fill(null)] }
}

const programa = (planta: IdPlanta, escalones: Escalon[]): ProgramaPLC => ({ version: 1, tipo: 'programa-plc', planta, simbolos: PLANTAS[planta].cableado, escalones })

export const PROGRAMAS_PRUEBA: Record<string, ProgramaPLC> = {
  ton: programa('tablero', [escalon([[NA('I0.4')]], [B('TON', 'T0', 3)]), escalon([[NA('T0.DN')]], [B('normal', 'Q0.0')])]),
  intermitente: programa('tablero', [
    escalon([[NA('I0.4'), NC('T1.DN')]], [B('TON', 'T0', 0.5)]),
    escalon([[NA('T0.DN')]], [B('TON', 'T1', 0.5)]),
    escalon([[NA('T0.DN')]], [B('normal', 'Q0.2')]),
  ]),
  contador: programa('tablero', [
    escalon([[NA('I0.2')]], [B('CTU', 'C0', 5)]),
    escalon([[NA('C0.DN')]], [B('normal', 'Q0.3')]),
    escalon([[NA('I0.3')]], [B('reset', 'C0')]),
  ]),
  semaforo: programa('semaforo', [
    escalon([[NA('I0.0'), NC('I0.1')], [NA('M0.0')]], [B('normal', 'M0.0')], [[0, 1]]),
    escalon([[NA('M0.0'), NC('T3.DN')]], [B('TON', 'T0', 5)]),
    escalon([[NA('T0.DN')]], [B('TON', 'T1', 2)]),
    escalon([[NA('T1.DN')]], [B('TON', 'T2', 5)]),
    escalon([[NA('T2.DN')]], [B('TON', 'T3', 2)]),
    escalon([[NA('M0.0'), NC('T0.DN')]], [B('normal', 'Q0.2')]),
    escalon([[NA('T0.DN'), NC('T1.DN')]], [B('normal', 'Q0.1')]),
    escalon([[NA('T1.DN')], [NC('M0.0')]], [B('normal', 'Q0.0')], [[0, 1]]),
    escalon([[NA('T1.DN'), NC('T2.DN')]], [B('normal', 'Q0.5')]),
    escalon([[NA('T2.DN'), NC('T3.DN')]], [B('normal', 'Q0.4')]),
    escalon([[NC('T1.DN')]], [B('normal', 'Q0.3')]),
  ]),
}
