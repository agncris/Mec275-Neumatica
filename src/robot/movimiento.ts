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
  /** La muestra pertenece a un LIN o CIR. Sólo esos tramos desbastan la plancha. */
  corta: boolean
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
  /** Línea del KRL (desde 0) que corresponde a cada comando. */
  krlLineas: number[]
}

const PASO_MM = 4
const PASO_ANG = 0.04 // rad

function muestraDe(prog: Programa, q: number[], t: number, cmd: number, estado: EstadoMuestra, corta = false): Muestra {
  const { modelo, pedestal } = prog.robot
  const p = directa(modelo, q, prog.herramienta.largo, v(0, 0, pedestal))
  // Altura del TCP sobre la base (cara superior de la plancha).
  const rel = aplicar(trasp(matrizPlano(prog.base)), resta(p.tcp, prog.base.o))
  return { t, q: [...q], tcp: p.tcp, estado, cmd, enPieza: rel.z < 0.5, corta }
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

/** Plancha en coordenadas de la base (mm). */
export interface Placa {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** La plancha que se dibuja cuando no hay geometría. */
export const PLACA_DEFECTO: Placa = { x0: -20, y0: -20, x1: 220, y1: 170 }
/** Cuánto sobresale el mesón de la plancha, por lado (mm). */
export const BORDE_MESON = 80

/**
 * Busca choques del robot con el mesón y la plancha en cada muestra. El
 * brazo se toma como un tubo del grosor aproximado de sus eslabones; la
 * herramienta puede entrar a la plancha (está cortando), pero no pasarla.
 */
function revisarChoques(prog: Programa, placa: Placa, muestras: Muestra[], problema: (m: Muestra, texto: string) => void) {
  const { modelo, pedestal } = prog.robot
  const L = prog.herramienta.largo
  const Rb = trasp(matrizPlano(prog.base))
  const aBase = (p: V3) => aplicar(Rb, resta(p, prog.base.o))
  const e = prog.espesor
  const hayMeson = prog.base.o.z - e > 15
  const radio = Math.max(40, modelo.a2 * 0.08)
  const dentro = (p: V3, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, m: number) =>
    p.x > x0 - m && p.x < x1 + m && p.y > y0 - m && p.y < y1 + m && p.z > z0 - m && p.z < z1 + m
  const enMeson = (p: V3, m: number) => hayMeson && dentro(p, placa.x0 - BORDE_MESON, placa.y0 - BORDE_MESON, placa.x1 + BORDE_MESON, placa.y1 + BORDE_MESON, -1e6, -e, m)
  const enPlancha = (p: V3, m: number) => e > 0 && dentro(p, placa.x0, placa.y0, placa.x1, placa.y1, -e, 0, m)
  const nombres = ['la base', 'el brazo', 'el antebrazo', 'la muñeca']
  for (const mu of muestras) {
    const c = directa(modelo, mu.q, L, v(0, 0, pedestal)).cadena.map(aBase)
    let choque: string | null = null
    // Eslabones: del suelo al hombro, hombro-codo, codo-muñeca, muñeca-flange.
    const suelo = aBase(v(0, 0, 0))
    const tramos: Array<[V3, V3, string]> = [
      [suelo, c[1], nombres[0]],
      [c[1], c[2], nombres[1]],
      [c[2], c[3], nombres[2]],
      [c[3], c[4], nombres[3]],
    ]
    for (const [a, b, nombre] of tramos) {
      const n = Math.max(2, Math.ceil(dist(a, b) / 25))
      for (let i = 0; i <= n && !choque; i++) {
        const p = lerp(a, b, i / n)
        if (enMeson(p, radio * 0.6)) choque = `Choque: ${nombre} del robot toca el mesón.`
        else if (enPlancha(p, radio * 0.6)) choque = `Choque: ${nombre} del robot toca la plancha.`
      }
      if (choque) break
    }
    if (!choque) {
      // Herramienta: el cuerpo (la mitad cercana al flange) no puede entrar;
      // la punta sí entra a la plancha, pero no la atraviesa.
      const n = Math.max(2, Math.ceil(L / 10))
      for (let i = 0; i <= n && !choque; i++) {
        const f = i / n
        const p = lerp(c[4], c[5], f)
        if (f < 0.5 && (enPlancha(p, 0) || enMeson(p, 0))) choque = 'Choque: el portaherramienta toca la plancha o el mesón (la herramienta es muy corta o está muy inclinada).'
      }
      // Pasar la plancha hasta 2 mm es normal al cortarla de lado a lado.
      if (!choque && c[5].z < -e - 2 && (enMeson(c[5], 0) || dentro(c[5], placa.x0, placa.y0, placa.x1, placa.y1, -1e6, 0, 0)))
        choque = 'Choque: la herramienta atraviesa la plancha y se entierra en el mesón (más de 2 mm bajo la plancha). Revisa la Z de los puntos: la cara de la plancha es Z0.'
    }
    if (choque) {
      mu.estado = 'error'
      problema(mu, choque)
    }
  }
}

export interface OpcionesSimulacion {
  /** Avisa si la fresa corta con el husillo apagado o si queda encendido al terminar (se usa en la tarea). */
  avisoHusillo?: boolean
}

export function simular(prog: Programa, placa: Placa | null = null, opciones: OpcionesSimulacion = {}): Simulacion {
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
      problema(cmd, 'error', `Fuera de alcance: el robot no llega a (${tcp.x.toFixed(0)}, ${tcp.y.toFixed(0)}, ${tcp.z.toFixed(0)}) mm con la herramienta en esa orientación. Acerca la pieza o usa un robot más grande.`)
      return { q: semilla, estado: 'error' }
    }
    if (s.falla === 'limite' && s.eje !== undefined) {
      const [lo, hi] = modelo.limites[s.eje]
      problema(cmd, 'error', `El eje ${nombreEje(s.eje)} tendría que ir a ${s.q[s.eje].toFixed(0)}°, fuera de su rango (${lo}° a ${hi}°). Cambia cómo apunta la herramienta o dónde está la pieza.`)
      return { q: s.q, estado: 'error' }
    }
    let estado: EstadoMuestra = 'ok'
    // Singularidad de muñeca: sólo importa si A4 y A6 se ponen a girar.
    const giroMuneca = Math.abs(s.q[3] - semilla[3]) + Math.abs(s.q[5] - semilla[5])
    if (s.singular && giroMuneca > 5) {
      problema(cmd, 'aviso', 'Muñeca estirada (A5 cerca de 0°): A4 y A6 giran de golpe para seguir el camino. Inclina un poco la herramienta o mueve la pieza.')
      estado = 'aviso'
    }
    const cerca = cercaDelLimite(modelo, s.q)
    if (cerca.length) {
      problema(cmd, 'aviso', `Ejes cerca del límite: ${cerca.map(nombreEje).join(', ')}. Les queda poco giro: si la pieza se corre un poco, el robot no llega.`)
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
        problema(cmd, 'error', `Salto brusco de ${salto.toFixed(0)}° en un eje durante un movimiento recto: el robot cambia de postura a mitad del camino y la herramienta se saldría de la línea.`)
        r.estado = 'error'
      }
      q = r.q
      if (r.estado === 'error') peor = 'error'
      else if (r.estado === 'aviso' && peor === 'ok') peor = 'aviso'
      muestras.push(muestraDe(prog, q, t + dur * f, cmd, r.estado, true))
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

  if (opciones.avisoHusillo) avisosDeHusillo(prog, muestras, problema)

  revisarChoques(prog, placa ?? PLACA_DEFECTO, muestras, (m, texto) => {
    t = m.t
    problema(Math.max(0, m.cmd), 'error', texto)
  })
  problemas.sort((a, b) => a.t - b.t)

  const uso: Array<[number, number]> = [0, 1, 2, 3, 4, 5].map((k) => [Math.min(...muestras.map((m) => m.q[k])), Math.max(...muestras.map((m) => m.q[k]))])
  const sim: Simulacion = { muestras, problemas, tiempo: t, largoCorte, uso, salidas, finales, krl: '', krlLineas: [] }
  const armado = armarKRL(prog, sim)
  sim.krl = armado.texto
  sim.krlLineas = armado.lineas
  return sim
}

/** Comando que se está ejecutando en el instante t. */
export function comandoEn(sim: Simulacion, t: number): number {
  const m = sim.muestras
  if (!m.length) return 0
  const { i } = ejesEn(sim, t)
  const sig = m[i + 1]
  if (sig && sig.cmd !== m[i].cmd && t >= m[i].t) return sig.cmd
  return m[i].cmd
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
  return armarKRL(prog, sim, nombre).texto
}

function armarKRL(prog: Programa, sim: Simulacion, nombre = 'neumalab'): { texto: string; lineas: number[] } {
  const { modelo, pedestal } = prog.robot
  const h = prog.herramienta
  const Rb = matrizPlano(prog.base)
  const baseRel = resta(prog.base.o, v(0, 0, pedestal))
  const deComando: number[] = []
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
      deComando[i] = lineas.length - 1
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
      deComando[i] = lineas.length - 1
    } else if (c.tipo === 'OUT') {
      lineas.push(`$OUT[${c.salida}] = ${c.valor ? 'TRUE' : 'FALSE'}`)
      deComando[i] = lineas.length - 1
    } else if (c.tipo === 'WAIT') {
      lineas.push(`WAIT SEC ${f2(c.seg)}`)
      deComando[i] = lineas.length - 1
    } else if (c.tipo === 'KRL') {
      const partes = c.texto.split(/\r?\n/)
      const inicio = lineas.length
      lineas.push(...(partes.length ? partes : ['']))
      deComando[i] = inicio
    }
  })
  lineas.push('END')
  for (let i = 0; i < lineas.length; i++) lineas[i] = anotarLineaKRL(lineas[i])
  return { texto: lineas.join('\r\n') + '\r\n', lineas: deComando }
}

export interface PalabraKRL {
  palabra: string
  texto: string
}

/**
 * Frase corta de qué hace la línea, para el alumno. Va como comentario `;`
 * en el KRL, igual que el paréntesis de cada bloque de código G.
 */
function glosaCortaKRL(codigo: string, nota = ''): string {
  const c = codigo.trim()
  const rel = c.match(/^&REL\s+(\d+)/i)
  const def = c.match(/^DEF\s+([A-Za-z_]\w*)\s*\(/i)
  const bas = c.match(/^BAS\s*\(\s*(#\w+)\s*,\s*(-?[\d.]+)\s*\)/i)
  const apo = c.match(/^\$APO\.CDIS\s*=\s*(-?[\d.]+)/i)
  const vel = c.match(/^\$VEL\.CP\s*=\s*(-?[\d.]+)/i)
  const salida = c.match(/^\$OUT\[(\d+)\]\s*=\s*(TRUE|FALSE)/i)
  const espera = c.match(/^WAIT\s+SEC\s+(-?[\d.]+)/i)
  const aprox = /\bC_DIS\b/i.test(c)
  if (/^&ACCESS\b/i.test(c)) return 'Este archivo se puede leer y ejecutar.'
  if (rel) return `Versión ${rel[1]} del archivo.`
  if (def) return `Empieza el programa ${def[1]}.`
  if (/^END$/i.test(c)) return 'Aquí termina el programa.'
  if (bas) {
    const modo = bas[1].toUpperCase()
    if (modo === '#INITMOV') return 'Prepara el robot para el primer movimiento.'
    if (modo === '#VEL_PTP') return `Los PTP que siguen van al ${bas[2]} % de la velocidad de cada eje.`
    return `Ajusta el movimiento con ${modo}.`
  }
  if (/^\$BASE\s*=/i.test(c)) return 'Fija dónde está la pieza. Las rectas y los arcos se miden desde aquí.'
  if (/^\$TOOL\s*=/i.test(c)) return 'Fija la punta de la herramienta respecto de la brida del robot.'
  if (apo) return `Empalma el movimiento siguiente cuando faltan ${apo[1]} mm para el punto.`
  if (vel) return `Las rectas y los arcos que siguen van a ${vel[1]} m/s.`
  if (/^PTP\s+\{/i.test(c)) {
    const donde = /^hacia\b/i.test(nota) ? ` ${nota}` : ''
    return `Punto a punto${donde}: cada eje va a su ángulo por su cuenta.`
  }
  if (/^LIN\s+\{/i.test(c)) return aprox ? 'La punta va en línea recta hasta este punto y empalma con el tramo que sigue.' : 'La punta va en línea recta hasta este punto.'
  if (/^CIR\s+\{/i.test(c)) return aprox ? 'La punta recorre un arco hasta el segundo punto y empalma con el tramo que sigue.' : 'La punta recorre un arco. El primer punto va sobre el arco y el segundo es el final.'
  if (salida) return salida[2].toUpperCase() === 'TRUE' ? `Enciende la salida ${salida[1]}.` : `Apaga la salida ${salida[1]}.`
  if (espera) return `El robot espera ${espera[1]} s en el lugar.`
  return 'El controlador ejecuta esta línea.'
}

/** Pone la glosa al final de la línea, salvo que ya traiga un comentario escrito a mano. */
export function anotarLineaKRL(linea: string): string {
  const cruda = linea.trim()
  if (!cruda || cruda.startsWith(';')) return linea
  const corte = indiceComentarioKRL(linea)
  const codigo = (corte >= 0 ? linea.slice(0, corte) : linea).trim()
  const nota = corte >= 0 ? linea.slice(corte + 1).trim() : ''
  if (nota && !/^hacia\b/i.test(nota)) return linea
  const glosa = glosaCortaKRL(codigo, nota)
  if (!glosa) return linea
  const indent = linea.match(/^\s*/)?.[0] ?? ''
  return `${indent}${codigo} ; ${glosa}`
}

/** Separa el código de la frase que lo explica, para mostrarla bajo cada línea. */
export function presentarLineaKRL(linea: string): { codigo: string; glosa: string } {
  const cruda = linea.trim()
  if (!cruda) return { codigo: linea, glosa: '' }
  if (cruda.startsWith(';')) return { codigo: linea.trimEnd(), glosa: explicarLineaKRL(linea)[0]?.texto ?? '' }
  const anotada = anotarLineaKRL(linea)
  const corte = indiceComentarioKRL(anotada)
  if (corte < 0) return { codigo: anotada.trimEnd(), glosa: glosaCortaKRL(anotada) }
  return { codigo: anotada.slice(0, corte).trimEnd(), glosa: anotada.slice(corte + 1).trim() }
}

/** Qué hace cada palabra de una línea KRL, en el mismo espíritu que la explicación del código G. */
export function explicarLineaKRL(texto: string): PalabraKRL[] {
  const cruda = texto.trim()
  if (!cruda) return []
  if (cruda.startsWith(';')) {
    if (/^;FOLD\b/i.test(cruda)) return [{ palabra: cruda, texto: 'Abre un pliegue del editor de KUKA: agrupa las líneas de abajo para poder ocultarlas.' }]
    if (/^;ENDFOLD\b/i.test(cruda)) return [{ palabra: cruda, texto: 'Cierra el pliegue abierto con ;FOLD.' }]
    const cuerpo = cruda.replace(/^;\s*/, '')
    if (/Generado por NeumaLab/i.test(cuerpo)) return [{ palabra: cruda, texto: 'Comentario: de qué robot y de qué herramienta sale este programa.' }]
    if (/Programa de estudio/i.test(cuerpo)) return [{ palabra: cruda, texto: 'Comentario: conviene revisar el programa y probarlo despacio antes de un robot real.' }]
    return [{ palabra: cruda, texto: `Comentario, no se ejecuta: ${cuerpo}` }]
  }
  const corte = indiceComentarioKRL(cruda)
  const codigo = (corte >= 0 ? cruda.slice(0, corte) : cruda).trim()
  const comentario = corte >= 0 ? cruda.slice(corte + 1).trim() : ''
  const out: PalabraKRL[] = []
  const acceso = codigo.match(/^&ACCESS\s+(\S+)/i)
  const rel = codigo.match(/^&REL\s+(\d+)/i)
  const def = codigo.match(/^DEF\s+([A-Za-z_]\w*)\s*\(/i)
  const bas = codigo.match(/^BAS\s*\(\s*(#\w+)\s*,\s*(-?[\d.]+)\s*\)/i)
  const base = codigo.match(/^\$BASE\s*=\s*(\{[^}]+\})/i)
  const tool = codigo.match(/^\$TOOL\s*=\s*(\{[^}]+\})/i)
  const apo = codigo.match(/^\$APO\.CDIS\s*=\s*(-?[\d.]+)/i)
  const vel = codigo.match(/^\$VEL\.CP\s*=\s*(-?[\d.]+)/i)
  const ptp = codigo.match(/^PTP\s+(\{[^}]+\})/i)
  const lin = codigo.match(/^LIN\s+(\{[^}]+\})(?:\s+(C_DIS|C_PTP|C_VEL))?/i)
  const cir = codigo.match(/^CIR\s+(\{[^}]+\}),\s*(\{[^}]+\})(?:\s+(C_DIS|C_PTP|C_VEL))?/i)
  const salida = codigo.match(/^\$OUT\[(\d+)\]\s*=\s*(TRUE|FALSE)/i)
  const espera = codigo.match(/^WAIT\s+SEC\s+(-?[\d.]+)/i)
  if (/^&ACCESS\b/i.test(codigo) && acceso) out.push({ palabra: codigo, texto: `Encabezado del archivo: el programa se puede leer y ejecutar (${acceso[1]}).` })
  else if (rel) out.push({ palabra: codigo, texto: `Versión ${rel[1]} del archivo KRL.` })
  else if (def) out.push({ palabra: codigo, texto: `Empieza el programa ${def[1]}. En KUKA cada programa es un DEF y termina con END.` })
  else if (/^END$/i.test(codigo)) out.push({ palabra: 'END', texto: 'Fin del programa. El robot se detiene aquí.' })
  else if (bas) {
    const modo = bas[1].toUpperCase()
    const n = bas[2]
    out.push({
      palabra: codigo,
      texto:
        modo === '#INITMOV'
          ? 'Inicializa el movimiento: deja el robot listo para la primera orden.'
          : modo === '#VEL_PTP'
            ? `Velocidad de los PTP que siguen: ${n} % de la máxima de cada eje.`
            : `Instrucción BAS ${modo} con valor ${n}.`,
    })
  } else if (base) {
    out.push({ palabra: '$BASE', texto: 'Dónde está la pieza respecto del robot. Las posiciones de LIN y CIR se miden desde aquí.' })
    out.push(...filasMarco(base[1], 'base'))
  } else if (tool) {
    out.push({ palabra: '$TOOL', texto: 'Dónde está la punta de la herramienta (TCP) respecto de la brida del robot.' })
    out.push(...filasMarco(tool[1], 'tool'))
  } else if (apo) out.push({ palabra: codigo, texto: `Distancia de aproximación: ${apo[1]} mm. Los movimientos con C_DIS empalman cuando falta esa distancia, sin frenar en cada punto.` })
  else if (vel) out.push({ palabra: codigo, texto: `Velocidad de los LIN y CIR que siguen: ${vel[1]} m/s a lo largo del camino.` })
  else if (ptp) {
    out.push({ palabra: 'PTP', texto: 'Movimiento punto a punto: cada eje va por su cuenta hasta el ángulo pedido. El camino de la herramienta no es una recta.' })
    out.push(...filasEjes(ptp[1]))
  } else if (lin) {
    out.push({ palabra: 'LIN', texto: 'La punta de la herramienta va en línea recta hasta este punto, a la velocidad $VEL.CP.' })
    out.push(...filasMarco(lin[1], 'punto'))
    if (lin[2]) out.push(aproximacion(lin[2]))
  } else if (cir) {
    out.push({ palabra: 'CIR', texto: 'Arco circular. El primer marco es un punto del arco y el segundo es el final. La punta recorre el arco a $VEL.CP.' })
    out.push({ palabra: 'punto del arco', texto: 'Un punto intermedio, no el centro: con el inicio y el final define el círculo.' })
    out.push(...filasMarco(cir[1], 'punto'))
    out.push({ palabra: 'punto final', texto: 'Dónde termina el arco.' })
    out.push(...filasMarco(cir[2], 'punto'))
    if (cir[3]) out.push(aproximacion(cir[3]))
  }   else if (salida) out.push({ palabra: codigo, texto: salida[2].toUpperCase() === 'TRUE' ? `Enciende la salida digital ${salida[1]}. Así parte un husillo, una pinza o una ventosa.` : `Apaga la salida digital ${salida[1]}.` })
  else if (espera) out.push({ palabra: codigo, texto: `El robot espera ${espera[1]} s en el lugar, para que el husillo tome velocidad o para soltar la pieza.` })
  else if (codigo) out.push({ palabra: codigo, texto: 'El controlador ejecuta esta línea.' })
  if (comentario) out.push({ palabra: `; ${comentario}`, texto: `Comentario: ${comentario}` })
  return out
}

function indiceComentarioKRL(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') n++
    else if (s[i] === '}') n = Math.max(0, n - 1)
    else if (s[i] === ';' && n === 0) return i
  }
  return -1
}

function aproximacion(modo: string): PalabraKRL {
  if (modo.toUpperCase() === 'C_DIS') return { palabra: 'C_DIS', texto: 'No frena en el punto: empalma con el movimiento siguiente al llegar a la distancia de $APO.CDIS.' }
  return { palabra: modo, texto: 'Aproximación al punto, para no detenerse del todo antes del movimiento que sigue.' }
}

function filasEjes(bloque: string): PalabraKRL[] {
  return pares(bloque).map(([letra, num]) => ({ palabra: `${letra} ${num}`, texto: `Ángulo del eje ${letra}: ${num}°.` }))
}

function filasMarco(bloque: string, uso: 'base' | 'tool' | 'punto'): PalabraKRL[] {
  return pares(bloque).map(([letra, num]) => ({ palabra: `${letra} ${num}`, texto: textoMarco(letra, num, uso) }))
}

function pares(bloque: string): Array<[string, string]> {
  const dentro = bloque.replace(/^\{|\}$/g, '')
  const out: Array<[string, string]> = []
  for (const parte of dentro.split(',')) {
    const m = parte.trim().match(/^([A-Za-z]\d*)\s+(-?[\d.]+)$/)
    if (m) out.push([m[1], m[2]])
  }
  return out
}

function textoMarco(letra: string, num: string, uso: 'base' | 'tool' | 'punto'): string {
  if (letra === 'X' || letra === 'Y' || letra === 'Z') {
    if (uso === 'tool' && letra === 'X') return `Desplazamiento del TCP en X: ${num} mm. El largo de la herramienta va en este eje.`
    if (uso === 'tool') return `Desplazamiento del TCP en ${letra}: ${num} mm.`
    if (uso === 'base') return `La pieza está a ${num} mm en ${letra}, medida desde la base del robot.`
    return `Posición de la punta en ${letra}: ${num} mm, medida en $BASE.`
  }
  if (letra === 'A' || letra === 'B' || letra === 'C') {
    const que = uso === 'tool' ? 'de la herramienta' : uso === 'base' ? 'de la pieza' : 'de la herramienta al llegar'
    return `Giro ${letra} ${que}: ${num}°. KUKA da la orientación con los ángulos A, B y C.`
  }
  return `${letra} = ${num}.`
}

/** Largo total de los movimientos de un conjunto de comandos (informativo). */
export function resumenComandos(cs: Comando[]): Record<string, number> {
  const r: Record<string, number> = {}
  for (const c of cs) r[c.tipo] = (r[c.tipo] ?? 0) + 1
  return r
}


/**
 * Aviso naranjo para herramientas que giran (fresa y taladro): el husillo debe estar
 * encendido (alguna salida digital en TRUE) antes del primer corte, y apagado al terminar.
 * No es un error: el programa corre, pero en un robot real la fresa se rompería.
 */
function avisosDeHusillo(prog: Programa, muestras: Muestra[], problema: (cmd: number, nivel: 'aviso' | 'error', texto: string) => void): void {
  const gira = prog.herramienta.tipo === 'fresa' || prog.herramienta.tipo === 'taladro'
  if (!gira) return
  const primerCorte = muestras.find((m) => m.enPieza && ['LIN', 'CIR'].includes(prog.comandos[m.cmd]?.tipo ?? ''))
  if (primerCorte) {
    const encendido = prog.comandos.slice(0, primerCorte.cmd).some((c) => c.tipo === 'OUT' && c.valor)
    if (!encendido) problema(primerCorte.cmd, 'aviso', 'El husillo no está encendido cuando la herramienta empieza a cortar. Usa Set Digital Out (TRUE) antes del primer corte.')
  }
  const estado = new Map<number, boolean>()
  prog.comandos.forEach((c) => {
    if (c.tipo === 'OUT') estado.set(c.salida, c.valor)
  })
  if ([...estado.values()].some(Boolean)) problema(prog.comandos.length - 1, 'aviso', 'El husillo queda encendido al terminar. Apágalo con Set Digital Out (FALSE) antes de volver a HOME.')
}
