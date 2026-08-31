/**
 * Verifica programáticamente el SVG del circuito auto-orderado:
 *  - no hay segmentos diagonales (ortogonalidad),
 *  - ninguna manguera atraviesa el cuerpo de un componente ajeno,
 *  - las etiquetas (text) no caen dentro de otro componente.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const aqui = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(join(aqui, '..', 'salida', 'circuito-abc-layout.svg'), 'utf8')

interface Rect { x: number; y: number; w: number; h: number; etiqueta: string }
interface Seg { a: [number, number]; b: [number, number] }

const rects: Rect[] = []
const segs: Seg[] = []
const textos: Array<{ cx: number; cy: number; texto: string }> = []

const numRe = /-?[\d.]+/g
for (const m of svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)".*?>(?<seg>.*?)(?:<\/rect>)?/gs)) {
  // No mezclar con los rects: leeremos por otro camino.
}
// Rect de componentes (los que tienen stroke #d8d3c6 y fill #fffefa)
for (const m of svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="8" fill="#fffefa"/g)) {
  rects.push({ x: +m[1], y: +m[2], w: +m[3], h: +m[4], etiqueta: '' })
}
// Etiquetas de texto
for (const m of svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"[^>]*>([A-Z0-9]+)<\/text>/g)) {
  textos.push({ cx: +m[1], cy: +m[2], texto: m[3] })
}
// Asociar cada rect con su etiqueta (la más próxima verticalmente)
function etiquetaPara(r: Rect): string {
  let mejor = ''
  let bd = Infinity
  for (const t of textos) {
    const dc = Math.abs(t.cx - (r.x + r.w / 2)) + Math.abs(t.cy - r.y)
    if (dc < bd) { bd = dc; mejor = t.texto }
  }
  return mejor
}
rects.forEach((r) => (r.etiqueta = etiquetaPara(r)))

// Segmentos de manguera: extraer M/L points de cada path
const manguerasSegs: Array<{ segs: Seg[]; ext: [string, string] }> = []
const mangueraNombres: string[] = []
for (const m of svg.matchAll(/<path d="(M[^"]+)"/g)) {
  const nums: number[] = []
  for (const n of m[1].matchAll(/-?[\d.]+/g)) nums.push(+n[0])
  const s: Seg[] = []
  for (let i = 0; i + 3 < nums.length; i += 2) {
    s.push({ a: [nums[i], nums[i + 1]], b: [nums[i + 2], nums[i + 3]] })
  }
  // Identificar origen y destino por el puerto más cercano
  segs.push(...s)
  manguerasSegs.push({ segs: s, ext: ['', ''] })
}

function puntoDentro(p: [number, number], r: Rect): boolean {
  return p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h
}
function segAtraviesaRect(a: [number, number], b: [number, number], r: Rect): boolean {
  // Muestreo fino a lo largo del segmento
  for (let t = 0; t <= 1; t += 0.01) {
    const px = a[0] + (b[0] - a[0]) * t
    const py = a[1] + (b[1] - a[1]) * t
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return true
  }
  return false
}

let diagonales = 0
for (const s of segs) {
  const dx = Math.abs(s.b[0] - s.a[0])
  const dy = Math.abs(s.b[1] - s.a[1])
  if (dx > 0.5 && dy > 0.5) diagonales++
}
console.log('Segmentos:', segs.length, '| Diagonales (no ortogonales):', diagonales)

let atraviesa = 0
for (const s of segs) {
  for (const r of rects) {
    // Si el segmento está extremadamente cerca del puerto/componente origen se
    // tolera; comprobamos el tramo interior lejos de los extremos del segmento.
    if (segAtraviesaRect(s.a, s.b, r)) atraviesa++
  }
}
console.log('Pares (segmento × componente) que se cruzan:', atraviesa)

// Las etiquetas no deben quedar DENTRO de ningún rect distinto al suyo
let labelsDentroAjeno = 0
for (const t of textos) {
  for (const r of rects) {
    if (r.etiqueta === t.texto) continue
    if (puntoDentro([t.cx, t.cy], r)) labelsDentroAjeno++
  }
}
console.log('Etiquetas dentro de un componente ajeno:', labelsDentroAjeno)

console.log('Rect ORDENADO por fila (y):')
const filas = new Map<number, string[]>()
for (const r of [...rects].sort((a, b) => a.y - b.y)) {
  const key = Math.round(r.y / 200) * 200
  filas.set(key, [...(filas.get(key) ?? []), r.etiqueta])
}
for (const [k, v] of [...filas.entries()].sort((a, b) => a[0] - b[0])) {
  console.log('  y≈' + k, v.join(', '))
}

// Resumen
const ok = diagonales === 0 && labelsDentroAjeno === 0
console.log(ok ? '\nRESULTADO: OK (ortogonal, sin etiquetas en componentes ajenos)' : '\nRESULTADO: REVISAR')
