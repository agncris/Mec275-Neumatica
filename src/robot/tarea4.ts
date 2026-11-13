/**
 * Tarea 4 de Robótica: la pieza de soporte de motor (250 x 250 mm, acero A36 de 5 mm,
 * fresa de 5 mm). Aquí está la definición con la que parte el alumno (robot,
 * herramienta, Core y el plano ya cargado) y el análisis de un trabajo, que usan la
 * revisión de «Entregar», el script del profesor y la pauta. El análisis mide lo que
 * hace el programa en el mismo simulador de la app; no califica.
 */
import { cajaCurvas, desfasar, leerDXF, mover, type Curva } from './geometria'
import { aplicar, matrizPlano, trasp, v, type V3 } from './matematica'
import { simular, type Muestra, type Placa, type Simulacion } from './movimiento'
import { componente, evaluar, paramsIniciales, type Definicion, type NodoDef, type Programa } from './nodos'
import { PLANO_TAREA4_DXF } from './planoTarea4'

export const MARCA_TAREA4 = 'tarea-4'
export const NOMBRE_PLANO_TAREA4 = 'plano-tarea4-robotica.dxf'
/** Radio de la fresa de la tarea (Ø5 mm). */
export const RADIO_FRESA = 2.5
/** Distancia (mm) a la que un punto de la trayectoria cuenta como «sobre» el recorrido esperado (la fresa mide 5 mm). */
export const TOLERANCIA = 1.5

const sinEspacios = (t: string) => t.replace(/\r/g, '').trim()

/** La definición con la que parte la tarea: robot, herramienta (fresa Ø5) y Core, con el plano cargado. */
export function tareaVaciaRobot(): Definicion {
  const nodo = (id: string, tipo: string, x: number, y: number, params: NodoDef['params'] = {}): NodoDef => {
    const comp = componente(tipo)
    if (!comp) throw new Error(`Componente ${tipo} no existe`)
    return { id, tipo, x, y, params: { ...paramsIniciales(comp), ...params } }
  }
  return {
    version: 1,
    tipo: 'definicion-robot',
    nombre: 'Tarea Robótica',
    nodos: [nodo('rob', 'robot', 500, 60), nodo('her', 'herramienta', 500, 180, { tipo: 'fresa', largo: 200, diametro: 5 }), nodo('core', 'core', 700, 100, { espesor: 5 })],
    cables: [
      { de: 'rob', salida: 0, a: 'core', entrada: 1 },
      { de: 'her', salida: 0, a: 'core', entrada: 2 },
    ],
    dxf: { nombre: NOMBRE_PLANO_TAREA4, texto: PLANO_TAREA4_DXF },
  }
}

/** ¿El plano abierto es el de la tarea, sin tocar? */
export function esPlanoDeLaTarea(def: Definicion): boolean {
  return !!def.dxf && sinEspacios(def.dxf.texto) === sinEspacios(PLANO_TAREA4_DXF)
}

/**
 * Una definición armada en el Laboratorio (con otro plano, o sin plano) se puede traer a la
 * tarea: se le pone el plano de la tarea y se avisa. Los nodos, los cables y los valores
 * se conservan. Si ya tiene el plano de la tarea, vuelve igual.
 */
export function adaptarATarea(def: Definicion): { def: Definicion; cambioElPlano: boolean } {
  if (esPlanoDeLaTarea(def)) return { def, cambioElPlano: false }
  return { def: { ...def, dxf: { nombre: NOMBRE_PLANO_TAREA4, texto: PLANO_TAREA4_DXF } }, cambioElPlano: true }
}

// ---------------------------------------------------------------- geometría de apoyo
function distPuntoSegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

type Tramo = [number, number, number, number]

function distAlRecorrido(px: number, py: number, tramos: Tramo[]): number {
  let m = Infinity
  for (const [ax, ay, bx, by] of tramos) {
    const d = distPuntoSegmento(px, py, ax, ay, bx, by)
    if (d < m) m = d
  }
  return m
}

/** Puntos de una curva cerrada cada ~1 mm. */
function remuestrear(c: Curva, paso = 1): Array<[number, number]> {
  const out: Array<[number, number]> = []
  const p = c.pts
  const n = p.length
  for (let i = 0; i < n; i++) {
    const a = p[i]
    const b = p[(i + 1) % n]
    const l = Math.hypot(b.x - a.x, b.y - a.y)
    const k = Math.max(1, Math.round(l / paso))
    for (let j = 0; j < k; j++) out.push([a.x + ((b.x - a.x) * j) / k, a.y + ((b.y - a.y) * j) / k])
  }
  return out
}

export interface TrazoPlano {
  /** 'contorno' o 'ranura 1'… 'ranura 9'. */
  nombre: string
  /** Cuánto del recorrido compensado esperado (fresa Ø5) pasa bajo la trayectoria, 0 a 1. */
  cobertura: number
  /** Cuánto del contorno del plano, sin compensar, pasa bajo la trayectoria, 0 a 1. */
  coberturaSinCompensar: number
  /** Separación media y máxima (mm) entre el recorrido esperado y la trayectoria. */
  desvioMedio: number
  desvioMax: number
}

export interface AnalisisTarea4 {
  /** El Core arma un programa. */
  hayPrograma: boolean
  robot: string
  /** Alcance del modelo (mm, al centro de la muñeca) y su repetibilidad (± mm). */
  alcanceRobot: number | null
  repetibilidad: number | null
  /** Base: X, Y, altura del mesón (Z) y giro. */
  base: { x: number; y: number; z: number; giro: number } | null
  espesor: number | null
  herramienta: { tipo: string; diametro: number; largo: number } | null
  planoIgual: boolean
  errores: string[]
  avisos: string[]
  ciclo: boolean
  tiempo: number | null
  /** Salida digital activada antes del primer movimiento de corte. */
  husilloAntesDelCorte: boolean | null
  /** El primer movimiento que toca la plancha es LIN o CIR. */
  cortaConLinOCir: boolean | null
  /** Los movimientos en el aire (acercarse y alejarse) son PTP, no LIN ni CIR. */
  acercaConPtp: boolean | null
  /** Cuántos LIN o CIR se hacen en el aire, sobre la plancha. */
  viajesConLin: number
  /** Cuánto baja la fresa bajo la cara superior de la plancha (mm), el máximo. */
  profundidadCorte: number | null
  trazos: TrazoPlano[]
  trazosRecorridos: number
  trazosCompensados: number
  /** Separación máxima (mm) entre lo esperado y la trayectoria, en los trazos recorridos. */
  desvioMax: number | null
  /** Distancia desde el centro de la base al punto más lejano de la plancha (mm), en planta. */
  alcanceNecesario: number | null
}

const vacio = (def: Definicion): AnalisisTarea4 => ({
  hayPrograma: false,
  robot: '',
  alcanceRobot: null,
  repetibilidad: null,
  base: null,
  espesor: null,
  herramienta: null,
  planoIgual: esPlanoDeLaTarea(def),
  errores: [],
  avisos: [],
  ciclo: false,
  tiempo: null,
  husilloAntesDelCorte: null,
  cortaConLinOCir: null,
  acercaConPtp: null,
  viajesConLin: 0,
  profundidadCorte: null,
  trazos: [],
  trazosRecorridos: 0,
  trazosCompensados: 0,
  desvioMax: null,
  alcanceNecesario: null,
})

/** La plancha como la dibuja la app: la geometría con 20 mm de margen. */
function placaDe(def: Definicion, ev: ReturnType<typeof evaluar>): Placa | null {
  const curvas: Curva[] = []
  for (const n of def.nodos) {
    const r = ev.nodos[n.id]
    if (!r || r.estado === 'error' || n.tipo === 'core') continue
    for (const s of r.salidas) for (const d of s) if (typeof d === 'object' && d !== null && 'pts' in d && 'cerrada' in d) curvas.push(d as Curva)
  }
  if (!curvas.length) return null
  const { min, max } = cajaCurvas(curvas)
  return Number.isFinite(min.x) ? { x0: min.x - 20, y0: min.y - 20, x1: max.x + 20, y1: max.y + 20 } : null
}

/** El trazo del plano (curvas del DXF de la tarea), con la capa que le toca. */
function trazosDelPlano(): Array<{ nombre: string; curva: Curva; exterior: boolean }> {
  const dxf = leerDXF(PLANO_TAREA4_DXF)
  let r = 0
  return dxf.curvas.map((c) => {
    const exterior = c.capa === 'CONTORNO'
    return { nombre: exterior ? 'contorno' : `ranura ${++r}`, curva: c, exterior }
  })
}

const TRAZOS = trazosDelPlano()
const CAJA_PLANO = cajaCurvas(TRAZOS.map((t) => t.curva))
const CAJA_RANURAS = cajaCurvas(TRAZOS.filter((t) => !t.exterior).map((t) => t.curva))
const CAJA_CONTORNO = cajaCurvas(TRAZOS.filter((t) => t.exterior).map((t) => t.curva))

/** Trayectoria de corte (en el sistema de la pieza) como tramos, a partir de las muestras de la simulación. */
function tramosDeCorte(prog: Programa, sim: Simulacion): Tramo[] {
  const m = trasp(matrizPlano(prog.base))
  const aPieza = (p: V3): V3 => aplicar(m, v(p.x - prog.base.o.x, p.y - prog.base.o.y, p.z - prog.base.o.z))
  const tramos: Tramo[] = []
  let previa: { p: V3; cmd: number } | null = null
  for (const s of sim.muestras) {
    const c = prog.comandos[s.cmd]
    const corta = !!c && (c.tipo === 'LIN' || c.tipo === 'CIR') && s.enPieza
    if (!corta) {
      previa = null
      continue
    }
    const p = aPieza(s.tcp)
    // Una muestra por cada ~4 mm: se unen las consecutivas mientras la herramienta siga cortando.
    if (previa) tramos.push([previa.p.x, previa.p.y, p.x, p.y])
    previa = { p, cmd: s.cmd }
  }
  return tramos
}

function evaluarTrazos(tramos: Tramo[], dx: number, dy: number): TrazoPlano[] {
  const mueve = (c: Curva) => mover(c, v(dx, dy, 0))
  return TRAZOS.map((t) => {
    const esperada = remuestrear(desfasar(mueve(t.curva), t.exterior ? RADIO_FRESA : -RADIO_FRESA))
    const borde = remuestrear(mueve(t.curva))
    const dEsp = esperada.map(([x, y]) => distAlRecorrido(x, y, tramos))
    const dBor = borde.map(([x, y]) => distAlRecorrido(x, y, tramos))
    const cob = (d: number[]) => d.filter((x) => x <= TOLERANCIA).length / Math.max(1, d.length)
    const finitas = dEsp.filter(Number.isFinite)
    return {
      nombre: t.nombre,
      cobertura: cob(dEsp),
      coberturaSinCompensar: cob(dBor),
      desvioMedio: finitas.length ? finitas.reduce((a, b) => a + b, 0) / finitas.length : Infinity,
      desvioMax: finitas.length ? Math.max(...finitas) : Infinity,
    }
  })
}

/** Mide un trabajo de la tarea en el simulador de la app. */
export function analizarTarea4(def: Definicion): AnalisisTarea4 {
  const a = vacio(def)
  const dxf = def.dxf ? leerDXF(def.dxf.texto) : null
  const ev = evaluar(def, dxf)
  a.ciclo = ev.ciclo
  const prog = ev.programas[0]
  // Aunque el Core todavía no arme un programa, la herramienta y el espesor se leen de los nodos.
  const her = def.nodos.find((n) => n.tipo === 'herramienta')
  const core = def.nodos.find((n) => n.tipo === 'core')
  if (her) a.herramienta = { tipo: String(her.params.tipo), diametro: Number(her.params.diametro), largo: Number(her.params.largo) }
  if (core) a.espesor = Number(core.params.espesor)
  if (!prog) {
    const malo = Object.values(ev.nodos).flatMap((r) => (r.estado === 'error' ? r.mensajes : []))
    a.errores = malo.length ? malo.slice(0, 3) : ['El Core no arma un programa: necesita comandos, robot y herramienta.']
    return a
  }
  const sim = simular(prog, placaDe(def, ev), { avisoHusillo: true })
  a.hayPrograma = true
  a.robot = prog.robot.modelo.id
  a.alcanceRobot = prog.robot.modelo.alcance
  a.repetibilidad = prog.robot.modelo.repetibilidad
  const giro = (Math.atan2(prog.base.x.y, prog.base.x.x) * 180) / Math.PI
  a.base = { x: prog.base.o.x, y: prog.base.o.y, z: prog.base.o.z, giro: Math.round(giro * 100) / 100 }
  a.espesor = prog.espesor
  a.herramienta = { tipo: prog.herramienta.tipo, diametro: prog.herramienta.diametro, largo: prog.herramienta.largo }
  a.errores = sim.problemas.filter((p) => p.nivel === 'error').map((p) => p.texto)
  a.avisos = sim.problemas.filter((p) => p.nivel === 'aviso').map((p) => p.texto)
  a.tiempo = sim.tiempo

  // Husillo, tipo de movimiento al cortar y acercamiento.
  const iCorte = sim.muestras.findIndex((s: Muestra) => {
    const c = prog.comandos[s.cmd]
    return s.enPieza && !!c && (c.tipo === 'LIN' || c.tipo === 'CIR' || c.tipo === 'PTP')
  })
  if (iCorte >= 0) {
    const s = sim.muestras[iCorte]
    const c = prog.comandos[s.cmd]
    a.cortaConLinOCir = c.tipo === 'LIN' || c.tipo === 'CIR'
    a.husilloAntesDelCorte = sim.salidas.some((x) => x.valor && x.t <= s.t)
  }
  // Acercarse y alejarse: los LIN o CIR a más de 1 mm sobre la plancha son «viajes» hechos con la herramienta equivocada.
  const enElAire = (c: (typeof prog.comandos)[number]) => (c.tipo === 'LIN' || c.tipo === 'CIR') && c.plano.o.z > 1
  a.viajesConLin = prog.comandos.filter(enElAire).length
  // Acercarse y alejarse se puede hacer con PTP o con AXIS: lo que no va es LIN o CIR en el aire.
  a.acercaConPtp = a.viajesConLin === 0 && prog.comandos.some((c) => c.tipo === 'PTP' || c.tipo === 'AXIS')

  // Trazos del plano recorridos (con la mejor traslación entre las posibles del Curve).
  const tramos = tramosDeCorte(prog, sim)
  {
    const m0 = trasp(matrizPlano(prog.base))
    const zs = sim.muestras
      .filter((s: Muestra) => s.enPieza && ['LIN', 'CIR'].includes(prog.comandos[s.cmd]?.tipo ?? ''))
      .map((s: Muestra) => aplicar(m0, v(s.tcp.x - prog.base.o.x, s.tcp.y - prog.base.o.y, s.tcp.z - prog.base.o.z)).z)
    a.profundidadCorte = zs.length ? Math.round(-Math.min(...zs) * 100) / 100 : null
  }
  // Dónde puso el alumno el plano: con Curve (esquina al origen o no), o corriéndolo con Move.
  // Se prueban varias posiciones y se queda la que mejor calza con lo que cortó.
  const traslaciones: Array<[number, number]> = [
    [0, 0],
    [-CAJA_PLANO.min.x, -CAJA_PLANO.min.y],
    [-CAJA_CONTORNO.min.x, -CAJA_CONTORNO.min.y],
    [-CAJA_RANURAS.min.x, -CAJA_RANURAS.min.y],
  ]
  if (tramos.length) {
    const xs = tramos.flatMap((t) => [t[0], t[2]])
    const ys = tramos.flatMap((t) => [t[1], t[3]])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    traslaciones.push(
      [x0 - (CAJA_CONTORNO.min.x - RADIO_FRESA), y0 - (CAJA_CONTORNO.min.y - RADIO_FRESA)], // cortó el contorno: su esquina manda
      [x0 - (CAJA_RANURAS.min.x + RADIO_FRESA), y0 - (CAJA_RANURAS.min.y + RADIO_FRESA)], // cortó sólo las ranuras
      [(x0 + x1) / 2 - (CAJA_PLANO.min.x + CAJA_PLANO.max.x) / 2, (y0 + y1) / 2 - (CAJA_PLANO.min.y + CAJA_PLANO.max.y) / 2], // lo cortó todo: el centro manda
    )
  }
  let mejor: TrazoPlano[] = []
  let mejorPuntaje = -1
  let mejorTraslacion: [number, number] = [-CAJA_PLANO.min.x, -CAJA_PLANO.min.y]
  if (tramos.length) {
    for (const [dx, dy] of traslaciones) {
      const t = evaluarTrazos(tramos, dx, dy)
      const puntaje = t.reduce((s, x) => s + Math.max(x.cobertura, x.coberturaSinCompensar), 0)
      if (puntaje > mejorPuntaje) {
        mejorPuntaje = puntaje
        mejor = t
        mejorTraslacion = [dx, dy]
      }
    }
  }
  a.trazos = mejor
  a.trazosRecorridos = mejor.filter((t) => t.cobertura >= 0.9).length
  a.trazosCompensados = a.trazosRecorridos
  const recorridos = mejor.filter((t) => t.cobertura >= 0.9)
  a.desvioMax = recorridos.length ? Math.max(...recorridos.map((t) => t.desvioMax)) : null

  // Alcance que pide la pieza desde la base: punto más lejano del contorno, en planta.
  const m = matrizPlano(prog.base)
  const pts = TRAZOS.find((t) => t.exterior)?.curva.pts ?? []
  const [tx, ty] = mejorTraslacion
  a.alcanceNecesario = pts.length
    ? Math.max(...pts.map((p) => {
        const w = aplicar(m, v(p.x + tx, p.y + ty, 0))
        return Math.hypot(prog.base.o.x + w.x, prog.base.o.y + w.y)
      }))
    : null
  return a
}

export interface PuntoRevisionTarea {
  ok: boolean
  texto: string
}

/** Lo que se avisa en «Entregar» antes de subir la tarea. No califica. */
export function revisarTarea4(a: AnalisisTarea4, nombreAlumno: string): PuntoRevisionTarea[] {
  const total = TRAZOS.length
  const r: PuntoRevisionTarea[] = [
    { ok: a.planoIgual, texto: a.planoIgual ? 'El plano es el de la tarea, sin modificar.' : 'El plano abierto no es el de la tarea o fue modificado. Vuelve a entrar a «★ Tarea Robótica».' },
    {
      ok: !!a.herramienta && a.herramienta.tipo === 'fresa' && a.herramienta.diametro === 5,
      texto: a.herramienta ? (a.herramienta.tipo === 'fresa' && a.herramienta.diametro === 5 ? 'La herramienta es la fresa de 5 mm.' : `La herramienta es ${a.herramienta.tipo} de ${a.herramienta.diametro} mm: el enunciado pide una fresa de 5 mm.`) : 'Todavía no hay herramienta conectada al Core.',
    },
    {
      ok: a.espesor === 5,
      texto: a.espesor === null ? 'Todavía no hay Core con programa.' : a.espesor === 5 ? 'El espesor de la plancha es 5 mm.' : `El espesor de la plancha es ${a.espesor} mm: el enunciado pide 5 mm.`,
    },
    {
      ok: a.husilloAntesDelCorte === true,
      texto:
        a.husilloAntesDelCorte === null
          ? 'No encuentro un movimiento que llegue a la plancha: no puedo ver si el husillo se enciende antes de cortar.'
          : a.husilloAntesDelCorte
            ? 'El husillo se enciende (salida digital) antes del primer corte.'
            : 'El husillo no está encendido cuando la herramienta llega a la plancha: usa Set Digital Out antes de cortar.',
    },
    {
      ok: a.trazosRecorridos === total,
      texto: a.trazos.length
        ? `La trayectoria recorre ${a.trazosRecorridos} de ${total} trazos del plano (contorno y ${total - 1} aberturas), compensando el radio de la fresa.${a.trazosRecorridos < total && a.trazos.some((t) => t.coberturaSinCompensar >= 0.9 && t.cobertura < 0.9) ? ' Algunos trazos se recorren sobre el borde, sin compensar.' : ''}`
        : 'La trayectoria todavía no corta ningún trazo del plano.',
    },
    {
      ok: a.acercaConPtp === true,
      texto: a.acercaConPtp === null ? 'Todavía no hay movimientos para revisar.' : a.acercaConPtp ? 'Te acercas y te alejas con PTP, y cortas con LIN o CIR.' : `Hay ${a.viajesConLin} movimiento(s) LIN o CIR en el aire: para acercarte y alejarte usa PTP, y LIN o CIR solo para cortar.`,
    },
    {
      ok: a.profundidadCorte !== null && a.espesor !== null && a.profundidadCorte >= a.espesor - 0.5,
      texto:
        a.profundidadCorte === null
          ? 'La fresa todavía no baja a la plancha.'
          : a.espesor !== null && a.profundidadCorte >= a.espesor - 0.5
            ? `La fresa atraviesa la plancha (baja ${a.profundidadCorte} mm).`
            : `La fresa baja ${a.profundidadCorte} mm y la plancha tiene ${a.espesor} mm: no la atraviesa.`,
    },
    { ok: nombreAlumno.trim().length > 0, texto: nombreAlumno.trim() ? 'Tu nombre está escrito: el .json lo lleva.' : 'Falta tu nombre en el paso 1: el .json lo lleva para identificar la entrega.' },
  ]
  return r
}
