/**
 * Circuitos de los ejercicios del curso MEC275.
 *
 * El de la Actividad 2 / Evaluación N.º 1 es el de secuencia A+B+ | B−A−C+ | C−
 * resuelto por cascada de tres grupos: dos cilindros de doble efecto, un
 * actuador giratorio, seis finales de carrera, una marcha manual y dos válvulas
 * de cascada encadenadas.
 */
import type { Manguera } from '../engine'
import type { Pieza } from '../store'
import type { CircuitoPreparado } from './cascada'

const r = (componente: string, puerto: string) => ({ componente, puerto })

const piezas: Pieza[] = [
  // Actuadores
  { id: 'CA', tipo: 'cilindroDobleEfecto', x: 40, y: 10, params: {} },
  { id: 'CB', tipo: 'cilindroDobleEfecto', x: 420, y: 10, params: {} },
  { id: 'CC', tipo: 'actuadorGiratorio', x: 870, y: 10, params: { angulo: 180 } },
  // Válvulas de potencia (una por actuador)
  { id: 'VA', tipo: 'valvula52', x: 60, y: 140, params: { modo: 'biestable' } },
  { id: 'VB', tipo: 'valvula52', x: 440, y: 140, params: { modo: 'biestable' } },
  { id: 'VC', tipo: 'valvula52', x: 830, y: 140, params: { modo: 'biestable' } },
  // Elementos de señal
  { id: 'a1', tipo: 'finalCarrera', x: 20, y: 300, params: { reposo: 'NC', cilindro: 'CA', puntoDisparo: 1 } },
  { id: 'b1', tipo: 'finalCarrera', x: 190, y: 300, params: { reposo: 'NC', cilindro: 'CB', puntoDisparo: 1 } },
  { id: 'b0', tipo: 'finalCarrera', x: 360, y: 300, params: { reposo: 'NC', cilindro: 'CB', puntoDisparo: 0 } },
  { id: 'a0', tipo: 'finalCarrera', x: 530, y: 300, params: { reposo: 'NC', cilindro: 'CA', puntoDisparo: 0 } },
  { id: 'c1', tipo: 'finalCarrera', x: 700, y: 300, params: { reposo: 'NC', cilindro: 'CC', puntoDisparo: 1 } },
  { id: 'c0', tipo: 'finalCarrera', x: 870, y: 300, params: { reposo: 'NC', cilindro: 'CC', puntoDisparo: 0 } },
  { id: 'M', tipo: 'valvula32', x: 1050, y: 300, params: { reposo: 'NC', accionamiento: 'pulsador' } },
  // Cascada y alimentación
  { id: 'K1', tipo: 'valvula52', x: 330, y: 470, params: { modo: 'biestable' } },
  { id: 'K2', tipo: 'valvula52', x: 620, y: 470, params: { modo: 'biestable' } },
  { id: 'F1', tipo: 'fuente', x: 40, y: 500, params: { presion: 6, encendida: true } },
]

const mangueras: Manguera[] = [
  // --- potencia -----------------------------------------------------------
  { id: 'p1', a: r('F1', '1'), b: r('VA', '1') },
  { id: 'p2', a: r('VA', '4'), b: r('CA', 'A') },
  { id: 'p3', a: r('VA', '2'), b: r('CA', 'B') },
  { id: 'p4', a: r('F1', '1'), b: r('VB', '1') },
  { id: 'p5', a: r('VB', '4'), b: r('CB', 'A') },
  { id: 'p6', a: r('VB', '2'), b: r('CB', 'B') },
  { id: 'p7', a: r('F1', '1'), b: r('VC', '1') },
  { id: 'p8', a: r('VC', '4'), b: r('CC', 'A') },
  { id: 'p9', a: r('VC', '2'), b: r('CC', 'B') },

  // --- cadena de cascada: F1 → K2 ; K2 en reposo alimenta a K1 -------------
  // Líneas de grupo:  L1 = K1:2 · L2 = K1:4 · L3 = K2:4
  { id: 'k1', a: r('F1', '1'), b: r('K2', '1') },
  { id: 'k2', a: r('K2', '2'), b: r('K1', '1') },

  // --- GRUPO I (L1): A+ B+ -------------------------------------------------
  { id: 'g1', a: r('K1', '2'), b: r('VA', '14') },
  { id: 'g2', a: r('K1', '2'), b: r('a1', '1') },
  { id: 'g3', a: r('a1', '2'), b: r('VB', '14') },
  { id: 'g4', a: r('K1', '2'), b: r('b1', '1') },
  { id: 'g5', a: r('b1', '2'), b: r('K1', '14') },

  // --- GRUPO II (L2): B− A− C+ --------------------------------------------
  { id: 'h1', a: r('K1', '4'), b: r('VB', '12') },
  { id: 'h2', a: r('K1', '4'), b: r('b0', '1') },
  { id: 'h3', a: r('b0', '2'), b: r('VA', '12') },
  { id: 'h4', a: r('K1', '4'), b: r('a0', '1') },
  { id: 'h5', a: r('a0', '2'), b: r('VC', '14') },
  { id: 'h6', a: r('K1', '4'), b: r('c1', '1') },
  { id: 'h7', a: r('c1', '2'), b: r('K2', '14') },

  // --- GRUPO III (L3): C− y vuelta al grupo I ------------------------------
  { id: 'j1', a: r('K2', '4'), b: r('VC', '12') },
  { id: 'j2', a: r('K2', '4'), b: r('c0', '1') },
  { id: 'j3', a: r('c0', '2'), b: r('M', '1') },
  // la marcha repone las dos válvulas de cascada a la vez
  { id: 'j4', a: r('M', '2'), b: r('K2', '12') },
  { id: 'j5', a: r('M', '2'), b: r('K1', '12') },
]

export const CIRCUITO_TRES_GRUPOS: CircuitoPreparado = { piezas, mangueras }
