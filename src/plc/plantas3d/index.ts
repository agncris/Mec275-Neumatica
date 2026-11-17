import { escenaElevador } from './elevador'
import { escenaEstanque } from './estanque'
import { escenaPorton } from './porton'
import { escenaSemaforo } from './semaforo'
import { escenaSilo } from './silo'
import { escenaTablero } from './tablero'
import type { Escena } from './comun'

/** La escena 3D de la planta con ese id (el tablero de pruebas si no lo conoce). */
export function crearEscena(id: string): Escena {
  if (id === 'estanque') return escenaEstanque()
  if (id === 'elevador') return escenaElevador()
  if (id === 'silo') return escenaSilo()
  if (id === 'semaforo') return escenaSemaforo()
  if (id === 'porton') return escenaPorton()
  return escenaTablero()
}
