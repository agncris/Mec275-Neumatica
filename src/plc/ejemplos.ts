/**
 * Programas de ejemplo de la unidad de PLC: los ejercicios resueltos en clase
 * (apunte, ejercicios 1 y 2) y una serie de programas básicos en el tablero
 * de pruebas para ver cada instrucción funcionando por separado.
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
// Ejercicio 2 · Elevador de piezas
// ---------------------------------------------------------------------------
const EJERCICIO2 = programa(
  'Ejercicio 2 · Elevador de piezas',
  'elevador',
  [...PLANTAS.elevador.cableado, { dir: 'M0.1', nombre: 'EXPULSIÓN', descripcion: 'Marca: la pieza ya fue expulsada en este ciclo' }],
  [
    escalon([[NA('I0.0'), NA('I0.1'), NA('I0.3')]], [B('set', 'Q0.0')], [], 'Pieza en la plataforma y los dos cilindros en su inicio: Z1 sube (Y1 queda activada).'),
    escalon([[NA('I0.2'), NA('I0.3'), NC('M0.1')]], [B('set', 'Q0.1')], [], 'Z1 arriba, Z2 en su inicio y la pieza todavía sin expulsar: Z2 sale a empujarla.'),
    escalon([[NA('I0.4')]], [B('set', 'M0.1')], [], 'Z2 llegó a su final: la pieza ya está expulsada (se recuerda en la marca).'),
    escalon([[NA('I0.1'), NA('I0.3')]], [B('reset', 'M0.1')], [], 'Los dos cilindros de vuelta en su inicio: se borra la marca para el ciclo siguiente.'),
    escalon([[NA('M0.1'), NA('I0.4'), NA('I0.2')]], [B('reset', 'Q0.1')], [], 'Pieza expulsada con Z2 fuera: Z2 vuelve.'),
    escalon([[NA('I0.3'), NA('I0.2'), NA('M0.1')]], [B('reset', 'Q0.0')], [], 'Z2 de vuelta y la pieza expulsada: Z1 baja.'),
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

const TEMPORIZADOR = programa('Básico · Temporizador TON', 'tablero', T, [
  escalon([[NA('I0.4')]], [B('TON', 'T0', 3)], [], 'Con SEL1 activado, T0 cuenta 3 s (retardo a la conexión). Si lo sueltas antes, vuelve a cero.'),
  escalon([[NA('T0')]], [B('normal', 'Q0.0')], [], 'Cuando T0 termina, su contacto se cierra y enciende H1.'),
])

const INTERMITENTE = programa('Básico · Intermitente con dos TON', 'tablero', T, [
  escalon([[NA('I0.4'), NC('T1')]], [B('TON', 'T0', 0.5)], [], 'T0 cuenta medio segundo mientras SEL1 está activado y T1 no ha terminado.'),
  escalon([[NA('T0')]], [B('TON', 'T1', 0.5)], [], 'Cuando T0 termina, T1 cuenta otro medio segundo; al terminar corta a T0 y los dos vuelven a empezar.'),
  escalon([[NA('T0')]], [B('normal', 'Q0.2')], [], 'H3 se enciende mientras T0 está terminado: parpadea una vez por segundo.'),
])

const CONTADOR = programa('Básico · Contador CTU', 'tablero', T, [
  escalon([[NA('I0.2')]], [B('CTU', 'C0', 5)], [], 'Cada pulsación de P3 suma uno (cuenta el flanco de subida, no el tiempo pulsado).'),
  escalon([[NA('C0')]], [B('normal', 'Q0.3')], [], 'Al llegar a 5, C0 se activa y enciende H4.'),
  escalon([[NA('C0')], [NA('I0.0')]], [B('normal', 'Q0.6')], [[0, 1]], 'El zumbador suena con el contador lleno (o mientras pulsas MARCHA, para probarlo).'),
  escalon([[NA('I0.3')]], [B('reset', 'C0')], [], 'P4 pone el contador a cero.'),
])

export interface EjemploPLC {
  id: string
  etiqueta: string
  programa: ProgramaPLC
}

export const EJEMPLOS_PLC: EjemploPLC[] = [
  { id: 'ej1', etiqueta: 'Ejercicio 1 · Llenado y vaciado de tanque', programa: EJERCICIO1 },
  { id: 'ej2', etiqueta: 'Ejercicio 2 · Elevador de piezas', programa: EJERCICIO2 },
  { id: 'logica', etiqueta: 'Básico · Y, O, NO', programa: LOGICA },
  { id: 'marcha', etiqueta: 'Básico · Marcha y paro con autorretención', programa: MARCHA_PARO },
  { id: 'setreset', etiqueta: 'Básico · Set y Reset', programa: SET_RESET },
  { id: 'ton', etiqueta: 'Básico · Temporizador TON', programa: TEMPORIZADOR },
  { id: 'intermitente', etiqueta: 'Básico · Intermitente con dos TON', programa: INTERMITENTE },
  { id: 'contador', etiqueta: 'Básico · Contador CTU', programa: CONTADOR },
]
