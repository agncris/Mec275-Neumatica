/**
 * Geometría de cada ficha de la pizarra: tamaño del azulejo y posición de los
 * puertos en coordenadas locales. La usan los símbolos, el cableado y el
 * enrutado de mangueras.
 */
import type { Params } from '../engine'

export type Direccion = 'N' | 'S' | 'E' | 'O'

export interface PuertoGeom {
  id: string
  x: number
  y: number
  dir: Direccion
}

export interface Descriptor {
  tipo: string
  nombre: string
  ancho: number
  alto: number
  puertos: PuertoGeom[]
}

export const DESCRIPTORES: Record<string, Descriptor> = {
  fuente: {
    tipo: 'fuente',
    nombre: 'Compresor + FRL',
    ancho: 90,
    alto: 90,
    puertos: [{ id: '1', x: 90, y: 45, dir: 'E' }],
  },
  valvula32: {
    tipo: 'valvula32',
    nombre: 'Válvula 3/2',
    ancho: 140,
    alto: 100,
    puertos: [
      { id: '2', x: 90, y: 0, dir: 'N' },
      { id: '1', x: 80, y: 100, dir: 'S' },
      { id: '3', x: 100, y: 100, dir: 'S' },
    ],
  },
  finalCarrera: {
    tipo: 'finalCarrera',
    nombre: 'Final de carrera (rodillo)',
    ancho: 140,
    alto: 100,
    puertos: [
      { id: '2', x: 90, y: 0, dir: 'N' },
      { id: '1', x: 80, y: 100, dir: 'S' },
      { id: '3', x: 100, y: 100, dir: 'S' },
    ],
  },
  valvulaO: {
    tipo: 'valvulaO',
    nombre: 'Válvula selectora «O»',
    ancho: 90,
    alto: 80,
    puertos: [
      { id: 'A', x: 45, y: 0, dir: 'N' },
      { id: 'X', x: 25, y: 80, dir: 'S' },
      { id: 'Y', x: 65, y: 80, dir: 'S' },
    ],
  },
  valvulaY: {
    tipo: 'valvulaY',
    nombre: 'Válvula de simultaneidad «Y»',
    ancho: 90,
    alto: 80,
    puertos: [
      { id: 'A', x: 45, y: 0, dir: 'N' },
      { id: 'X', x: 25, y: 80, dir: 'S' },
      { id: 'Y', x: 65, y: 80, dir: 'S' },
    ],
  },
  escapeRapido: {
    tipo: 'escapeRapido',
    nombre: 'Válvula de escape rápido',
    ancho: 100,
    alto: 80,
    puertos: [
      { id: '1', x: 0, y: 40, dir: 'O' },
      { id: '2', x: 100, y: 40, dir: 'E' },
      { id: '3', x: 50, y: 0, dir: 'N' },
    ],
  },
  temporizador: {
    tipo: 'temporizador',
    nombre: 'Temporizador neumático',
    ancho: 175,
    alto: 110,
    puertos: [
      { id: '2', x: 110, y: 0, dir: 'N' },
      { id: '1', x: 100, y: 110, dir: 'S' },
      { id: '3', x: 120, y: 110, dir: 'S' },
      { id: '12', x: 0, y: 65, dir: 'O' },
    ],
  },
  valvula42: {
    tipo: 'valvula42',
    nombre: 'Válvula 4/2',
    ancho: 180,
    alto: 110,
    puertos: [
      { id: '4', x: 105, y: 0, dir: 'N' },
      { id: '2', x: 125, y: 0, dir: 'N' },
      { id: '1', x: 105, y: 110, dir: 'S' },
      { id: '3', x: 125, y: 110, dir: 'S' },
      { id: '14', x: 0, y: 55, dir: 'O' },
      { id: '12', x: 180, y: 55, dir: 'E' },
    ],
  },
  valvula52: {
    tipo: 'valvula52',
    nombre: 'Válvula 5/2',
    ancho: 190,
    alto: 110,
    puertos: [
      { id: '4', x: 105, y: 0, dir: 'N' },
      { id: '2', x: 125, y: 0, dir: 'N' },
      { id: '5', x: 95, y: 110, dir: 'S' },
      { id: '1', x: 115, y: 110, dir: 'S' },
      { id: '3', x: 135, y: 110, dir: 'S' },
      { id: '14', x: 0, y: 55, dir: 'O' },
      { id: '12', x: 190, y: 55, dir: 'E' },
    ],
  },
  cilindroSimpleEfecto: {
    tipo: 'cilindroSimpleEfecto',
    nombre: 'Cilindro simple efecto',
    ancho: 195,
    alto: 80,
    puertos: [{ id: '1', x: 30, y: 80, dir: 'S' }],
  },
  cilindroDobleEfecto: {
    tipo: 'cilindroDobleEfecto',
    nombre: 'Cilindro doble efecto',
    ancho: 225,
    alto: 80,
    puertos: [
      { id: 'A', x: 30, y: 80, dir: 'S' },
      { id: 'B', x: 120, y: 80, dir: 'S' },
    ],
  },
  reguladorCaudal: {
    tipo: 'reguladorCaudal',
    nombre: 'Regulador de caudal',
    ancho: 100,
    alto: 70,
    puertos: [
      { id: '1', x: 0, y: 35, dir: 'O' },
      { id: '2', x: 100, y: 35, dir: 'E' },
    ],
  },
}

/** Puertos visibles según los parámetros (los pilotajes de la 5/2 dependen del modo). */
export function puertosVisibles(tipo: string, params: Params): PuertoGeom[] {
  const desc = DESCRIPTORES[tipo]
  if (!desc) return []
  if (tipo !== 'valvula52' && tipo !== 'valvula42') return desc.puertos
  const biestable = params.modo === 'biestable'
  const pilotaje = params.accionamiento === 'pilotaje'
  return desc.puertos.filter((p) => {
    if (p.id === '14') return biestable || pilotaje
    if (p.id === '12') return biestable
    return true
  })
}

export const VECTOR_DIR: Record<Direccion, [number, number]> = {
  N: [0, -1],
  S: [0, 1],
  E: [1, 0],
  O: [-1, 0],
}
