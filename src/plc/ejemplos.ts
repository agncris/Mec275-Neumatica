/**
 * Programas de ejemplo de la unidad de PLC: el ejercicio 1 del apunte y unos
 * programas básicos con lo que se ve en clases (contactos, bobinas, Set y Reset). El
 * ejercicio 2 no está aquí: es un ejercicio para resolver (ejercicios.ts).
 */
import {
  COLUMNAS,
  type Bobina,
  type Celda,
  type Escalon,
  type IdPlanta,
  type ProgramaPLC,
  type Simbolo,
} from './ladder'
import { PLANTAS } from './plantas'

const NA = (dir: string): Celda => ({ tipo: 'contacto', modo: 'NA', dir })
const NC = (dir: string): Celda => ({ tipo: 'contacto', modo: 'NC', dir })
const W: Celda = { tipo: 'cable' }
const _: Celda = { tipo: 'vacio' }
const B = (tipo: Bobina['tipo'], dir: string, preset?: number): Bobina => ({ tipo, dir, ...(preset !== undefined ? { preset } : {}) })

/**
 * Arma un escalón: `filas` son los contactos de cada fila (se rellenan con
 * vacíos hasta COLUMNAS), `bobinas` una por fila y `enlaces` pares
 * [fila, nodo] que unen la fila con la de abajo en ese nodo.
 */
function escalon(
  filas: Celda[][],
  bobinas: Array<Bobina | null>,
  enlaces: Array<[number, number]> = [],
  comentario?: string,
): Escalon {
  const celdas = filas.map((f) => [...f, ...Array(COLUMNAS - f.length).fill(_)] as Celda[])
  const matriz = Array.from({ length: Math.max(0, filas.length - 1) }, () => Array(COLUMNAS + 1).fill(false) as boolean[])
  for (const [f, n] of enlaces) matriz[f][n] = true
  return { celdas, enlaces: matriz, bobinas: [...bobinas, ...Array(filas.length - bobinas.length).fill(null)], ...(comentario ? { comentario } : {}) }
}

const programa = (nombre: string, planta: IdPlanta, simbolos: Simbolo[], escalones: Escalon[]): ProgramaPLC => ({
  version: 1,
  tipo: 'programa-plc',
  nombre,
  planta,
  simbolos,
  escalones,
})

// ---------------------------------------------------------------------------
// Ejercicio 1 · Llenado y vaciado de tanque
// ---------------------------------------------------------------------------
const EJERCICIO1 = programa(
  'Ejercicio 1 · Llenado y vaciado de tanque',
  'estanque',
  [...PLANTAS.estanque.cableado, { dir: 'M0.1', nombre: 'M1', descripcion: 'Marca: el sistema está en marcha' }],
  [
    escalon(
      [[NA('I0.1'), NC('I0.2')], [NA('M0.1')]],
      [B('normal', 'M0.1')],
      [[0, 1]],
      'Marcha y paro: C pone en marcha el sistema (M1) y M1 se autorretiene hasta que se pulsa P.',
    ),
    escalon(
      [[NA('M0.1'), NC('I0.3'), W, NC('Q0.2')], [_, NA('I0.3'), NC('I0.4')]],
      [B('normal', 'Q0.1')],
      [[0, 1], [0, 3]],
      'Llenado: con el sistema en marcha, V1 se abre si el estanque está vacío (S1 sin activar) o a medio llenar (S1 sí, S2 no), y nunca con V2 abierta.',
    ),
    escalon(
      [[NA('M0.1'), NA('I0.4'), NA('I0.3')], [_, NA('Q0.2')]],
      [B('normal', 'Q0.2')],
      [[0, 1], [0, 2]],
      'Vaciado: cuando S2 detecta el estanque lleno, V2 se abre y se autorretiene hasta que S1 deja de detectar líquido.',
    ),
  ],
)

// ---------------------------------------------------------------------------
// Básicos en el tablero de pruebas
// ---------------------------------------------------------------------------
const T = PLANTAS.tablero.cableado

const LOGICA = programa('Básico · Y, O, NO', 'tablero', T, [
  escalon([[NA('I0.4'), NA('I0.5')]], [B('normal', 'Q0.0')], [], 'Y (AND): H1 se enciende sólo con SEL1 y SEL2 a la vez (contactos en serie).'),
  escalon([[NA('I0.4')], [NA('I0.5')]], [B('normal', 'Q0.1')], [[0, 1]], 'O (OR): H2 se enciende con SEL1 o con SEL2 (contactos en paralelo).'),
  escalon([[NC('I0.4')]], [B('normal', 'Q0.2')], [], 'NO (NOT): H3 está encendido mientras SEL1 NO está activado (contacto cerrado).'),
])

const MARCHA_PARO = programa('Básico · Marcha y paro con autorretención', 'tablero', T, [
  escalon(
    [[NA('I0.0'), NC('I0.1')], [NA('Q0.0')]],
    [B('normal', 'Q0.0')],
    [[0, 1]],
    'MARCHA enciende H1; el contacto de H1 en paralelo lo mantiene encendido al soltar (autorretención) hasta que se pulsa PARO.',
  ),
])

const SET_RESET = programa('Básico · Set y Reset', 'tablero', T, [
  escalon([[NA('I0.0')]], [B('set', 'Q0.0')], [], 'MARCHA activa H1 con una bobina Set: queda encendido aunque sueltes.'),
  escalon([[NA('I0.1')]], [B('reset', 'Q0.0')], [], 'PARO lo apaga con una bobina Reset. Como va después, si pulsas los dos gana el Reset.'),
])

// ---------------------------------------------------------------------------
// Portón
// ---------------------------------------------------------------------------
const PORTON = programa(
  'Portón con enclavamiento y fotocelda',
  'porton',
  PLANTAS.porton.cableado,
  [
    escalon(
      [[NA('I0.0'), NC('I0.2'), NC('I0.3'), NC('Q0.1')], [NA('Q0.0')]],
      [B('normal', 'Q0.0')],
      [[0, 1]],
      'Subir: ABRIR arranca y se autorretiene; se corta con PARO, al llegar arriba o si ya está bajando (enclavamiento).',
    ),
    escalon(
      [[NA('I0.1'), NC('I0.2'), NC('I0.4'), NC('Q0.0'), NC('I0.5')], [NA('Q0.1')]],
      [B('normal', 'Q0.1')],
      [[0, 1]],
      'Bajar: igual, y además la fotocelda lo detiene si hay algo bajo el portón.',
    ),
    escalon([[NA('I0.3')]], [B('normal', 'Q0.2')], [], 'Piloto de portón abierto.'),
    escalon([[NA('I0.4')]], [B('normal', 'Q0.3')], [], 'Piloto de portón cerrado.'),
    escalon([[NA('Q0.0')], [NA('Q0.1')]], [B('normal', 'Q0.4')], [[0, 1]], 'Piloto de movimiento: sube o baja.'),
  ],
)

export interface EjemploPLC {
  id: string
  etiqueta: string
  programa: ProgramaPLC
}

export const EJEMPLOS_PLC: EjemploPLC[] = [
  { id: 'ej1', etiqueta: 'Ejercicio 1 · Llenado y vaciado de tanque', programa: EJERCICIO1 },
  { id: 'logica', etiqueta: 'Básico · Y, O, NO', programa: LOGICA },
  { id: 'marcha', etiqueta: 'Básico · Marcha y paro con autorretención', programa: MARCHA_PARO },
  { id: 'setreset', etiqueta: 'Básico · Set y Reset', programa: SET_RESET },
  { id: 'porton', etiqueta: 'Portón con enclavamiento y fotocelda', programa: PORTON },
]
