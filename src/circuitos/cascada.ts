/**
 * Los dos circuitos de la sección «Método cascada», con la secuencia
 * A+ B+ B− A−. Se dibujan con la disposición convencional de los esquemas
 * neumáticos: actuadores arriba, válvulas de potencia debajo, elementos de
 * señal abajo y la alimentación al pie.
 */
import type { Manguera } from '../engine'
import type { Pieza } from '../store'

export interface CircuitoPreparado {
  piezas: Pieza[]
  mangueras: Manguera[]
}

const r = (componente: string, puerto: string) => ({ componente, puerto })

/** Cilindros, sus válvulas biestables, los cuatro rodillos y la marcha. */
function piezasComunes(): Pieza[] {
  return [
    { id: 'CA', tipo: 'cilindroDobleEfecto', x: 90, y: 20, params: {} },
    { id: 'CB', tipo: 'cilindroDobleEfecto', x: 560, y: 20, params: {} },
    { id: 'VA', tipo: 'valvula52', x: 110, y: 140, params: { modo: 'biestable' } },
    { id: 'VB', tipo: 'valvula52', x: 580, y: 140, params: { modo: 'biestable' } },
    { id: 'a1', tipo: 'finalCarrera', x: 30, y: 300, params: { reposo: 'NC', cilindro: 'CA', puntoDisparo: 1 } },
    { id: 'b1', tipo: 'finalCarrera', x: 200, y: 300, params: { reposo: 'NC', cilindro: 'CB', puntoDisparo: 1 } },
    { id: 'b0', tipo: 'finalCarrera', x: 450, y: 300, params: { reposo: 'NC', cilindro: 'CB', puntoDisparo: 0 } },
    { id: 'a0', tipo: 'finalCarrera', x: 620, y: 300, params: { reposo: 'NC', cilindro: 'CA', puntoDisparo: 0 } },
    { id: 'M', tipo: 'valvula32', x: 810, y: 300, params: { reposo: 'NC', accionamiento: 'pulsador' } },
    { id: 'F1', tipo: 'fuente', x: 30, y: 455, params: { presion: 6, encendida: true } },
  ]
}

/** Alimentación de las válvulas de potencia y conexión a los cilindros. */
function potencia(): Manguera[] {
  return [
    { id: 'p1', a: r('F1', '1'), b: r('VA', '1') },
    { id: 'p2', a: r('VA', '4'), b: r('CA', 'A') },
    { id: 'p3', a: r('VA', '2'), b: r('CA', 'B') },
    { id: 'p4', a: r('F1', '1'), b: r('VB', '1') },
    { id: 'p5', a: r('VB', '4'), b: r('CB', 'A') },
    { id: 'p6', a: r('VB', '2'), b: r('CB', 'B') },
  ]
}

/**
 * El montaje que NO funciona: los cuatro finales de carrera cuelgan
 * directamente de la red, así que sus señales nunca desaparecen.
 */
export const CIRCUITO_BLOQUEADO: CircuitoPreparado = {
  piezas: piezasComunes(),
  mangueras: [
    ...potencia(),
    // Todos los emisores de señal, alimentados de la red
    { id: 's1', a: r('F1', '1'), b: r('a1', '1') },
    { id: 's2', a: r('F1', '1'), b: r('b1', '1') },
    { id: 's3', a: r('F1', '1'), b: r('b0', '1') },
    { id: 's4', a: r('F1', '1'), b: r('a0', '1') },
    { id: 's5', a: r('a0', '2'), b: r('M', '1') },
    // marcha·a0 → A+ ; a1 → B+ ; b1 → B− ; b0 → A−
    { id: 's6', a: r('M', '2'), b: r('VA', '14') },
    { id: 's7', a: r('a1', '2'), b: r('VB', '14') },
    { id: 's8', a: r('b1', '2'), b: r('VB', '12') },
    { id: 's9', a: r('b0', '2'), b: r('VA', '12') },
  ],
}

/**
 * El mismo circuito resuelto por cascada: una válvula biestable reparte el
 * aire entre la línea del grupo I (A+ B+) y la del grupo II (B− A−).
 */
export const CIRCUITO_CASCADA: CircuitoPreparado = {
  piezas: [
    ...piezasComunes(),
    { id: 'VC', tipo: 'valvula52', x: 300, y: 440, params: { modo: 'biestable' } },
  ],
  mangueras: [
    ...potencia(),
    { id: 'c1', a: r('F1', '1'), b: r('VC', '1') },

    // --- Grupo I: línea L1 = VC:4 → A+ B+ ---
    { id: 'g1', a: r('VC', '4'), b: r('VA', '14') },
    { id: 'g2', a: r('VC', '4'), b: r('a1', '1') },
    { id: 'g3', a: r('a1', '2'), b: r('VB', '14') },
    { id: 'g4', a: r('VC', '4'), b: r('b1', '1') },
    { id: 'g5', a: r('b1', '2'), b: r('VC', '12') },

    // --- Grupo II: línea L2 = VC:2 → B− A− ---
    { id: 'h1', a: r('VC', '2'), b: r('VB', '12') },
    { id: 'h2', a: r('VC', '2'), b: r('b0', '1') },
    { id: 'h3', a: r('b0', '2'), b: r('VA', '12') },
    { id: 'h4', a: r('VC', '2'), b: r('a0', '1') },
    { id: 'h5', a: r('a0', '2'), b: r('M', '1') },
    { id: 'h6', a: r('M', '2'), b: r('VC', '14') },
  ],
}
