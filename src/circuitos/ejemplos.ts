/**
 * Los seis circuitos de ejemplo que trae la aplicación. Viven aquí (y no
 * dentro del store) para que el auto-orden del plano pueda medirse sobre
 * todos ellos en las pruebas.
 */
import type { Manguera } from '../engine'
import type { Pieza } from '../store'

export type NumeroEjemplo = 1 | 2 | 3 | 4 | 5 | 6

export interface CircuitoEjemplo {
  piezas: Pieza[]
  mangueras: Manguera[]
}

export const EJEMPLOS: Record<NumeroEjemplo, CircuitoEjemplo> = {
  // Cilindro de simple efecto con 3/2 de pulsador
  1: {
    piezas: [
      { id: 'F1', tipo: 'fuente', x: 60, y: 330, params: { presion: 6, encendida: true } },
      { id: 'V1', tipo: 'valvula32', x: 300, y: 280, params: { reposo: 'NC', accionamiento: 'pulsador' } },
      { id: 'C1', tipo: 'cilindroSimpleEfecto', x: 330, y: 90, params: {} },
    ],
    mangueras: [
      { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
      { id: 'm2', a: { componente: 'V1', puerto: '2' }, b: { componente: 'C1', puerto: '1' } },
    ],
  },
  // Doble efecto con 5/2 monoestable y regulador de caudal en el escape de B
  2: {
    piezas: [
      { id: 'F1', tipo: 'fuente', x: 50, y: 350, params: { presion: 6, encendida: true } },
      { id: 'V1', tipo: 'valvula52', x: 290, y: 320, params: { modo: 'monoestable', accionamiento: 'pulsador' } },
      { id: 'C1', tipo: 'cilindroDobleEfecto', x: 300, y: 90, params: {} },
      { id: 'R1', tipo: 'reguladorCaudal', x: 620, y: 200, params: { apertura: 0.3 } },
    ],
    mangueras: [
      { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
      { id: 'm2', a: { componente: 'V1', puerto: '4' }, b: { componente: 'C1', puerto: 'A' } },
      { id: 'm3', a: { componente: 'C1', puerto: 'B' }, b: { componente: 'R1', puerto: '1' } },
      { id: 'm4', a: { componente: 'R1', puerto: '2' }, b: { componente: 'V1', puerto: '2' } },
    ],
  },
  // Biestable pilotada por dos 3/2 de pulsador (marcha / retorno)
  3: {
    piezas: [
      { id: 'F1', tipo: 'fuente', x: 40, y: 350, params: { presion: 6, encendida: true } },
      { id: 'V2', tipo: 'valvula32', x: 220, y: 400, params: { reposo: 'NC' } },
      { id: 'V3', tipo: 'valvula32', x: 640, y: 400, params: { reposo: 'NC' } },
      { id: 'V1', tipo: 'valvula52', x: 380, y: 230, params: { modo: 'biestable' } },
      { id: 'C1', tipo: 'cilindroDobleEfecto', x: 380, y: 60, params: {} },
    ],
    mangueras: [
      { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
      { id: 'm2', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V2', puerto: '1' } },
      { id: 'm3', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V3', puerto: '1' } },
      { id: 'm4', a: { componente: 'V2', puerto: '2' }, b: { componente: 'V1', puerto: '14' } },
      { id: 'm5', a: { componente: 'V3', puerto: '2' }, b: { componente: 'V1', puerto: '12' } },
      { id: 'm6', a: { componente: 'V1', puerto: '4' }, b: { componente: 'C1', puerto: 'A' } },
      { id: 'm7', a: { componente: 'V1', puerto: '2' }, b: { componente: 'C1', puerto: 'B' } },
    ],
  },
  // Ciclo automático ida-vuelta con dos finales de carrera y 5/2 biestable
  4: {
    piezas: [
      { id: 'F1', tipo: 'fuente', x: 40, y: 350, params: { presion: 6, encendida: true } },
      { id: 'S1', tipo: 'finalCarrera', x: 200, y: 400, params: { reposo: 'NC', cilindro: 'C1', puntoDisparo: 0 } },
      { id: 'S2', tipo: 'finalCarrera', x: 660, y: 400, params: { reposo: 'NC', cilindro: 'C1', puntoDisparo: 1 } },
      { id: 'V1', tipo: 'valvula52', x: 390, y: 230, params: { modo: 'biestable' } },
      { id: 'C1', tipo: 'cilindroDobleEfecto', x: 380, y: 60, params: {} },
    ],
    mangueras: [
      { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
      { id: 'm2', a: { componente: 'F1', puerto: '1' }, b: { componente: 'S1', puerto: '1' } },
      { id: 'm3', a: { componente: 'F1', puerto: '1' }, b: { componente: 'S2', puerto: '1' } },
      { id: 'm4', a: { componente: 'S1', puerto: '2' }, b: { componente: 'V1', puerto: '14' } },
      { id: 'm5', a: { componente: 'S2', puerto: '2' }, b: { componente: 'V1', puerto: '12' } },
      { id: 'm6', a: { componente: 'V1', puerto: '4' }, b: { componente: 'C1', puerto: 'A' } },
      { id: 'm7', a: { componente: 'V1', puerto: '2' }, b: { componente: 'C1', puerto: 'B' } },
    ],
  },
  // Mando bimanual: dos pulsadores + válvula de simultaneidad «Y»
  5: {
    piezas: [
      { id: 'F1', tipo: 'fuente', x: 40, y: 400, params: { presion: 6, encendida: true } },
      { id: 'V2', tipo: 'valvula32', x: 200, y: 430, params: { reposo: 'NC' } },
      { id: 'V3', tipo: 'valvula32', x: 420, y: 430, params: { reposo: 'NC' } },
      { id: 'Y1', tipo: 'valvulaY', x: 290, y: 320, params: {} },
      { id: 'V1', tipo: 'valvula52', x: 250, y: 180, params: { modo: 'monoestable', accionamiento: 'pilotaje' } },
      { id: 'C1', tipo: 'cilindroDobleEfecto', x: 620, y: 60, params: {} },
    ],
    mangueras: [
      { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
      { id: 'm2', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V2', puerto: '1' } },
      { id: 'm3', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V3', puerto: '1' } },
      { id: 'm4', a: { componente: 'V2', puerto: '2' }, b: { componente: 'Y1', puerto: 'X' } },
      { id: 'm5', a: { componente: 'V3', puerto: '2' }, b: { componente: 'Y1', puerto: 'Y' } },
      { id: 'm6', a: { componente: 'Y1', puerto: 'A' }, b: { componente: 'V1', puerto: '14' } },
      { id: 'm7', a: { componente: 'V1', puerto: '4' }, b: { componente: 'C1', puerto: 'A' } },
      { id: 'm8', a: { componente: 'V1', puerto: '2' }, b: { componente: 'C1', puerto: 'B' } },
    ],
  },
  // Encadenar dos cilindros: al llegar C1 al final de carrera, su rodillo
  // pilota la válvula que mueve C2.
  6: {
    piezas: [
      { id: 'F1', tipo: 'fuente', x: 40, y: 460, params: { presion: 6, encendida: true } },
      { id: 'V1', tipo: 'valvula32', x: 150, y: 250, params: { reposo: 'NC', accionamiento: 'pulsador' } },
      { id: 'C1', tipo: 'cilindroSimpleEfecto', x: 150, y: 70, params: {} },
      { id: 'S1', tipo: 'finalCarrera', x: 380, y: 375, params: { reposo: 'NC', cilindro: 'C1', puntoDisparo: 1 } },
      { id: 'V2', tipo: 'valvula52', x: 620, y: 230, params: { modo: 'monoestable', accionamiento: 'pilotaje' } },
      { id: 'C2', tipo: 'cilindroDobleEfecto', x: 620, y: 70, params: {} },
    ],
    mangueras: [
      { id: 'm1', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V1', puerto: '1' } },
      { id: 'm2', a: { componente: 'V1', puerto: '2' }, b: { componente: 'C1', puerto: '1' } },
      // El rodillo es una válvula más: necesita su propia alimentación
      { id: 'm3', a: { componente: 'F1', puerto: '1' }, b: { componente: 'S1', puerto: '1' } },
      // …y su salida es la señal que pilota la segunda válvula
      { id: 'm4', a: { componente: 'S1', puerto: '2' }, b: { componente: 'V2', puerto: '14' } },
      { id: 'm5', a: { componente: 'F1', puerto: '1' }, b: { componente: 'V2', puerto: '1' } },
      { id: 'm6', a: { componente: 'V2', puerto: '4' }, b: { componente: 'C2', puerto: 'A' } },
      { id: 'm7', a: { componente: 'V2', puerto: '2' }, b: { componente: 'C2', puerto: 'B' } },
    ],
  },
}
