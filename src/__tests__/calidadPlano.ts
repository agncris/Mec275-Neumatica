/**
 * Medidas de calidad de un plano ya ordenado.
 *
 * Sirven para comprobar, sin mirar, que el auto-orden produce un dibujo
 * legible: que nada se pisa, que ninguna manguera atraviesa un símbolo, que
 * hay pocos cruces y que las líneas de grupo salen dibujadas como barras.
 * Las usan las pruebas y el guion de desarrollo que renderiza los planos.
 */
import type { Manguera } from '../engine'
import type { Pieza } from '../store'
import { DESCRIPTORES } from '../components/descriptores'
import { planificarCarriles, type Carril } from '../carriles'
import { enrutarManguera, enrutarPorCarril, type Punto } from '../routing'

export interface Segmento {
  a: Punto
  b: Punto
  manguera: string
}

export interface PlanoMedido {
  piezas: Pieza[]
  carriles: Carril[]
  rutas: Map<string, string>
  segmentos: Segmento[]
  /** Mangueras que se han podido apoyar en una barra de grupo. */
  enCarril: number
  medidas: Medidas
}

export interface Medidas {
  solapes: number
  atraviesa: number
  cruces: number
  diagonales: number
  longitud: number
  giros: number
  ancho: number
  alto: number
}

const caja = (p: Pieza) => {
  const d = DESCRIPTORES[p.tipo]
  return { x: p.x, y: p.y, w: d?.ancho ?? 100, h: d?.alto ?? 80 }
}

export function puntosDe(d: string): Punto[] {
  const puntos: Punto[] = []
  const re = /([ML])(-?[\d.]+),(-?[\d.]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d)) !== null) puntos.push({ x: parseFloat(m[2]), y: parseFloat(m[3]) })
  return puntos
}

/** Enruta todas las mangueras como lo hace la pizarra (con barras de grupo). */
export function medirPlano(piezas: Pieza[], mangueras: Manguera[]): PlanoMedido {
  const porId = new Map(piezas.map((p) => [p.id, p]))
  const { carriles, porManguera } = planificarCarriles(piezas, mangueras)
  const rutas = new Map<string, string>()
  const segmentos: Segmento[] = []
  let enCarril = 0

  for (const m of mangueras) {
    const pa = porId.get(m.a.componente)
    const pb = porId.get(m.b.componente)
    if (!pa || !pb) continue
    let d = ''
    const carril = porManguera.get(m.id)
    if (carril) {
      const ruta = enrutarPorCarril(piezas, pa, m.a, pb, m.b, carril.y)
      if (ruta) {
        d = ruta.d
        enCarril++
      }
    }
    if (!d) d = enrutarManguera(piezas, pa, m.a, pb, m.b)
    rutas.set(m.id, d)
    const pts = puntosDe(d)
    for (let i = 1; i < pts.length; i++) segmentos.push({ a: pts[i - 1], b: pts[i], manguera: m.id })
  }

  return { piezas, carriles, rutas, segmentos, enCarril, medidas: calcularMedidas(piezas, mangueras, segmentos) }
}

/** Extremos (puertos) de cada manguera, a partir de sus segmentos. */
function rutasPorManguera(segmentos: Segmento[]): Map<string, Punto[]> {
  const out = new Map<string, Punto[]>()
  for (const s of segmentos) {
    const lista = out.get(s.manguera)
    if (lista) lista[1] = s.b
    else out.set(s.manguera, [s.a, s.b])
  }
  return out
}

/** Nodos (componente:puerto) que toca cada manguera; sirve para no contar como
 * cruce lo que en realidad es un empalme en el mismo punto de la red. */
function nodosDe(mangueras: Manguera[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const m of mangueras) {
    out.set(
      m.id,
      new Set([`${m.a.componente}:${m.a.puerto}`, `${m.b.componente}:${m.b.puerto}`]),
    )
  }
  return out
}

function calcularMedidas(piezas: Pieza[], mangueras: Manguera[], segmentos: Segmento[]): Medidas {
  // 1 · solapes entre piezas
  let solapes = 0
  for (let i = 0; i < piezas.length; i++) {
    for (let j = i + 1; j < piezas.length; j++) {
      const a = caja(piezas[i])
      const b = caja(piezas[j])
      if (a.x - 4 < b.x + b.w && a.x + a.w + 4 > b.x && a.y - 4 < b.y + b.h && a.y + a.h + 4 > b.y) solapes++
    }
  }

  // 2 · mangueras que atraviesan el cuerpo de una pieza. Cuenta también las
  // dos piezas que la manguera conecta: un trazo puede salir de su puerto,
  // pero no cruzar por encima del símbolo (se mira sólo lo que queda lejos
  // del propio puerto).
  const extremos = new Map<string, Punto[]>()
  for (const [id, d] of rutasPorManguera(segmentos)) extremos.set(id, d)
  let atraviesa = 0
  for (const s of segmentos) {
    const suyos = extremos.get(s.manguera) ?? []
    for (const p of piezas) {
      const c = caja(p)
      // Muestreo del segmento (son ortogonales, basta con recorrerlo)
      const pasos = Math.max(2, Math.ceil((Math.abs(s.b.x - s.a.x) + Math.abs(s.b.y - s.a.y)) / 6))
      let dentro = false
      for (let k = 0; k <= pasos && !dentro; k++) {
        const t = k / pasos
        const x = s.a.x + (s.b.x - s.a.x) * t
        const y = s.a.y + (s.b.y - s.a.y) * t
        const cerca = suyos.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) < 26)
        if (!cerca && x > c.x + 2 && x < c.x + c.w - 2 && y > c.y + 2 && y < c.y + c.h - 2) dentro = true
      }
      if (dentro) atraviesa++
    }
  }

  // 3 · cruces entre mangueras de redes distintas
  const nodos = nodosDe(mangueras)
  const comparten = (m1: string, m2: string) => {
    const a = nodos.get(m1)
    const b = nodos.get(m2)
    if (!a || !b) return false
    for (const n of a) if (b.has(n)) return true
    return false
  }
  let cruces = 0
  for (let i = 0; i < segmentos.length; i++) {
    for (let j = i + 1; j < segmentos.length; j++) {
      const s = segmentos[i]
      const t = segmentos[j]
      if (s.manguera === t.manguera || comparten(s.manguera, t.manguera)) continue
      if (seCruzan(s, t)) cruces++
    }
  }

  // 4 · trazos no ortogonales, longitud y giros
  let diagonales = 0
  let longitud = 0
  for (const s of segmentos) {
    const dx = Math.abs(s.b.x - s.a.x)
    const dy = Math.abs(s.b.y - s.a.y)
    if (dx > 0.5 && dy > 0.5) diagonales++
    longitud += dx + dy
  }
  const giros = Math.max(0, segmentos.length - mangueras.length)

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of piezas) {
    const c = caja(p)
    minX = Math.min(minX, c.x); minY = Math.min(minY, c.y)
    maxX = Math.max(maxX, c.x + c.w); maxY = Math.max(maxY, c.y + c.h)
  }

  return {
    solapes,
    atraviesa,
    cruces,
    diagonales,
    longitud: Math.round(longitud),
    giros,
    ancho: Math.round(maxX - minX),
    alto: Math.round(maxY - minY),
  }
}

/** Cruce real entre dos segmentos ortogonales (uno horizontal y otro vertical). */
function seCruzan(s: Segmento, t: Segmento): boolean {
  const hor = (x: Segmento) => Math.abs(x.a.y - x.b.y) < 0.5
  const ver = (x: Segmento) => Math.abs(x.a.x - x.b.x) < 0.5
  const prueba = (h: Segmento, v: Segmento) => {
    const y = h.a.y
    const x = v.a.x
    const dentroH = x > Math.min(h.a.x, h.b.x) + 0.5 && x < Math.max(h.a.x, h.b.x) - 0.5
    const dentroV = y > Math.min(v.a.y, v.b.y) + 0.5 && y < Math.max(v.a.y, v.b.y) - 0.5
    return dentroH && dentroV
  }
  if (hor(s) && ver(t)) return prueba(s, t)
  if (ver(s) && hor(t)) return prueba(t, s)
  return false
}
