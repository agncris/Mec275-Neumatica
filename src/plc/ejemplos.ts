/**
 * Programas de ejemplo de la unidad de PLC: el ejercicio 1 del apunte y una
 * serie de programas básicos para ver cada instrucción funcionando. El
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

const TEMPORIZADOR = programa('Básico · Temporizador TON', 'tablero', T, [
  escalon([[NA('I0.4')]], [B('TON', 'T0', 3)], [], 'Con SEL1 activado, T0 cuenta 3 s (retardo a la conexión). Si lo sueltas antes, vuelve a cero.'),
  escalon([[NA('T0.DN')]], [B('normal', 'Q0.0')], [], 'Cuando T0 termina, su contacto se cierra y enciende H1.'),
])

const INTERMITENTE = programa('Básico · Intermitente con dos TON', 'tablero', T, [
  escalon([[NA('I0.4'), NC('T1.DN')]], [B('TON', 'T0', 0.5)], [], 'T0 cuenta medio segundo mientras SEL1 está activado y T1 no ha terminado.'),
  escalon([[NA('T0.DN')]], [B('TON', 'T1', 0.5)], [], 'Cuando T0 termina, T1 cuenta otro medio segundo; al terminar corta a T0 y los dos vuelven a empezar.'),
  escalon([[NA('T0.DN')]], [B('normal', 'Q0.2')], [], 'H3 se enciende mientras T0 está terminado: parpadea una vez por segundo.'),
])

const CONTADOR = programa('Básico · Contador CTU', 'tablero', T, [
  escalon([[NA('I0.2')]], [B('CTU', 'C0', 5)], [], 'Cada pulsación de P3 suma uno (cuenta el flanco de subida, no el tiempo pulsado).'),
  escalon([[NA('C0.DN')]], [B('normal', 'Q0.3')], [], 'Al llegar a 5, C0 se activa y enciende H4.'),
  escalon([[NA('C0.DN')], [NA('I0.0')]], [B('normal', 'Q0.6')], [[0, 1]], 'El zumbador suena con el contador lleno (o mientras pulsas MARCHA, para probarlo).'),
  escalon([[NA('I0.3')]], [B('reset', 'C0')], [], 'P4 pone el contador a cero.'),
])

// ---------------------------------------------------------------------------
// Semáforo y portón
// ---------------------------------------------------------------------------
const SEMAFORO = programa(
  'Semáforo con temporizadores encadenados',
  'semaforo',
  [
    ...PLANTAS.semaforo.cableado,
    { dir: 'M0.0', nombre: 'EN_MARCHA', descripcion: 'Marca: el cruce está funcionando' },
    { dir: 'T0', nombre: 'T_VERDE_NS', descripcion: 'Tiempo de verde Norte-Sur' },
    { dir: 'T1', nombre: 'T_AMAR_NS', descripcion: 'Tiempo de amarillo Norte-Sur' },
    { dir: 'T2', nombre: 'T_VERDE_EO', descripcion: 'Tiempo de verde Este-Oeste' },
    { dir: 'T3', nombre: 'T_AMAR_EO', descripcion: 'Tiempo de amarillo Este-Oeste' },
  ],
  [
    escalon([[NA('I0.0'), NC('I0.1')], [NA('M0.0')]], [B('normal', 'M0.0')], [[0, 1]], 'Marcha y paro con autorretención.'),
    escalon([[NA('M0.0'), NC('T3.DN')]], [B('TON', 'T0', 5)], [], 'Primer tiempo: verde Norte-Sur. Cuando termina el último temporizador, T0 se reinicia y el ciclo vuelve a empezar.'),
    escalon([[NA('T0.DN')]], [B('TON', 'T1', 2)], [], 'Al terminar T0 empieza el amarillo Norte-Sur.'),
    escalon([[NA('T1.DN')]], [B('TON', 'T2', 5)], [], 'Luego el verde Este-Oeste…'),
    escalon([[NA('T2.DN')]], [B('TON', 'T3', 2)], [], '…y el amarillo Este-Oeste.'),
    escalon([[NA('M0.0'), NC('T0.DN')]], [B('normal', 'Q0.2')], [], 'Verde NS mientras corre T0.'),
    escalon([[NA('T0.DN'), NC('T1.DN')]], [B('normal', 'Q0.1')], [], 'Amarillo NS mientras corre T1.'),
    escalon([[NA('T1.DN')], [NC('M0.0')]], [B('normal', 'Q0.0')], [[0, 1]], 'Rojo NS mientras la otra calle tiene paso, o con el cruce detenido.'),
    escalon([[NA('T1.DN'), NC('T2.DN')]], [B('normal', 'Q0.5')], [], 'Verde EO mientras corre T2.'),
    escalon([[NA('T2.DN'), NC('T3.DN')]], [B('normal', 'Q0.4')], [], 'Amarillo EO mientras corre T3.'),
    escalon([[NC('T1.DN')]], [B('normal', 'Q0.3')], [], 'Rojo EO mientras Norte-Sur tiene verde o amarillo (y con el cruce detenido).'),
  ],
)

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

const COMPARAR = programa('Básico · ONS, contador y comparaciones', 'tablero', T, [
  escalon([[NA('I0.2'), { tipo: 'ons' }]], [B('CTU', 'C0', 10)], [], 'Cada pulsación de P3 suma uno; el ONS asegura un solo pulso por pulsación.'),
  escalon([[{ tipo: 'comparar', op: 'GEQ', fuente: 'C0.ACC', valor: 3 }]], [B('normal', 'Q0.0')], [], 'H1 se enciende cuando la cuenta es mayor o igual a 3 (GEQ).'),
  escalon([[{ tipo: 'comparar', op: 'EQU', fuente: 'C0.ACC', valor: 5 }]], [B('normal', 'Q0.1')], [], 'H2 sólo mientras la cuenta vale exactamente 5 (EQU).'),
  escalon([[NA('I0.4')]], [B('RTO', 'T0', 4)], [], 'RTO: SEL1 acumula tiempo; si lo apagas guarda lo contado.'),
  escalon([[NA('T0.DN')]], [B('normal', 'Q0.2')], [], 'H3 al completar 4 s de SEL1 activado, sumando todas las veces.'),
  escalon([[NA('I0.3')], [NA('I0.3')]], [B('reset', 'C0'), B('reset', 'T0')], [], 'P4 reinicia el contador y el temporizador (RES).'),
])

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
  { id: 'ton', etiqueta: 'Básico · Temporizador TON', programa: TEMPORIZADOR },
  { id: 'intermitente', etiqueta: 'Básico · Intermitente con dos TON', programa: INTERMITENTE },
  { id: 'contador', etiqueta: 'Básico · Contador CTU', programa: CONTADOR },
  { id: 'comparar', etiqueta: 'Básico · ONS, contador y comparaciones (RTO)', programa: COMPARAR },
  { id: 'semaforo', etiqueta: 'Semáforo con temporizadores encadenados', programa: SEMAFORO },
  { id: 'porton', etiqueta: 'Portón con enclavamiento y fotocelda', programa: PORTON },
]
