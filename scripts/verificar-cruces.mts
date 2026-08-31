/**
 * Verifica que ninguna manguera del circuito auto-orderado atraviesa el cuerpo
 * de un componente que NO sea su origen o su destino.
 */
import { CASCADA_ABC } from '../src/circuitos/cascada-abc'
import { autoLayout } from '../src/layout'
import { enrutarManguera, type Punto } from '../src/routing'
import { DESCRIPTORES } from '../src/components/descriptores'

const { piezas } = autoLayout(CASCADA_ABC.piezas, CASCADA_ABC.mangueras)
const byId = new Map(piezas.map((p) => [p.id, p]))

function caja(p: { x: number; y: number; tipo: string }) {
  const d = DESCRIPTORES[p.tipo]
  const w = (d?.ancho ?? 60) + 8
  const h = (d?.alto ?? 40) + 8
  return { x: p.x - 4, y: p.y - 4, w, h }
}

function extraerPuntos(d: string): Punto[] {
  const pts: Punto[] = []
  const re = /[ML]([-\d.]+),([-\d.]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d)) !== null) pts.push({ x: +m[1], y: +m[2] })
  return pts
}

let diagonales = 0
let atraviesaAjeno = 0
const detallesAtraviesa: string[] = []

for (const m of CASCADA_ABC.mangueras) {
  const pa = byId.get(m.a.componente)
  const pb = byId.get(m.b.componente)
  if (!pa || !pb) continue
  const pts = extraerPuntos(enrutarManguera(piezas, pa, m.a, pb, m.b))
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)
    if (dx > 0.5 && dy > 0.5) diagonales++
    // Comprobar cruce con cada componente ajeno (ni origen ni destino)
    for (const p of piezas) {
      if (p.id === m.a.componente || p.id === m.b.componente) continue
      const c = caja(p)
      // El tramo A→B cruza c si algún punto interior está dentro
      let cruza = false
      for (let t = 0; t <= 1 && !cruza; t += 0.02) {
        const px = a.x + (b.x - a.x) * t
        const py = a.y + (b.y - a.y) * t
        if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) cruza = true
      }
      if (cruza) {
        atraviesaAjeno++
        detallesAtraviesa.push(`${m.id} (${m.a.componente}→${m.b.componente}) cruza ${p.id}`)
      }
    }
  }
}

console.log('Diagonales (no ortogonales):', diagonales)
console.log('Mangueras que atraviesan un componente ajeno:', atraviesaAjeno)
if (detallesAtraviesa.length) console.log(detallesAtraviesa.slice(0, 20).join('\n'))

const ok = diagonales === 0 && atraviesaAjeno === 0
console.log(ok ? '\nRESULTADO: OK — ninguna tubería atraviesa componentes ajenos, todo ortogonal' : '\nRESULTADO: REVISAR cruces')
