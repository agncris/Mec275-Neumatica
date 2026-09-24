/**
 * Croquis para el informe: la pieza acotada (vista en planta, con el cero de
 * la pieza) y el posicionamiento del robot respecto del mesón (planta y
 * elevación, con las distancias a la base y el alcance). Se generan como SVG
 * y se descargan como SVG o PNG.
 */
import { aMundo, v, type Plano, type V3 } from './matematica'
import type { ModeloRobot } from './robots'
import type { Herramienta } from './nodos'
import { BORDE_MESON, type Placa } from './movimiento'

export interface CurvaCroquis {
  pts: V3[]
  cerrada: boolean
}

const TINTA = '#1c2733'
const COTA = '#1565c0'
const f = (x: number) => {
  const r = Math.round(x * 10) / 10
  return (Object.is(r, -0) ? 0 : r).toLocaleString('es-CL', { maximumFractionDigits: 1 })
}
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Línea de cota entre dos puntos (en pantalla), corrida `sep` px hacia su normal. */
function cota(x1: number, y1: number, x2: number, y2: number, sep: number, texto: string): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const l = Math.hypot(dx, dy)
  if (l < 1) return ''
  const nx = -dy / l
  const ny = dx / l
  const a = { x: x1 + nx * sep, y: y1 + ny * sep }
  const b = { x: x2 + nx * sep, y: y2 + ny * sep }
  const ux = dx / l
  const uy = dy / l
  const flecha = (p: { x: number; y: number }, s: number) =>
    `<path d="M${p.x} ${p.y} L${p.x + s * (ux * 7 + nx * 2.5)} ${p.y + s * (uy * 7 + ny * 2.5)} L${p.x + s * (ux * 7 - nx * 2.5)} ${p.y + s * (uy * 7 - ny * 2.5)} Z" fill="${COTA}"/>`
  let ang = (Math.atan2(dy, dx) * 180) / Math.PI
  if (ang > 90) ang -= 180
  if (ang <= -90) ang += 180
  const m = { x: (a.x + b.x) / 2 + nx * 4 * Math.sign(sep || 1), y: (a.y + b.y) / 2 + ny * 4 * Math.sign(sep || 1) }
  const ext = (p: { x: number; y: number }, q: { x: number; y: number }) =>
    `<line x1="${p.x}" y1="${p.y}" x2="${q.x + nx * 4 * Math.sign(sep)}" y2="${q.y + ny * 4 * Math.sign(sep)}" stroke="${COTA}" stroke-width="0.6"/>`
  return [
    sep ? ext({ x: x1, y: y1 }, a) + ext({ x: x2, y: y2 }, b) : '',
    `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${COTA}" stroke-width="0.9"/>`,
    flecha(a, 1),
    flecha(b, -1),
    `<text x="${m.x}" y="${m.y}" font-size="12" fill="${COTA}" text-anchor="middle" dominant-baseline="${sep < 0 ? 'auto' : 'hanging'}" transform="rotate(${ang} ${m.x} ${m.y})" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(texto)}</text>`,
  ].join('')
}

function ejes(x: number, y: number, largo: number, rot = 0, etiqueta = ''): string {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return [
    `<line x1="${x}" y1="${y}" x2="${x + largo * c}" y2="${y - largo * s}" stroke="#d32f2f" stroke-width="2"/>`,
    `<text x="${x + (largo + 8) * c}" y="${y - (largo + 8) * s}" font-size="12" fill="#d32f2f" text-anchor="middle" dominant-baseline="middle">X</text>`,
    `<line x1="${x}" y1="${y}" x2="${x - largo * s}" y2="${y - largo * c}" stroke="#2e7d32" stroke-width="2"/>`,
    `<text x="${x - (largo + 8) * s}" y="${y - (largo + 8) * c}" font-size="12" fill="#2e7d32" text-anchor="middle" dominant-baseline="middle">Y</text>`,
    `<circle cx="${x}" cy="${y}" r="3" fill="${TINTA}"/>`,
    etiqueta ? `<text x="${x + 6}" y="${y + 14}" font-size="11" fill="${TINTA}">${esc(etiqueta)}</text>` : '',
  ].join('')
}

function marco(ancho: number, alto: number, titulo: string, subtitulo: string, cuerpo: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" font-family="system-ui, sans-serif">
<rect x="0" y="0" width="${ancho}" height="${alto}" fill="#fff"/>
<rect x="6" y="6" width="${ancho - 12}" height="${alto - 12}" fill="none" stroke="${TINTA}" stroke-width="1"/>
${cuerpo}
<line x1="6" y1="${alto - 40}" x2="${ancho - 6}" y2="${alto - 40}" stroke="${TINTA}"/>
<text x="16" y="${alto - 22}" font-size="14" font-weight="700" fill="${TINTA}">${esc(titulo)}</text>
<text x="16" y="${alto - 10}" font-size="11" fill="#5a6b7d">${esc(subtitulo)}</text>
<text x="${ancho - 16}" y="${alto - 16}" font-size="11" fill="#5a6b7d" text-anchor="end">NeumaLab · MEC275 · medidas en mm</text>
</svg>`
}

/** ¿Es un círculo? (cerrada y con todos sus puntos a la misma distancia del centro). */
function comoCirculo(c: CurvaCroquis): { cx: number; cy: number; r: number } | null {
  const pts = c.pts
  if (pts.length < 8) return null
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const rs = pts.map((p) => Math.hypot(p.x - cx, p.y - cy))
  const r = rs.reduce((s, x) => s + x, 0) / rs.length
  if (r < 0.5 || rs.some((x) => Math.abs(x - r) > Math.max(0.05, r * 0.01))) return null
  const cerrada = c.cerrada || Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-3
  return cerrada ? { cx, cy, r } : null
}

/** Quita las curvas repetidas (la misma en planta a otra altura). */
function sinRepetir(curvas: CurvaCroquis[]): CurvaCroquis[] {
  const vistas = new Set<string>()
  return curvas.filter((c) => {
    if (c.pts.length < 2) return false
    const xs = c.pts.map((p) => p.x)
    const ys = c.pts.map((p) => p.y)
    const k = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), c.pts.length].map((x) => Math.round(x * 10)).join('|')
    if (vistas.has(k)) return false
    vistas.add(k)
    return true
  })
}

/** Croquis de la pieza en planta, acotado, con el cero de la pieza. */
export function croquisPieza(curvasIn: CurvaCroquis[], titulo: string): string {
  const W = 820
  const H = 640
  const curvas = sinRepetir(curvasIn)
  if (!curvas.length) return marco(W, H, `Croquis de la pieza · ${titulo}`, 'No hay curvas para dibujar.', '')
  const todos = curvas.flatMap((c) => c.pts)
  const minX = Math.min(...todos.map((p) => p.x))
  const maxX = Math.max(...todos.map((p) => p.x))
  const minY = Math.min(...todos.map((p) => p.y))
  const maxY = Math.max(...todos.map((p) => p.y))
  // La vista incluye el cero de la pieza.
  const vx0 = Math.min(minX, 0)
  const vx1 = Math.max(maxX, 0)
  const vy0 = Math.min(minY, 0)
  const vy1 = Math.max(maxY, 0)
  const area = { x: 110, y: 50, w: W - 220, h: H - 200 }
  const k = Math.min(area.w / Math.max(1, vx1 - vx0), area.h / Math.max(1, vy1 - vy0))
  const ox = area.x + (area.w - (vx1 - vx0) * k) / 2 - vx0 * k
  const oy = area.y + area.h - (area.h - (vy1 - vy0) * k) / 2 + vy0 * k
  const X = (x: number) => ox + x * k
  const Y = (y: number) => oy - y * k
  const partes: string[] = []
  const grande = { w: maxX - minX, h: maxY - minY }
  for (const c of curvas) {
    const d = c.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(2)} ${Y(p.y).toFixed(2)}`).join(' ') + (c.cerrada ? ' Z' : '')
    partes.push(`<path d="${d}" fill="none" stroke="${TINTA}" stroke-width="1.6" stroke-linejoin="round"/>`)
  }
  // Etiquetas de cada curva: círculos con su diámetro y centro; el resto, su tamaño.
  curvas.forEach((c, i) => {
    const cir = comoCirculo(c)
    if (cir) {
      const px = X(cir.cx)
      const py = Y(cir.cy)
      partes.push(`<line x1="${px - 5}" y1="${py}" x2="${px + 5}" y2="${py}" stroke="${COTA}" stroke-width="0.8"/><line x1="${px}" y1="${py - 5}" x2="${px}" y2="${py + 5}" stroke="${COTA}" stroke-width="0.8"/>`)
      // La etiqueta sale hacia el centro del dibujo, para no chocar con las cotas.
      const lado = cir.cx > (minX + maxX) / 2 ? -1 : 1
      const a = lado > 0 ? Math.PI / 4 : (3 * Math.PI) / 4
      const bx = X(cir.cx + cir.r * Math.cos(a))
      const by = Y(cir.cy + cir.r * Math.sin(a))
      partes.push(`<line x1="${bx}" y1="${by}" x2="${bx + 22 * lado}" y2="${by - 22}" stroke="${COTA}" stroke-width="0.8"/>`)
      partes.push(`<text x="${bx + 24 * lado}" y="${by - 24}" font-size="12" fill="${COTA}" text-anchor="${lado > 0 ? 'start' : 'end'}">Ø${f(cir.r * 2)} · centro (${f(cir.cx)}; ${f(cir.cy)})</text>`)
      return
    }
    const xs = c.pts.map((p) => p.x)
    const ys = c.pts.map((p) => p.y)
    const w = Math.max(...xs) - Math.min(...xs)
    const h = Math.max(...ys) - Math.min(...ys)
    if (curvas.length > 1 && !(Math.abs(w - grande.w) < 0.05 && Math.abs(h - grande.h) < 0.05)) {
      partes.push(`<text x="${X(Math.min(...xs))}" y="${Y(Math.max(...ys)) - 5}" font-size="11" fill="${COTA}">${i + 1}: ${f(w)} × ${f(h)} desde (${f(Math.min(...xs))}; ${f(Math.min(...ys))})</text>`)
    }
  })
  // Cotas generales.
  partes.push(cota(X(minX), Y(minY), X(maxX), Y(minY), 34, `${f(grande.w)}`))
  partes.push(cota(X(maxX), Y(minY), X(maxX), Y(maxY), 34, `${f(grande.h)}`))
  if (Math.abs(minX) > 0.05) partes.push(cota(X(0), Y(vy0), X(minX), Y(vy0), 62, `${f(minX)}`))
  if (Math.abs(minY) > 0.05) partes.push(cota(X(vx0), Y(0), X(vx0), Y(minY), minY > 0 ? -40 : 40, `${f(minY)}`))
  partes.push(ejes(X(0), Y(0), 40, 0, 'Cero de la pieza (BASE)'))
  return marco(W, H, `Croquis de la pieza · ${titulo}`, `Vista en planta. Tamaño total ${f(grande.w)} × ${f(grande.h)} mm; esquina en (${f(minX)}; ${f(minY)}) desde el cero de la pieza.`, partes.join('\n'))
}

export interface DatosPosicion {
  modelo: ModeloRobot
  pedestal: number
  base: Plano
  espesor: number
  placa: Placa
  herramienta: Herramienta
}

/** Croquis de posicionamiento: planta y elevación del robot, el mesón y la plancha. */
export function croquisPosicion(d: DatosPosicion, titulo: string): string {
  const W = 1040
  const H = 640
  const { modelo, base, placa } = d
  const esquinas = (x0: number, y0: number, x1: number, y1: number) =>
    [v(x0, y0, 0), v(x1, y0, 0), v(x1, y1, 0), v(x0, y1, 0)].map((p) => aMundo(base, { o: p, x: v(1, 0, 0), y: v(0, 1, 0), z: v(0, 0, 1) }).o)
  const meson = esquinas(placa.x0 - BORDE_MESON, placa.y0 - BORDE_MESON, placa.x1 + BORDE_MESON, placa.y1 + BORDE_MESON)
  const plancha = esquinas(placa.x0, placa.y0, placa.x1, placa.y1)
  const rPie = Math.max(150, Math.min(500, modelo.a2 * 0.35))
  const alcance = modelo.alcance
  // Planta.
  const P = { x: 30, y: 40, w: 600, h: 440 }
  const xs = [-alcance, alcance, ...meson.map((p) => p.x)]
  const ys = [-alcance, alcance, ...meson.map((p) => p.y)]
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const k = Math.min(P.w / (x1 - x0), P.h / (y1 - y0))
  const ox = P.x + (P.w - (x1 - x0) * k) / 2 - x0 * k
  const oy = P.y + P.h - (P.h - (y1 - y0) * k) / 2 + y0 * k
  const X = (x: number) => ox + x * k
  const Y = (y: number) => oy - y * k
  const poli = (ps: V3[], estilo: string) => `<path d="${ps.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ')} Z" ${estilo}/>`
  const partes: string[] = []
  partes.push(`<text x="${P.x}" y="${P.y - 14}" font-size="13" font-weight="700" fill="${TINTA}">Planta</text>`)
  partes.push(`<circle cx="${X(0)}" cy="${Y(0)}" r="${alcance * k}" fill="none" stroke="#8a97a5" stroke-dasharray="6 5"/>`)
  partes.push(`<text x="${X(0)}" y="${Y(alcance) - 4}" font-size="11" fill="#5a6b7d" text-anchor="middle">alcance ${f(alcance)} (al centro de la muñeca)</text>`)
  partes.push(poli(meson, `fill="#e8dcc8" stroke="${TINTA}" stroke-width="1.2"`))
  partes.push(poli(plancha, `fill="#c9ced4" stroke="${TINTA}" stroke-width="1"`))
  partes.push(`<circle cx="${X(0)}" cy="${Y(0)}" r="${rPie * k}" fill="#ffb74d" stroke="${TINTA}"/>`)
  partes.push(ejes(X(0), Y(0), 36, 0, ''))
  partes.push(`<text x="${X(0)}" y="${Y(0) + rPie * k + 14}" font-size="11" fill="${TINTA}" text-anchor="middle">${esc(modelo.nombre)}</text>`)
  const rot = Math.atan2(base.x.y, base.x.x)
  partes.push(ejes(X(base.o.x), Y(base.o.y), 30, rot, 'BASE'))
  // Distancias del eje del robot a la base.
  partes.push(`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(base.o.x)}" y2="${Y(0)}" stroke="${COTA}" stroke-dasharray="3 3" stroke-width="0.7"/>`)
  partes.push(cota(X(0), Y(0), X(base.o.x), Y(0), base.o.y >= 0 ? 18 : -18, `X ${f(base.o.x)}`))
  // La cota Y va por fuera del mesón.
  const mX1 = Math.max(...meson.map((p) => p.x))
  const sepY = (base.o.y >= 0 ? 1 : -1) * ((Math.max(mX1, base.o.x) - base.o.x) * k + 16)
  partes.push(cota(X(base.o.x), Y(0), X(base.o.x), Y(base.o.y), sepY, `Y ${f(base.o.y)}`))
  // Punto de la plancha más lejano: ¿queda al alcance?
  const lejos = plancha.reduce((m, p) => (Math.hypot(p.x, p.y) > Math.hypot(m.x, m.y) ? p : m))
  const dLejos = Math.hypot(lejos.x, lejos.y)
  const ok = dLejos < alcance
  partes.push(`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(lejos.x)}" y2="${Y(lejos.y)}" stroke="${ok ? '#2e7d32' : '#c62828'}" stroke-width="1" stroke-dasharray="2 3"/>`)
  partes.push(
    `<text x="${X(lejos.x * 0.45)}" y="${Y(lejos.y * 0.45) + 16}" font-size="11" fill="${ok ? '#2e7d32' : '#c62828'}" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="3">esquina más lejana ${f(dLejos)} ${ok ? '✓ al alcance' : '✗ fuera del alcance'}</text>`,
  )

  // Elevación (mirando desde −Y): suelo, robot, mesón.
  const E = { x: 680, y: 40, w: 330, h: 440 }
  const zTop = base.o.z
  const zMeson = zTop - d.espesor
  const hHombro = d.pedestal + modelo.d1
  const ex0 = Math.min(-rPie, ...meson.map((p) => p.x)) - 50
  const ex1 = Math.max(rPie, ...meson.map((p) => p.x)) + 50
  const ez1 = Math.max(hHombro + modelo.a2, zTop) + 60
  const ke = Math.min(E.w / (ex1 - ex0), (E.h - 30) / ez1)
  const eX = (x: number) => E.x + (x - ex0) * ke
  const eZ = (z: number) => E.y + E.h - z * ke
  partes.push(`<text x="${E.x}" y="${E.y - 14}" font-size="13" font-weight="700" fill="${TINTA}">Elevación (vista desde −Y)</text>`)
  partes.push(`<line x1="${E.x}" y1="${eZ(0)}" x2="${E.x + E.w}" y2="${eZ(0)}" stroke="${TINTA}" stroke-width="1.5"/>`)
  const mx0 = Math.min(...meson.map((p) => p.x))
  const mx1 = Math.max(...meson.map((p) => p.x))
  const px0 = Math.min(...plancha.map((p) => p.x))
  const px1 = Math.max(...plancha.map((p) => p.x))
  if (zMeson > 15) {
    partes.push(`<rect x="${eX(mx0)}" y="${eZ(zMeson)}" width="${(mx1 - mx0) * ke}" height="${30 * ke}" fill="#e8dcc8" stroke="${TINTA}"/>`)
    partes.push(`<rect x="${eX(mx0 + 30)}" y="${eZ(zMeson - 30)}" width="${40 * ke}" height="${Math.max(0, zMeson - 30) * ke}" fill="#555"/>`)
    partes.push(`<rect x="${eX(mx1 - 70)}" y="${eZ(zMeson - 30)}" width="${40 * ke}" height="${Math.max(0, zMeson - 30) * ke}" fill="#555"/>`)
  }
  if (d.espesor > 0) partes.push(`<rect x="${eX(px0)}" y="${eZ(zTop)}" width="${(px1 - px0) * ke}" height="${Math.max(1.5, d.espesor * ke)}" fill="#c9ced4" stroke="${TINTA}" stroke-width="0.7"/>`)
  if (d.pedestal > 0) partes.push(`<rect x="${eX(-rPie)}" y="${eZ(d.pedestal)}" width="${2 * rPie * ke}" height="${d.pedestal * ke}" fill="#9e9e9e" stroke="${TINTA}"/>`)
  partes.push(`<rect x="${eX(-rPie * 0.7)}" y="${eZ(hHombro)}" width="${1.4 * rPie * ke}" height="${modelo.d1 * ke}" fill="#ffb74d" stroke="${TINTA}"/>`)
  partes.push(cota(eX(ex1 - 30), eZ(0), eX(ex1 - 30), eZ(zTop), 0, `Z ${f(zTop)}`))
  partes.push(cota(eX(-rPie) - 10, eZ(0), eX(-rPie) - 10, eZ(hHombro), 0, `hombro ${f(hHombro)}`))
  partes.push(`<circle cx="${eX(base.o.x)}" cy="${eZ(zTop)}" r="3" fill="#d32f2f"/>`)

  // Datos.
  const filas = [
    `Robot: ${modelo.nombre} · carga ${modelo.carga} kg · alcance ${f(alcance)} · repetibilidad ±${modelo.repetibilidad}`,
    `Pedestal: ${f(d.pedestal)} · herramienta: ${d.herramienta.nombre} (largo ${f(d.herramienta.largo)})`,
    `BASE (cero de la pieza): X ${f(base.o.x)} · Y ${f(base.o.y)} · Z ${f(base.o.z)} · giro ${f((rot * 180) / Math.PI)}°`,
    `Plancha ${f(placa.x1 - placa.x0)} × ${f(placa.y1 - placa.y0)} × ${f(d.espesor)} · mesón ${f(placa.x1 - placa.x0 + 2 * BORDE_MESON)} × ${f(placa.y1 - placa.y0 + 2 * BORDE_MESON)}`,
  ]
  filas.forEach((t, i) => partes.push(`<text x="30" y="${512 + i * 17}" font-size="12" fill="${TINTA}">${esc(t)}</text>`))
  return marco(W, H, `Posicionamiento del robot · ${titulo}`, 'Sistema del robot (WORLD) en el centro de su base; X hacia el frente del robot. La BASE es el cero de la pieza, en la cara de la plancha.', partes.join('\n'))
}
