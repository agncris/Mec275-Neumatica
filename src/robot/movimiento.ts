/**
 * Simulación del programa del robot y su análisis, como el que hace
 * KUKA|prc al mover el slider: recorre los comandos, resuelve la cinemática
 * inversa en cada punto del camino y marca dónde el robot no alcanza, se
 * sale del rango de un eje o pasa cerca de una singularidad. Al final genera
 * el programa en KRL (el lenguaje de los controladores KUKA).
 */
import {
  aABC,
  aplicar,
  aMundo,
  anguloEntre,
  cruz,
  dist,
  escalar,
  lerp,
  matrizPlano,
  mul,
  punto,
  resta,
  slerpM,
  suma,
  trasp,
  unit,
  v,
  type M3,
  type V3,
} from './matematica'
import type { Comando, Programa } from './nodos'
import { cercaDelLimite, directa, inversa, orientacionDePlano } from './robots'

export type EstadoMuestra = 'ok' | 'aviso' | 'error'

export interface Muestra {
  t: number
  q: number[]
  tcp: V3
  estado: EstadoMuestra
  cmd: number
  /** La herramienta está en la pieza (a la altura de la plancha o bajo ella). */
  enPieza: boolean
}

export interface Problema {
  cmd: number
  nodo: string
  nivel: 'aviso' | 'error'
  texto: string
  t: number
}

export interface Simulacion {
  muestras: Muestra[]
  problemas: Problema[]
  tiempo: number
  /** Recorrido del TCP en movimientos LIN/CIR (mm). */
  largoCorte: number
  /** Rango usado por cada eje [mín, máx]. */
  uso: Array<[number, number]>
  /** Salidas digitales en el tiempo. */
  salidas: Array<{ t: number; salida: number; valor: boolean }>
  /** Ejes calculados al final de cada comando (para el KRL). */
  finales: number[][]
  krl: string
}

const PASO_MM = 4
const PASO_ANG = 0.04 // rad

function muestraDe(prog: Programa, q: number[], t: number, cmd: number, estado: EstadoMuestra): Muestra {
  const { modelo, pedestal } = prog.robot
  const p = directa(modelo, q, prog.herramienta.largo, v(0, 0, pedestal))
  // Altura del TCP sobre la base (cara superior de la plancha).
  const rel = aplicar(trasp(matrizPlano(prog.base)), resta(p.tcp, prog.base.o))
  return { t, q: [...q], tcp: p.tcp, estado, cmd, enPieza: rel.z < 0.5 }
}

/** Circunferencia por tres puntos: centro, radio y normal. */
function circunferencia(a: V3, b: V3, c: V3): { centro: V3; r: number; n: V3 } | null {
  const ab = resta(b, a)
  const ac = resta(c, a)
  const nn = cruz(ab, ac)
  const n2 = punto(nn, nn)
  if (n2 < 1e-9) return null
  const t1 = escalar(cruz(nn, ab), punto(ac, ac))
  const t2 = escalar(cruz(ac, nn), punto(ab, ab))
  const centro = suma(a, escalar(suma(t1, t2), 1 / (2 * n2)))
  return { centro, r: dist(centro, a), n: unit(nn) }
}

export function simular(prog: Programa): Simulacion {
  const { modelo, pedestal } = prog.robot
  const L = prog.herramienta.largo
  const base0 = v(0, 0, pedestal)
  const muestras: Muestra[] = []
  const problemas: Problema[] = []
  const salidas: Simulacion['salidas'] = []
  const finales: number[][] = []
  let q = [...prog.inicio]
  let t = 0
  let largoCorte = 0
  muestras.push(muestraDe(prog, q, 0, -1, 'ok'))
  const avisados = new Set<string>()
  const problema = (cmd: number, nivel: 'aviso' | 'error', texto: string) => {
    const clave = `${cmd}|${texto}`
    if (avisados.has(clave)) return
    avisados.add(clave)
    problemas.push({ cmd, nodo: prog.comandos[cmd]?.nodo ?? '', nivel, texto, t })
  }
  const nombreEje = (k: number) => `A${k + 1}`

  // Resuelve un objetivo cartesiano (en el mundo) desde la semilla q.
  const resolver = (tcp: V3, R: M3, semilla: number[], cmd: number): { q: number[]; estado: EstadoMuestra } => {
    const s = inversa(modelo, tcp, R, L, semilla, base0)
    if (s.falla === 'alcance') {
      problema(cmd, 'error', `Fuera de alcance: el robot no llega a (${tcp.x.toFixed(0)}, ${tcp.y.toFixed(0)}, ${tcp.z.toFixed(0)}) mm con la herramienta en esa orientación.`)
      return { q: semilla, estado: 'error' }
    }
    if (s.falla === 'limite' && s.eje !== undefined) {
      const [lo, hi] = modelo.limites[s.eje]
      problema(cmd, 'error', `El eje ${nombreEje(s.eje)} tendría que ir a ${s.q[s.eje].toFixed(0)}°, fuera de su rango (${lo}° a ${hi}°).`)
      return { q: s.q, estado: 'error' }
    }
    let estado: EstadoMuestra = 'ok'
    // Singularidad de muñeca: sólo importa si A4 y A6 se ponen a girar.
    const giroMuneca = Math.abs(s.q[3] - semilla[3]) + Math.abs(s.q[5] - semilla[5])
    if (s.singular && giroMuneca > 5) {
      problema(cmd, 'aviso', 'Muñeca en una singularidad (A5 ≈ 0°): A4 y A6 giran bruscamente. Inclina un poco la herramienta o cambia la posición de la pieza.')
      estado = 'aviso'
    }
    const cerca = cercaDelLimite(modelo, s.q)
    if (cerca.length) {
      problema(cmd, 'aviso', `Ejes cerca del límite: ${cerca.map(nombreEje).join(', ')}.`)
      estado = 'aviso'
    }
    return { q: s.q, estado }
  }

  const tramoLineal = (desde: V3, Rd: M3, hasta: V3, Rh: M3, vel: number, cmd: number, camino?: (f: number) => V3) => {
    const lg = camino ? 0 : dist(desde, hasta)
    let largoReal = lg
    if (camino) {
      let ant = desde
      for (let i = 1; i <= 64; i++) {
        const p = camino(i / 64)
        largoReal += dist(ant, p)
        ant = p
      }
    }
    const ang = anguloEntre(Rd, Rh)
    const pasos = Math.max(1, Math.ceil(largoReal / PASO_MM), Math.ceil(ang / PASO_ANG))
    const dur = largoReal / (vel * 1000)
    largoCorte += largoReal
    let peor: EstadoMuestra = 'ok'
    for (let i = 1; i <= pasos; i++) {
      const f = i / pasos
      const p = camino ? camino(f) : lerp(desde, hasta, f)
      const R = slerpM(Rd, Rh, f)
      const r = resolver(p, R, q, cmd)
      const salto = r.q.reduce((m, x, k) => Math.max(m, Math.abs(x - q[k])), 0)
      if (salto > 25 && r.estado !== 'error') {
        problema(cmd, 'error', `Salto brusco de ${salto.toFixed(0)}° en un eje durante un movimiento recto: el robot cambia de configuración (típico al cruzar una singularidad).`)
        r.estado = 'error'
      }
      q = r.q
      if (r.estado === 'error') peor = 'error'
      else if (r.estado === 'aviso' && peor === 'ok') peor = 'aviso'
      muestras.push(muestraDe(prog, q, t + dur * f, cmd, r.estado))
    }
    t += dur
    return peor
  }

  const moverEjes = (destino: number[], velPct: number, cmd: number, estado: EstadoMuestra) => {
    const dq = destino.map((x, k) => x - q[k])
    const dur = Math.max(0.05, ...dq.map((d, k) => Math.abs(d) / (modelo.velocidades[k] * Math.max(0.01, velPct / 100))))
    const pasos = Math.max(2, Math.ceil(Math.max(...dq.map(Math.abs)) / 2))
    const q0 = [...q]
    for (let i = 1; i <= pasos; i++) {
      const f = i / pasos
      // Perfil suave (acelera y frena).
      const s = f * f * (3 - 2 * f)
      const qi = q0.map((x, k) => x + dq[k] * s)
      muestras.push(muestraDe(prog, qi, t + dur * f, cmd, estado))
    }
    q = [...destino]
    t += dur
  }

  prog.comandos.forEach((c, i) => {
    const actual = directa(modelo, q, L, base0)
    if (c.tipo === 'AXIS') {
      const fuera = c.q.findIndex((x, k) => x < modelo.limites[k][0] || x > modelo.limites[k][1])
      if (fuera >= 0) problema(i, 'error', `AXIS: ${nombreEje(fuera)} = ${c.q[fuera]}° está fuera de su rango.`)
      moverEjes(c.q, c.vel, i, fuera >= 0 ? 'error' : 'ok')
    } else if (c.tipo === 'PTP') {
      const pl = aMundo(prog.base, c.plano)
      const r = resolver(pl.o, orientacionDePlano(pl), q, i)
      moverEjes(r.q, c.vel, i, r.estado)
    } else if (c.tipo === 'LIN') {
      const pl = aMundo(prog.base, c.plano)
      tramoLineal(actual.tcp, actual.R, pl.o, orientacionDePlano(pl), c.vel, i)
    } else if (c.tipo === 'CIR') {
      const aux = aMundo(prog.base, c.aux)
      const fin = aMundo(prog.base, c.plano)
      const circ = circunferencia(actual.tcp, aux.o, fin.o)
      if (!circ) {
        problema(i, 'aviso', 'CIR: los tres puntos están alineados; se hace un movimiento recto.')
        tramoLineal(actual.tcp, actual.R, fin.o, orientacionDePlano(fin), c.vel, i)
      } else {
        // Ángulos en el plano del círculo, pasando por el auxiliar.
        const e1 = unit(resta(actual.tcp, circ.centro))
        const e2 = cruz(circ.n, e1)
        const ang = (p: V3) => {
          const d = resta(p, circ.centro)
          let a = Math.atan2(punto(d, e2), punto(d, e1))
          if (a < 0) a += 2 * Math.PI
          return a
        }
        const aFin = ang(fin.o)
        const camino = (f: number) => {
          const a = aFin * f
          return suma(circ.centro, suma(escalar(e1, circ.r * Math.cos(a)), escalar(e2, circ.r * Math.sin(a))))
        }
        tramoLineal(actual.tcp, actual.R, fin.o, orientacionDePlano(fin), c.vel, i, camino)
      }
    } else if (c.tipo === 'OUT') {
      salidas.push({ t, salida: c.salida, valor: c.valor })
    } else if (c.tipo === 'WAIT') {
      t += c.seg
      muestras.push(muestraDe(prog, q, t, i, 'ok'))
    }
    finales.push([...q])
  })

  const uso: Array<[number, number]> = [0, 1, 2, 3, 4, 5].map((k) => [Math.min(...muestras.map((m) => m.q[k])), Math.max(...muestras.map((m) => m.q[k]))])
  const sim: Simulacion = { muestras, problemas, tiempo: t, largoCorte, uso, salidas, finales, krl: '' }
  sim.krl = generarKRL(prog, sim)
  return sim
}

/** Ejes en el instante t (interpolando entre muestras). */
export function ejesEn(sim: Simulacion, t: number): { q: number[]; i: number } {
  const m = sim.muestras
  if (!m.length) return { q: [0, 0, 0, 0, 0, 0], i: 0 }
  if (t <= m[0].t) return { q: m[0].q, i: 0 }
  let lo = 0
  let hi = m.length - 1
  if (t >= m[hi].t) return { q: m[hi].q, i: hi }
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (m[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = m[lo]
  const b = m[hi]
  const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0
  return { q: a.q.map((x, k) => x + (b.q[k] - x) * f), i: lo }
}

// ---------------------------------------------------------------------------
// KRL
// ---------------------------------------------------------------------------
const f2 = (x: number) => (Math.abs(x) < 5e-4 ? '0' : (Math.round(x * 1000) / 1000).toString())

function frameKRL(o: V3, R: M3): string {
  const { a, b, c } = aABC(R)
  return `{X ${f2(o.x)}, Y ${f2(o.y)}, Z ${f2(o.z)}, A ${f2(a)}, B ${f2(b)}, C ${f2(c)}}`
}

function nombreKRL(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/^[^A-Za-z]+/, '')
    .slice(0, 24)
  return limpio || 'programa'
}

export function generarKRL(prog: Programa, sim: Simulacion, nombre = 'neumalab'): string {
  const { modelo, pedestal } = prog.robot
  const h = prog.herramienta
  const Rb = matrizPlano(prog.base)
  const baseRel = resta(prog.base.o, v(0, 0, pedestal))
  const lineas: string[] = [
    '&ACCESS RVP',
    '&REL 1',
    `DEF ${nombreKRL(nombre)}( )`,
    `; Generado por NeumaLab (MEC275) · robot ${modelo.nombre} · herramienta ${h.nombre}, largo ${h.largo} mm`,
    '; Programa de estudio: revísalo y pruébalo en T1 (velocidad reducida) antes de usarlo en un robot real.',
    ';FOLD INI',
    '  BAS (#INITMOV, 0)',
    ';ENDFOLD (INI)',
    `$BASE = ${frameKRL(baseRel, Rb)}`,
    `$TOOL = {X ${f2(h.largo)}, Y 0, Z 0, A 0, B 0, C 0}`,
    '$APO.CDIS = 0.5',
  ]
  let velCP = -1
  let velPTP = -1
  prog.comandos.forEach((c, i) => {
    const q = sim.finales[i]
    if (c.tipo === 'AXIS' || c.tipo === 'PTP') {
      if (c.vel !== velPTP) {
        velPTP = c.vel
        lineas.push(`BAS (#VEL_PTP, ${f2(c.vel)})`)
      }
      const eje = `{A1 ${f2(q[0])}, A2 ${f2(q[1])}, A3 ${f2(q[2])}, A4 ${f2(q[3])}, A5 ${f2(q[4])}, A6 ${f2(q[5])}}`
      lineas.push(`PTP ${eje}${c.tipo === 'PTP' ? ` ; hacia (${f2(c.plano.o.x)}, ${f2(c.plano.o.y)}, ${f2(c.plano.o.z)})` : ''}`)
    } else if (c.tipo === 'LIN' || c.tipo === 'CIR') {
      if (c.vel !== velCP) {
        velCP = c.vel
        lineas.push(`$VEL.CP = ${f2(c.vel)}`)
      }
      // Orientación del TCP respecto de la base.
      const Rt = mul(trasp(Rb), orientacionDePlano(aMundo(prog.base, c.plano)))
      if (c.tipo === 'LIN') lineas.push(`LIN ${frameKRL(c.plano.o, Rt)} C_DIS`)
      else {
        const Ra = mul(trasp(Rb), orientacionDePlano(aMundo(prog.base, c.aux)))
        lineas.push(`CIR ${frameKRL(c.aux.o, Ra)}, ${frameKRL(c.plano.o, Rt)} C_DIS`)
      }
    } else if (c.tipo === 'OUT') lineas.push(`$OUT[${c.salida}] = ${c.valor ? 'TRUE' : 'FALSE'}`)
    else if (c.tipo === 'WAIT') lineas.push(`WAIT SEC ${f2(c.seg)}`)
    else if (c.tipo === 'KRL') lineas.push(c.texto)
  })
  lineas.push('END')
  return lineas.join('\r\n') + '\r\n'
}

/** Largo total de los movimientos de un conjunto de comandos (informativo). */
export function resumenComandos(cs: Comando[]): Record<string, number> {
  const r: Record<string, number> = {}
  for (const c of cs) r[c.tipo] = (r[c.tipo] ?? 0) + 1
  return r
}

