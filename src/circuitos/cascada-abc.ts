/**
 * Circuito del ejercicio «Cascada de tres grupos A, B, C» (secuencia
 * A+ B+ | B− A− C+ | C−), recreado con la disposición de un esquema técnico
 * neumático normalizado:
 *
 *   · actuadores arriba (dos cilindros de doble efecto y un actuador giratorio),
 *   · sus válvulas 5/2 de potencia inmediatamente debajo,
 *   · las líneas de grupo G1, G2, G3 (generadas por las válvulas de cascada
 *     K1 y K2) cruzando la zona central, con su manómetro cada una,
 *   · los seis sensores A0, A1, B0, B1, C0, C1 repartidos por la zona media,
 *   · el botón START y la fuente con FRL en la zona inferior.
 *
 * Cualquier alumno lo puede cargar con «Abrir» (o desde el botón de la sección)
 * y comprobar que el ciclo se repite: A+ B+ → B− A− C+ → C− → vuelta a G1.
 */
import type { Manguera } from '../engine'
import type { Pieza } from '../store'

export interface CircuitoPreparado {
  piezas: Pieza[]
  mangueras: Manguera[]
}

const r = (componente: string, puerto: string) => ({ componente, puerto })

const piezas: Pieza[] = [
  // --- Actuadores (parte superior, izquierda → derecha) -------------------
  { id: 'CA', tipo: 'cilindroDobleEfecto', x: 50, y: 15, params: {} },
  { id: 'CB', tipo: 'cilindroDobleEfecto', x: 430, y: 15, params: {} },
  { id: 'CC', tipo: 'actuadorGiratorio', x: 830, y: 15, params: { angulo: 180 } },

  // --- Válvulas de potencia 5/2 (inmediatamente debajo de cada actuador) ---
  { id: 'VA', tipo: 'valvula52', x: 60, y: 135, params: { modo: 'biestable' } },
  { id: 'VB', tipo: 'valvula52', x: 440, y: 135, params: { modo: 'biestable' } },
  { id: 'VC', tipo: 'valvula52', x: 840, y: 135, params: { modo: 'biestable' } },

  // --- Sensores de posición (zona central, válvulas 3/2 de rodillo) --------
  // A0 = retraído, A1 = extendido
  { id: 'A0', tipo: 'finalCarrera', x: 20, y: 300, params: { reposo: 'NC', cilindro: 'CA', puntoDisparo: 0 } },
  { id: 'A1', tipo: 'finalCarrera', x: 210, y: 300, params: { reposo: 'NC', cilindro: 'CA', puntoDisparo: 1 } },
  // B0 = retraído, B1 = extendido
  { id: 'B0', tipo: 'finalCarrera', x: 390, y: 300, params: { reposo: 'NC', cilindro: 'CB', puntoDisparo: 0 } },
  { id: 'B1', tipo: 'finalCarrera', x: 580, y: 300, params: { reposo: 'NC', cilindro: 'CB', puntoDisparo: 1 } },
  // C0 = inicial, C1 = final
  { id: 'C0', tipo: 'finalCarrera', x: 770, y: 300, params: { reposo: 'NC', cilindro: 'CC', puntoDisparo: 0 } },
  { id: 'C1', tipo: 'finalCarrera', x: 960, y: 300, params: { reposo: 'NC', cilindro: 'CC', puntoDisparo: 1 } },

  // --- Botón START (3/2 pulsador manual, retorno por muelle) ----------------
  { id: 'START', tipo: 'valvula32', x: 1150, y: 300, params: { reposo: 'NC', accionamiento: 'pulsador' } },

  // --- Válvulas de cascada K1 y K2 (5/2 biestables, zona inferior-central) --
  { id: 'K1', tipo: 'valvula52', x: 250, y: 470, params: { modo: 'biestable' } },
  { id: 'K2', tipo: 'valvula52', x: 620, y: 470, params: { modo: 'biestable' } },

  // --- Manómetros de las líneas de grupo G1, G2, G3 -------------------------
  { id: 'G1', tipo: 'manometro', x: 250, y: 375, params: {} },
  { id: 'G2', tipo: 'manometro', x: 620, y: 375, params: {} },
  { id: 'G3', tipo: 'manometro', x: 990, y: 375, params: {} },

  // --- Alimentación (zona inferior): compresor + FRL ------------------------
  { id: 'F1', tipo: 'fuente', x: 30, y: 560, params: { presion: 6, encendida: true } },
]

const mangueras: Manguera[] = [
  // --- Potencia: alimentación de cada 5/2 y conexión a su actuador ----------
  { id: 'pA1', a: r('F1', '1'), b: r('VA', '1') },
  { id: 'pA2', a: r('VA', '4'), b: r('CA', 'A') },
  { id: 'pA3', a: r('VA', '2'), b: r('CA', 'B') },
  { id: 'pB1', a: r('F1', '1'), b: r('VB', '1') },
  { id: 'pB2', a: r('VB', '4'), b: r('CB', 'A') },
  { id: 'pB3', a: r('VB', '2'), b: r('CB', 'B') },
  { id: 'pC1', a: r('F1', '1'), b: r('VC', '1') },
  { id: 'pC2', a: r('VC', '4'), b: r('CC', 'A') },
  { id: 'pC3', a: r('VC', '2'), b: r('CC', 'B') },

  // --- Cadena de cascada: F1 → K2 ; K2 en reposo alimenta a K1 --------------
  // G3 = K2:4 (accionada) · G2 = K1:4 (accionada) · G1 = K1:2 (reposo)
  { id: 'k1', a: r('F1', '1'), b: r('K2', '1') },
  { id: 'k2', a: r('K2', '2'), b: r('K1', '1') },

  // --- Manómetros de las líneas de grupo -------------------------------------
  { id: 'mG1', a: r('G1', '1'), b: r('K1', '2') },
  { id: 'mG2', a: r('G2', '1'), b: r('K1', '4') },
  { id: 'mG3', a: r('G3', '1'), b: r('K2', '4') },

  // --- GRUPO G1 (línea K1:2): A+ B+ → conmutar a G2 -------------------------
  { id: 'g1K1VA', a: r('K1', '2'), b: r('VA', '14') }, // primer movimiento G1: A+
  { id: 'g1a1', a: r('K1', '2'), b: r('A1', '1') }, // A1 alimentado desde G1
  { id: 'g1A1VB', a: r('A1', '2'), b: r('VB', '14') }, // A1 → B+ (segundo movimiento G1)
  { id: 'g1b1', a: r('K1', '2'), b: r('B1', '1') }, // B1 alimentado desde G1
  { id: 'g1B1K2', a: r('B1', '2'), b: r('K1', '14') }, // B1 → conmuta la cascada a G2

  // --- GRUPO G2 (línea K1:4): B− A− C+ → conmutar a G3 ----------------------
  { id: 'g2VB12', a: r('K1', '4'), b: r('VB', '12') }, // primer movimiento G2: B−
  { id: 'g2b0', a: r('K1', '4'), b: r('B0', '1') }, // B0 alimentado desde G2
  { id: 'g2B0VA', a: r('B0', '2'), b: r('VA', '12') }, // B0 → A− (segundo movimiento G2)
  { id: 'g2a0', a: r('K1', '4'), b: r('A0', '1') }, // A0 alimentado desde G2
  { id: 'g2A0VC', a: r('A0', '2'), b: r('VC', '14') }, // A0 → C+ (tercer movimiento G2)
  { id: 'g2c1', a: r('K1', '4'), b: r('C1', '1') }, // C1 alimentado desde G2
  { id: 'g2C1K2', a: r('C1', '2'), b: r('K2', '14') }, // C1 → conmuta la cascada a G3

  // --- GRUPO G3 (línea K2:4): C− y vuelta al grupo G1 ------------------------
  { id: 'g3VC12', a: r('K2', '4'), b: r('VC', '12') }, // único movimiento G3: C−
  { id: 'g3c0', a: r('K2', '4'), b: r('C0', '1') }, // C0 alimentado desde G3
  { id: 'g3STARTK2', a: r('C0', '2'), b: r('START', '1') }, // C0 → START (cierra el ciclo)
  { id: 'g3start2K2', a: r('START', '2'), b: r('K2', '12') }, // START → repone K2, pasa a G1
  { id: 'g3start2K1', a: r('START', '2'), b: r('K1', '12') }, // START → repone K1, vuelve la cascada a G1
]

export const CASCADA_ABC: CircuitoPreparado = { piezas, mangueras }
