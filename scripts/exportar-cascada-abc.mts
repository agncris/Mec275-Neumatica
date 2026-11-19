/** Genera el .json del circuito CASCADA_ABC para abrirlo con «Abrir». */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CASCADA_ABC } from '../src/circuitos/cascada-abc'

const aqui = dirname(fileURLToPath(import.meta.url))
const salida = join(aqui, '..', 'salida', 'cascada-abc-tres-grupos.json')

const json = {
  version: 1,
  nombre: 'Cascada tres grupos A B C (A+ B+ | B− A− C+ | C−)',
  piezas: CASCADA_ABC.piezas,
  mangueras: CASCADA_ABC.mangueras,
}

writeFileSync(salida, JSON.stringify(json, null, 2), 'utf8')
console.log(`OK ${salida} (${CASCADA_ABC.piezas.length} piezas, ${CASCADA_ABC.mangueras.length} mangueras)`)
