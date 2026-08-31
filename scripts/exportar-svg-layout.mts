/**
 * Genera un SVG standalone del circuito CASCADA_ABC auto-orderado
 * (autoLayout + enrutado ortogonal) para inspección visual sin la UI.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CASCADA_ABC } from '../src/circuitos/cascada-abc'
import { autoLayout } from '../src/layout'
import { enrutarManguera } from '../src/routing'
import { DESCRIPTORES } from '../src/components/descriptores'

const aqui = dirname(fileURLToPath(import.meta.url))
const { piezas, area } = autoLayout(CASCADA_ABC.piezas, CASCADA_ABC.mangueras)
const byId = new Map(piezas.map((p) => [p.id, p]))

const partes: string[] = []
partes.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${area.x} ${area.y} ${area.ancho} ${area.alto}" width="1400" font-family="Inter, sans-serif">`)
partes.push(`<rect x="${area.x}" y="${area.y}" width="${area.ancho}" height="${area.alto}" fill="#f7f5ef"/>`)

// mangueras
for (const m of CASCADA_ABC.mangueras) {
  const pa = byId.get(m.a.componente)
  const pb = byId.get(m.b.componente)
  if (!pa || !pb) continue
  const d = enrutarManguera(piezas, pa, m.a, pb, m.b)
  partes.push(`<path d="${d}" fill="none" stroke="#2a323b" stroke-width="2.4"/>`)
}

// cajas + etiquetas + manometros de presión
for (const p of piezas) {
  const desc = DESCRIPTORES[p.tipo]
  partes.push(
    `<rect x="${p.x-4}" y="${p.y-4}" width="${desc.ancho+8}" height="${desc.alto+8}" rx="8" fill="#fffefa" stroke="#d8d3c6" stroke-width="1.5"/>`,
  )
  partes.push(
    `<text x="${p.x+desc.ancho/2}" y="${p.y-8}" font-size="12" font-weight="600" fill="#33475c" text-anchor="middle" style="paint-order:stroke;stroke:#fffefa;stroke-width:3">${p.id}</text>`,
  )
  // puertos
  for (const puerto of desc.puertos) {
    partes.push(`<circle cx="${p.x+puerto.x}" cy="${p.y+puerto.y}" r="4" fill="#fff" stroke="#2a323b" stroke-width="1.5"/>`)
  }
}
partes.push('</svg>')

const salida = join(aqui, '..', 'salida', 'circuito-abc-layout.svg')
writeFileSync(salida, partes.join('\n'), 'utf8')
console.log('OK', salida, `area=${Math.round(area.ancho)}x${Math.round(area.alto)}`)
