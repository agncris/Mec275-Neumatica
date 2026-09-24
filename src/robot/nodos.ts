/**
 * Programación visual por nodos, como Grasshopper con el complemento
 * KUKA|prc. Cada componente recibe listas por sus entradas y entrega listas
 * por sus salidas; la definición se evalúa de izquierda a derecha (según los
 * cables) cada vez que algo cambia.
 *
 * Los componentes y sus nombres cortos siguen a Grasshopper y KUKA|prc
 * (Divide Length, XY Plane, LIN, PTP, Core…), para que lo que se practica
 * aquí sirva igual en Rhino.
 */
import {
  areaCentro,
  cajaCurvas,
  circulo,
  desfasar,
  discontinuidades,
  dividirLargo,
  dividirPartes,
  largoCurva,
  mover,
  poligono,
  rectangulo,
  type Curva,
  type DibujoDXF,
} from './geometria'
import { aMundo, planoDe, planoXY, rad, rotZ, aplicar, suma, v, type Plano, type V3 } from './matematica'
import { HOME, ROBOTS, robotPorId, type ModeloRobot } from './robots'

// ---------------------------------------------------------------------------
// Datos que viajan por los cables
// ---------------------------------------------------------------------------
export type TipoDato = 'numero' | 'punto' | 'curva' | 'plano' | 'comando' | 'robot' | 'herramienta' | 'programa' | 'cualquiera' | 'booleano'

export interface RobotVirtual {
  modelo: ModeloRobot
  /** Altura del pedestal sobre el que va montado (mm). */
  pedestal: number
}

export type TipoHerramienta = 'fresa' | 'taladro' | 'ventosa' | 'lapiz' | 'personalizada'

export interface Herramienta {
  tipo: TipoHerramienta
  nombre: string
  largo: number
  diametro: number
}

export type Comando =
  | { tipo: 'LIN'; plano: Plano; vel: number; nodo: string }
  | { tipo: 'PTP'; plano: Plano; vel: number; nodo: string }
  | { tipo: 'CIR'; aux: Plano; plano: Plano; vel: number; nodo: string }
  | { tipo: 'AXIS'; q: number[]; vel: number; nodo: string }
  | { tipo: 'OUT'; salida: number; valor: boolean; nodo: string }
  | { tipo: 'WAIT'; seg: number; nodo: string }
  | { tipo: 'KRL'; texto: string; nodo: string }

export interface Programa {
  comandos: Comando[]
  robot: RobotVirtual
  herramienta: Herramienta
  /** Base (cero de la pieza) en coordenadas del mundo. */
  base: Plano
  /** Espesor de la plancha que se trabaja, para dibujarla. */
  espesor: number
  inicio: number[]
  nodo: string
}

export type Dato = number | boolean | V3 | Curva | Plano | Comando | RobotVirtual | Herramienta | Programa | string

// ---------------------------------------------------------------------------
// Definición (lo que se guarda)
// ---------------------------------------------------------------------------
export type ValorParam = number | string | boolean

export interface NodoDef {
  id: string
  tipo: string
  x: number
  y: number
  params: Record<string, ValorParam>
}

export interface Cable {
  de: string
  salida: number
  a: string
  entrada: number
}

export interface Definicion {
  version: 1
  tipo: 'definicion-robot'
  nombre: string
  nodos: NodoDef[]
  cables: Cable[]
  /** Plano DXF abierto (su texto), para que viaje con la definición. */
  dxf?: { nombre: string; texto: string } | null
}

export function esDefinicion(x: unknown): x is Definicion {
  const d = x as Definicion
  return !!d && d.tipo === 'definicion-robot' && Array.isArray(d.nodos) && Array.isArray(d.cables)
}

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------
export interface Puerto {
  nombre: string
  corto: string
  tipo: TipoDato
  descripcion: string
  /** Parámetro del nodo que se usa si la entrada no tiene cable. */
  param?: string
  opcional?: boolean
}

export interface ParamSpec {
  clave: string
  etiqueta: string
  tipo: 'numero' | 'texto' | 'opcion' | 'bool'
  defecto: ValorParam
  min?: number
  max?: number
  paso?: number
  opciones?: Array<[string, string]>
  /** Se muestra sólo si se cumple (por ejemplo, las medidas del robot personalizado). */
  si?: (params: Record<string, ValorParam>) => boolean
}

export type Pestana = 'Params' | 'Curve' | 'Vector' | 'Sets' | 'KUKA|prc'

export interface Componente {
  tipo: string
  nombre: string
  corto: string
  pestana: Pestana
  grupo: string
  descripcion: string
  entradas: Puerto[]
  salidas: Puerto[]
  params: ParamSpec[]
  evaluar: (entradas: Dato[][], params: Record<string, ValorParam>, ctx: Contexto) => ResultadoNodo
}

export interface Contexto {
  dxf: DibujoDXF | null
  id: string
}

export interface ResultadoNodo {
  salidas: Dato[][]
  avisos?: string[]
  error?: string
}

const n = (x: Dato | undefined, def = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : def)

// Robot personalizado: el alumno escribe las medidas de los eslabones (por
// ejemplo, las de la ficha de un robot que no está en la lista).
const esPropio = (p: Record<string, ValorParam>) => p.modelo === 'personalizado'
const MEDIDAS_PROPIAS: ParamSpec[] = [
  { clave: 'nombre', etiqueta: 'Nombre del robot', tipo: 'texto', defecto: 'Mi robot', si: esPropio },
  { clave: 'como', etiqueta: 'Rangos, velocidades y carga como el', tipo: 'opcion', defecto: 'kr6r900', opciones: ROBOTS.map((r): [string, string] => [r.id, r.nombre]), si: esPropio },
  { clave: 'd1', etiqueta: 'd1: altura del hombro (mm)', tipo: 'numero', defecto: 400, si: esPropio },
  { clave: 'a1', etiqueta: 'a1: avance del hombro (mm)', tipo: 'numero', defecto: 25, si: esPropio },
  { clave: 'a2', etiqueta: 'a2: largo del brazo (mm)', tipo: 'numero', defecto: 455, si: esPropio },
  { clave: 'a3', etiqueta: 'a3: desnivel del antebrazo (mm)', tipo: 'numero', defecto: 35, si: esPropio },
  { clave: 'd4', etiqueta: 'd4: largo del antebrazo (mm)', tipo: 'numero', defecto: 420, si: esPropio },
  { clave: 'd6', etiqueta: 'd6: muñeca al flange (mm)', tipo: 'numero', defecto: 80, si: esPropio },
]

function robotPropio(p: Record<string, ValorParam>): ModeloRobot | { error: string } {
  const b = robotPorId(String(p.como ?? 'kr6r900'))
  const m = (k: 'd1' | 'a1' | 'a2' | 'a3' | 'd4' | 'd6') => n(p[k] as number, b[k])
  const med = { d1: m('d1'), a1: m('a1'), a2: m('a2'), a3: m('a3'), d4: m('d4'), d6: m('d6') }
  if (med.a2 <= 0 || med.d4 <= 0) return { error: 'El brazo (a2) y el antebrazo (d4) tienen que medir más de 0 mm.' }
  if (med.d1 < 0 || med.a1 < 0 || med.d6 < 0) return { error: 'Las medidas d1, a1 y d6 no pueden ser negativas.' }
  return {
    ...b,
    ...med,
    id: 'personalizado',
    nombre: String(p.nombre || 'Robot personalizado'),
    familia: 'Personalizado',
    alcance: Math.round(med.a1 + med.a2 + Math.hypot(med.a3, med.d4)),
    descripcion: `Medidas propias, con los rangos, velocidades y carga del ${b.nombre}.`,
  }
}
const esCurva = (x: Dato): x is Curva => typeof x === 'object' && x !== null && 'pts' in x && 'cerrada' in x
const esPlano = (x: Dato): x is Plano => typeof x === 'object' && x !== null && 'o' in x && 'z' in x
const esPunto = (x: Dato): x is V3 => typeof x === 'object' && x !== null && 'x' in x && 'y' in x && 'z' in x && !('o' in x)
const esComando = (x: Dato): x is Comando => typeof x === 'object' && x !== null && 'tipo' in x && 'nodo' in x && !('comandos' in x)

/** Empareja listas como Grasshopper («longest list»): repite el último elemento de las cortas. */
function emparejar(listas: Dato[][]): Dato[][] {
  const largo = Math.max(0, ...listas.map((l) => l.length))
  if (listas.some((l) => l.length === 0)) return []
  return Array.from({ length: largo }, (_, i) => listas.map((l) => l[Math.min(i, l.length - 1)]))
}

/** Valor de una entrada o, si no tiene cable, del parámetro asociado. */
function entradaO(entradas: Dato[][], i: number, params: Record<string, ValorParam>, clave: string): Dato[] {
  if (entradas[i]?.length) return entradas[i]
  const p = params[clave]
  return p === undefined ? [] : [p as Dato]
}

const HERRAMIENTAS: Record<TipoHerramienta, { nombre: string; largo: number; diametro: number }> = {
  fresa: { nombre: 'Husillo con fresa', largo: 200, diametro: 5 },
  taladro: { nombre: 'Taladro', largo: 180, diametro: 8 },
  ventosa: { nombre: 'Ventosa de vacío', largo: 120, diametro: 40 },
  lapiz: { nombre: 'Portalápiz / marcador', largo: 150, diametro: 10 },
  personalizada: { nombre: 'Herramienta personalizada', largo: 150, diametro: 10 },
}

export const COMPONENTES: Componente[] = [
  // ------------------------------------------------------------------ Params
  {
    tipo: 'curvaDXF',
    nombre: 'Curve',
    corto: 'Crv',
    pestana: 'Params',
    grupo: 'Geometry',
    descripcion:
      'Toma las curvas del plano DXF abierto (en Rhino sería «Set one/multiple Curves» sobre el dibujo). Puedes elegir una capa y llevar el dibujo al origen.',
    entradas: [],
    salidas: [{ nombre: 'Curve', corto: 'C', tipo: 'curva', descripcion: 'Curvas del dibujo' }],
    params: [
      { clave: 'capa', etiqueta: 'Capa', tipo: 'texto', defecto: '' },
      { clave: 'alOrigen', etiqueta: 'Llevar la esquina inferior izquierda al origen', tipo: 'bool', defecto: true },
    ],
    evaluar(_e, p, ctx) {
      if (!ctx.dxf) return { salidas: [[]], error: 'No hay plano: abre un DXF con el botón «Abrir DXF».' }
      let cs = ctx.dxf.curvas
      const capa = String(p.capa ?? '').trim()
      if (capa) cs = cs.filter((c) => (c.capa ?? '0') === capa)
      if (!cs.length) return { salidas: [[]], error: capa ? `La capa «${capa}» no tiene curvas.` : 'El DXF no tiene curvas.' }
      if (p.alOrigen) {
        const { min } = cajaCurvas(cs)
        cs = cs.map((c) => mover(c, v(-min.x, -min.y, 0)))
      }
      return { salidas: [cs] }
    },
  },
  {
    tipo: 'slider',
    nombre: 'Number Slider',
    corto: 'Slider',
    pestana: 'Params',
    grupo: 'Input',
    descripcion: 'Entrada numérica que se ajusta arrastrando: sirve para probar valores (largos, velocidades, alturas) y ver el cambio al instante.',
    entradas: [],
    salidas: [{ nombre: 'Number', corto: 'N', tipo: 'numero', descripcion: 'Valor' }],
    params: [
      { clave: 'valor', etiqueta: 'Valor', tipo: 'numero', defecto: 10 },
      { clave: 'min', etiqueta: 'Mínimo', tipo: 'numero', defecto: 0 },
      { clave: 'max', etiqueta: 'Máximo', tipo: 'numero', defecto: 100 },
      { clave: 'paso', etiqueta: 'Paso', tipo: 'numero', defecto: 1 },
    ],
    evaluar: (_e, p) => ({ salidas: [[n(p.valor as number)]] }),
  },
  {
    tipo: 'punto',
    nombre: 'Point',
    corto: 'Pt',
    pestana: 'Params',
    grupo: 'Geometry',
    descripcion: 'Un punto con sus coordenadas X, Y, Z (mm).',
    entradas: [],
    salidas: [{ nombre: 'Point', corto: 'P', tipo: 'punto', descripcion: 'Punto' }],
    params: [
      { clave: 'x', etiqueta: 'X', tipo: 'numero', defecto: 0 },
      { clave: 'y', etiqueta: 'Y', tipo: 'numero', defecto: 0 },
      { clave: 'z', etiqueta: 'Z', tipo: 'numero', defecto: 0 },
    ],
    evaluar: (_e, p) => ({ salidas: [[v(n(p.x as number), n(p.y as number), n(p.z as number))]] }),
  },
  {
    tipo: 'panel',
    nombre: 'Panel',
    corto: 'Panel',
    pestana: 'Params',
    grupo: 'Input',
    descripcion: 'Muestra lo que le llega: sirve para revisar listas, valores y el análisis del programa.',
    entradas: [{ nombre: 'Datos', corto: '', tipo: 'cualquiera', descripcion: 'Cualquier dato' }],
    salidas: [],
    params: [],
    evaluar: () => ({ salidas: [] }),
  },
  // ------------------------------------------------------------------ Curve
  {
    tipo: 'rectangulo',
    nombre: 'Rectangle',
    corto: 'Rec',
    pestana: 'Curve',
    grupo: 'Primitive',
    descripcion: 'Rectángulo de X por Y (mm) con esquina en P; R redondea las esquinas.',
    entradas: [
      { nombre: 'Plane / Point', corto: 'P', tipo: 'punto', descripcion: 'Esquina (por omisión, el origen)', opcional: true },
      { nombre: 'X Size', corto: 'X', tipo: 'numero', descripcion: 'Ancho', param: 'x' },
      { nombre: 'Y Size', corto: 'Y', tipo: 'numero', descripcion: 'Alto', param: 'y' },
      { nombre: 'Radius', corto: 'R', tipo: 'numero', descripcion: 'Radio de las esquinas', param: 'r' },
    ],
    salidas: [{ nombre: 'Rectangle', corto: 'R', tipo: 'curva', descripcion: 'Rectángulo' }],
    params: [
      { clave: 'x', etiqueta: 'Ancho X', tipo: 'numero', defecto: 150 },
      { clave: 'y', etiqueta: 'Alto Y', tipo: 'numero', defecto: 100 },
      { clave: 'r', etiqueta: 'Radio', tipo: 'numero', defecto: 0 },
    ],
    evaluar(e, p) {
      const ps = e[0]?.length ? e[0] : [v()]
      const out = emparejar([ps, entradaO(e, 1, p, 'x'), entradaO(e, 2, p, 'y'), entradaO(e, 3, p, 'r')]).map(([o, x, y, r]) =>
        rectangulo(n(x), n(y), n(r), esPunto(o) ? o : esPlano(o) ? o.o : v()),
      )
      return { salidas: [out] }
    },
  },
  {
    tipo: 'circulo',
    nombre: 'Circle',
    corto: 'Cir',
    pestana: 'Curve',
    grupo: 'Primitive',
    descripcion: 'Círculo de centro P y radio R.',
    entradas: [
      { nombre: 'Plane / Point', corto: 'P', tipo: 'punto', descripcion: 'Centro', opcional: true },
      { nombre: 'Radius', corto: 'R', tipo: 'numero', descripcion: 'Radio', param: 'r' },
    ],
    salidas: [{ nombre: 'Circle', corto: 'C', tipo: 'curva', descripcion: 'Círculo' }],
    params: [{ clave: 'r', etiqueta: 'Radio', tipo: 'numero', defecto: 20 }],
    evaluar(e, p) {
      const ps = e[0]?.length ? e[0] : [v()]
      return { salidas: [emparejar([ps, entradaO(e, 1, p, 'r')]).map(([o, r]) => circulo(esPunto(o) ? o : esPlano(o) ? o.o : v(), n(r)))] }
    },
  },
  {
    tipo: 'poligono',
    nombre: 'Polygon',
    corto: 'Pol',
    pestana: 'Curve',
    grupo: 'Primitive',
    descripcion: 'Polígono regular de S lados inscrito en un círculo de radio R.',
    entradas: [
      { nombre: 'Plane / Point', corto: 'P', tipo: 'punto', descripcion: 'Centro', opcional: true },
      { nombre: 'Radius', corto: 'R', tipo: 'numero', descripcion: 'Radio', param: 'r' },
      { nombre: 'Segments', corto: 'S', tipo: 'numero', descripcion: 'Lados', param: 's' },
    ],
    salidas: [{ nombre: 'Polygon', corto: 'P', tipo: 'curva', descripcion: 'Polígono' }],
    params: [
      { clave: 'r', etiqueta: 'Radio', tipo: 'numero', defecto: 50 },
      { clave: 's', etiqueta: 'Lados', tipo: 'numero', defecto: 6 },
    ],
    evaluar(e, p) {
      const ps = e[0]?.length ? e[0] : [v()]
      return { salidas: [emparejar([ps, entradaO(e, 1, p, 'r'), entradaO(e, 2, p, 's')]).map(([o, r, s]) => poligono(n(s, 6), n(r), esPunto(o) ? o : v()))] }
    },
  },
  {
    tipo: 'dividirLargo',
    nombre: 'Divide Length',
    corto: 'DivLength',
    pestana: 'Curve',
    grupo: 'Division',
    descripcion: 'Divide una curva en tramos de largo fijo L: entrega los puntos (P) y la dirección de la curva en cada uno (T).',
    entradas: [
      { nombre: 'Curve', corto: 'C', tipo: 'curva', descripcion: 'Curva a dividir' },
      { nombre: 'Length', corto: 'L', tipo: 'numero', descripcion: 'Largo de cada tramo (mm)', param: 'l' },
    ],
    salidas: [
      { nombre: 'Points', corto: 'P', tipo: 'punto', descripcion: 'Puntos de división' },
      { nombre: 'Tangents', corto: 'T', tipo: 'punto', descripcion: 'Dirección de la curva' },
    ],
    params: [{ clave: 'l', etiqueta: 'Largo L', tipo: 'numero', defecto: 10 }],
    evaluar(e, p) {
      const pares = emparejar([e[0] ?? [], entradaO(e, 1, p, 'l')])
      if (!pares.length) return { salidas: [[], []] }
      const pts: V3[] = []
      const tan: V3[] = []
      for (const [c, l] of pares) {
        if (!esCurva(c)) return { salidas: [[], []], error: 'C debe ser una curva.' }
        if (n(l) <= 0) return { salidas: [[], []], error: 'El largo L debe ser mayor que 0.' }
        for (const d of dividirLargo(c, n(l))) {
          pts.push(d.p)
          tan.push(d.t)
        }
      }
      return { salidas: [pts, tan] }
    },
  },
  {
    tipo: 'dividirCurva',
    nombre: 'Divide Curve',
    corto: 'Divide',
    pestana: 'Curve',
    grupo: 'Division',
    descripcion: 'Divide una curva en N partes iguales.',
    entradas: [
      { nombre: 'Curve', corto: 'C', tipo: 'curva', descripcion: 'Curva a dividir' },
      { nombre: 'Count', corto: 'N', tipo: 'numero', descripcion: 'Número de partes', param: 'n' },
    ],
    salidas: [
      { nombre: 'Points', corto: 'P', tipo: 'punto', descripcion: 'Puntos' },
      { nombre: 'Tangents', corto: 'T', tipo: 'punto', descripcion: 'Direcciones' },
    ],
    params: [{ clave: 'n', etiqueta: 'Partes N', tipo: 'numero', defecto: 10 }],
    evaluar(e, p) {
      const pts: V3[] = []
      const tan: V3[] = []
      for (const [c, k] of emparejar([e[0] ?? [], entradaO(e, 1, p, 'n')])) {
        if (!esCurva(c)) return { salidas: [[], []], error: 'C debe ser una curva.' }
        for (const d of dividirPartes(c, n(k, 1))) {
          pts.push(d.p)
          tan.push(d.t)
        }
      }
      return { salidas: [pts, tan] }
    },
  },
  {
    tipo: 'discontinuidad',
    nombre: 'Discontinuity',
    corto: 'Disc',
    pestana: 'Curve',
    grupo: 'Analysis',
    descripcion: 'Encuentra los puntos donde la curva es discontinua (sus esquinas y extremos) y crea un punto en cada uno.',
    entradas: [{ nombre: 'Curve', corto: 'C', tipo: 'curva', descripcion: 'Curva' }],
    salidas: [{ nombre: 'Points', corto: 'P', tipo: 'punto', descripcion: 'Esquinas' }],
    params: [],
    evaluar(e) {
      const out: V3[] = []
      for (const c of e[0] ?? []) if (esCurva(c)) out.push(...discontinuidades(c))
      return { salidas: [out] }
    },
  },
  {
    tipo: 'area',
    nombre: 'Area',
    corto: 'Area',
    pestana: 'Curve',
    grupo: 'Analysis',
    descripcion: 'Área y centro (centroide) de curvas cerradas: sirve, por ejemplo, para encontrar el centro de cada agujero y taladrarlo.',
    entradas: [{ nombre: 'Geometry', corto: 'G', tipo: 'curva', descripcion: 'Curvas cerradas' }],
    salidas: [
      { nombre: 'Area', corto: 'A', tipo: 'numero', descripcion: 'Área (mm²)' },
      { nombre: 'Centroid', corto: 'C', tipo: 'punto', descripcion: 'Centro' },
    ],
    params: [],
    evaluar(e) {
      const areas: number[] = []
      const centros: V3[] = []
      for (const c of e[0] ?? []) {
        if (!esCurva(c)) return { salidas: [[], []], error: 'G debe recibir curvas.' }
        const { area, centro } = areaCentro(c)
        areas.push(area)
        centros.push(centro)
      }
      return { salidas: [areas, centros] }
    },
  },
  {
    tipo: 'desfase',
    nombre: 'Offset Curve',
    corto: 'Offset',
    pestana: 'Curve',
    grupo: 'Util',
    descripcion: 'Desplaza una curva una distancia D en su plano. Sirve para compensar el radio de la fresa: en curvas cerradas, D positivo va hacia fuera.',
    entradas: [
      { nombre: 'Curve', corto: 'C', tipo: 'curva', descripcion: 'Curva' },
      { nombre: 'Distance', corto: 'D', tipo: 'numero', descripcion: 'Distancia (mm)', param: 'd' },
    ],
    salidas: [{ nombre: 'Curve', corto: 'C', tipo: 'curva', descripcion: 'Curva desplazada' }],
    params: [{ clave: 'd', etiqueta: 'Distancia D', tipo: 'numero', defecto: 2.5 }],
    evaluar(e, p) {
      const out: Curva[] = []
      for (const [c, d] of emparejar([e[0] ?? [], entradaO(e, 1, p, 'd')])) if (esCurva(c)) out.push(desfasar(c, n(d)))
      return { salidas: [out] }
    },
  },
  {
    tipo: 'mover',
    nombre: 'Move',
    corto: 'Move',
    pestana: 'Vector',
    grupo: 'Transform',
    descripcion: 'Traslada puntos, curvas o planos: por ejemplo, subirlos en Z para la altura de seguridad o bajarlos para la profundidad de corte.',
    entradas: [
      { nombre: 'Geometry', corto: 'G', tipo: 'cualquiera', descripcion: 'Lo que se mueve' },
      { nombre: 'X', corto: 'X', tipo: 'numero', descripcion: 'Traslación en X', param: 'x' },
      { nombre: 'Y', corto: 'Y', tipo: 'numero', descripcion: 'Traslación en Y', param: 'y' },
      { nombre: 'Z', corto: 'Z', tipo: 'numero', descripcion: 'Traslación en Z', param: 'z' },
    ],
    salidas: [{ nombre: 'Geometry', corto: 'G', tipo: 'cualquiera', descripcion: 'Geometría movida' }],
    params: [
      { clave: 'x', etiqueta: 'X', tipo: 'numero', defecto: 0 },
      { clave: 'y', etiqueta: 'Y', tipo: 'numero', defecto: 0 },
      { clave: 'z', etiqueta: 'Z', tipo: 'numero', defecto: 20 },
    ],
    evaluar(e, p) {
      const out: Dato[] = []
      for (const [g, x, y, z] of emparejar([e[0] ?? [], entradaO(e, 1, p, 'x'), entradaO(e, 2, p, 'y'), entradaO(e, 3, p, 'z')])) {
        const d = v(n(x), n(y), n(z))
        if (esCurva(g)) out.push(mover(g, d))
        else if (esPlano(g)) out.push({ ...g, o: suma(g.o, d) })
        else if (esPunto(g)) out.push(suma(g, d))
        else return { salidas: [[]], error: 'G debe ser un punto, una curva o un plano.' }
      }
      return { salidas: [out] }
    },
  },
  {
    tipo: 'planoXY',
    nombre: 'XY Plane',
    corto: 'XY',
    pestana: 'Vector',
    grupo: 'Plane',
    descripcion: 'Crea un plano XY en cada punto. Los planos dicen hacia dónde apunta la herramienta del robot: con un plano XY la herramienta baja vertical sobre la pieza.',
    entradas: [{ nombre: 'Origin', corto: 'O', tipo: 'punto', descripcion: 'Origen de cada plano' }],
    salidas: [{ nombre: 'Plane', corto: 'P', tipo: 'plano', descripcion: 'Planos' }],
    params: [],
    evaluar(e) {
      const out: Plano[] = []
      for (const o of e[0] ?? []) {
        if (esPunto(o)) out.push(planoXY(o))
        else return { salidas: [[]], error: 'O debe recibir puntos.' }
      }
      return { salidas: [out] }
    },
  },
  {
    tipo: 'girarPlano',
    nombre: 'Rotate Plane',
    corto: 'PRot',
    pestana: 'Vector',
    grupo: 'Plane',
    descripcion: 'Gira los planos alrededor de su eje Z (A en grados): cambia el giro de la herramienta sin cambiar hacia dónde apunta.',
    entradas: [
      { nombre: 'Plane', corto: 'P', tipo: 'plano', descripcion: 'Planos' },
      { nombre: 'Angle', corto: 'A', tipo: 'numero', descripcion: 'Ángulo (°)', param: 'a' },
    ],
    salidas: [{ nombre: 'Plane', corto: 'P', tipo: 'plano', descripcion: 'Planos girados' }],
    params: [{ clave: 'a', etiqueta: 'Ángulo', tipo: 'numero', defecto: 90 }],
    evaluar(e, p) {
      const out: Plano[] = []
      for (const [pl, a] of emparejar([e[0] ?? [], entradaO(e, 1, p, 'a')])) {
        if (!esPlano(pl)) return { salidas: [[]], error: 'P debe recibir planos.' }
        const c = Math.cos(rad(n(a)))
        const s = Math.sin(rad(n(a)))
        const x = v(pl.x.x * c + pl.y.x * s, pl.x.y * c + pl.y.y * s, pl.x.z * c + pl.y.z * s)
        out.push(planoDe(pl.o, x, pl.z))
      }
      return { salidas: [out] }
    },
  },
  // ------------------------------------------------------------------ Sets
  {
    tipo: 'unir',
    nombre: 'Merge',
    corto: 'Merge',
    pestana: 'Sets',
    grupo: 'Tree',
    descripcion: 'Junta varias listas en una, en orden: primero D1, luego D2, luego D3.',
    entradas: [
      { nombre: 'Data 1', corto: 'D1', tipo: 'cualquiera', descripcion: 'Primera lista', opcional: true },
      { nombre: 'Data 2', corto: 'D2', tipo: 'cualquiera', descripcion: 'Segunda lista', opcional: true },
      { nombre: 'Data 3', corto: 'D3', tipo: 'cualquiera', descripcion: 'Tercera lista', opcional: true },
    ],
    salidas: [{ nombre: 'Result', corto: 'R', tipo: 'cualquiera', descripcion: 'Lista unida' }],
    params: [],
    evaluar: (e) => ({ salidas: [[...(e[0] ?? []), ...(e[1] ?? []), ...(e[2] ?? [])]] }),
  },
  {
    tipo: 'item',
    nombre: 'List Item',
    corto: 'Item',
    pestana: 'Sets',
    grupo: 'List',
    descripcion: 'Toma un elemento de una lista por su índice i (el primero es el 0; −1 es el último).',
    entradas: [
      { nombre: 'List', corto: 'L', tipo: 'cualquiera', descripcion: 'Lista' },
      { nombre: 'Index', corto: 'i', tipo: 'numero', descripcion: 'Índice', param: 'i' },
    ],
    salidas: [{ nombre: 'Element', corto: 'E', tipo: 'cualquiera', descripcion: 'Elemento' }],
    params: [{ clave: 'i', etiqueta: 'Índice i', tipo: 'numero', defecto: 0 }],
    evaluar(e, p) {
      const l = e[0] ?? []
      if (!l.length) return { salidas: [[]] }
      const out: Dato[] = []
      for (const i of entradaO(e, 1, p, 'i')) {
        const k = Math.round(n(i))
        const j = ((k % l.length) + l.length) % l.length
        out.push(l[j])
      }
      return { salidas: [out] }
    },
  },
  {
    tipo: 'invertir',
    nombre: 'Reverse List',
    corto: 'Rev',
    pestana: 'Sets',
    grupo: 'List',
    descripcion: 'Invierte el orden de una lista (por ejemplo, para recorrer una curva al revés).',
    entradas: [{ nombre: 'List', corto: 'L', tipo: 'cualquiera', descripcion: 'Lista' }],
    salidas: [{ nombre: 'List', corto: 'L', tipo: 'cualquiera', descripcion: 'Lista invertida' }],
    params: [],
    evaluar: (e) => ({ salidas: [[...(e[0] ?? [])].reverse()] }),
  },
  // ------------------------------------------------------------------ KUKA|prc
  {
    tipo: 'lin',
    nombre: 'LIN Movement',
    corto: 'LIN',
    pestana: 'KUKA|prc',
    grupo: '01 | Core',
    descripcion:
      'Mueve la herramienta en línea recta de un plano al siguiente, a la velocidad V (m/s). Es el movimiento para trabajar (fresar, dibujar); es más lento que PTP.',
    entradas: [
      { nombre: 'Plane', corto: 'P', tipo: 'plano', descripcion: 'Planos de destino' },
      { nombre: 'Velocity', corto: 'V', tipo: 'numero', descripcion: 'Velocidad (m/s)', param: 'v' },
    ],
    salidas: [{ nombre: 'Command', corto: 'C', tipo: 'comando', descripcion: 'Comandos LIN' }],
    params: [{ clave: 'v', etiqueta: 'Velocidad (m/s)', tipo: 'numero', defecto: 0.05 }],
    evaluar(e, p, ctx) {
      const out: Comando[] = []
      for (const [pl, vel] of emparejar([e[0] ?? [], entradaO(e, 1, p, 'v')])) {
        if (!esPlano(pl)) return { salidas: [[]], error: 'P debe recibir planos (usa XY Plane).' }
        out.push({ tipo: 'LIN', plano: pl, vel: Math.max(0.001, n(vel, 0.05)), nodo: ctx.id })
      }
      return { salidas: [out] }
    },
  },
  {
    tipo: 'ptp',
    nombre: 'PTP Movement',
    corto: 'PTP',
    pestana: 'KUKA|prc',
    grupo: '01 | Core',
    descripcion:
      'Lleva el robot a cada plano lo más rápido posible moviendo todos los ejes a la vez (punto a punto). La herramienta no va en línea recta: úsalo para acercarse o alejarse, nunca cortando.',
    entradas: [
      { nombre: 'Plane', corto: 'P', tipo: 'plano', descripcion: 'Planos de destino' },
      { nombre: 'Velocity', corto: 'V', tipo: 'numero', descripcion: 'Velocidad (% de la máxima)', param: 'v' },
    ],
    salidas: [{ nombre: 'Command', corto: 'C', tipo: 'comando', descripcion: 'Comandos PTP' }],
    params: [{ clave: 'v', etiqueta: 'Velocidad (%)', tipo: 'numero', defecto: 30 }],
    evaluar(e, p, ctx) {
      const out: Comando[] = []
      for (const [pl, vel] of emparejar([e[0] ?? [], entradaO(e, 1, p, 'v')])) {
        if (!esPlano(pl)) return { salidas: [[]], error: 'P debe recibir planos.' }
        out.push({ tipo: 'PTP', plano: pl, vel: Math.min(100, Math.max(1, n(vel, 30))), nodo: ctx.id })
      }
      return { salidas: [out] }
    },
  },
  {
    tipo: 'cir',
    nombre: 'CIR Movement',
    corto: 'CIR',
    pestana: 'KUKA|prc',
    grupo: '01 | Core',
    descripcion: 'Movimiento en arco: pasa por el plano auxiliar A y termina en el plano E, a la velocidad V (m/s).',
    entradas: [
      { nombre: 'Aux Plane', corto: 'A', tipo: 'plano', descripcion: 'Punto intermedio del arco' },
      { nombre: 'End Plane', corto: 'E', tipo: 'plano', descripcion: 'Final del arco' },
      { nombre: 'Velocity', corto: 'V', tipo: 'numero', descripcion: 'Velocidad (m/s)', param: 'v' },
    ],
    salidas: [{ nombre: 'Command', corto: 'C', tipo: 'comando', descripcion: 'Comandos CIR' }],
    params: [{ clave: 'v', etiqueta: 'Velocidad (m/s)', tipo: 'numero', defecto: 0.05 }],
    evaluar(e, p, ctx) {
      const out: Comando[] = []
      for (const [a, b, vel] of emparejar([e[0] ?? [], e[1] ?? [], entradaO(e, 2, p, 'v')])) {
        if (!esPlano(a) || !esPlano(b)) return { salidas: [[]], error: 'A y E deben recibir planos.' }
        out.push({ tipo: 'CIR', aux: a, plano: b, vel: Math.max(0.001, n(vel, 0.05)), nodo: ctx.id })
      }
      return { salidas: [out] }
    },
  },
  {
    tipo: 'axis',
    nombre: 'AXIS Movement',
    corto: 'Axis',
    pestana: 'KUKA|prc',
    grupo: '01 | Core',
    descripcion: 'Lleva el robot a una posición dada por el ángulo de cada eje (A1…A6), por ejemplo la posición de reposo.',
    entradas: [],
    salidas: [{ nombre: 'Command', corto: 'C', tipo: 'comando', descripcion: 'Comando AXIS' }],
    params: [
      { clave: 'a1', etiqueta: 'A1', tipo: 'numero', defecto: HOME[0] },
      { clave: 'a2', etiqueta: 'A2', tipo: 'numero', defecto: HOME[1] },
      { clave: 'a3', etiqueta: 'A3', tipo: 'numero', defecto: HOME[2] },
      { clave: 'a4', etiqueta: 'A4', tipo: 'numero', defecto: HOME[3] },
      { clave: 'a5', etiqueta: 'A5', tipo: 'numero', defecto: HOME[4] },
      { clave: 'a6', etiqueta: 'A6', tipo: 'numero', defecto: HOME[5] },
      { clave: 'v', etiqueta: 'Velocidad (%)', tipo: 'numero', defecto: 30 },
    ],
    evaluar: (_e, p, ctx) => ({
      salidas: [[{ tipo: 'AXIS', q: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((k) => n(p[k] as number)), vel: n(p.v as number, 30), nodo: ctx.id }]],
    }),
  },
  {
    tipo: 'core',
    nombre: 'KUKA|prc Core',
    corto: 'Core',
    pestana: 'KUKA|prc',
    grupo: '01 | Core',
    descripcion:
      'Arma todo: junta los comandos, el robot y la herramienta, hace la simulación, analiza si el robot alcanza cada punto sin salirse de sus límites y genera el código KRL. La base (B) es el cero de la pieza: la cara superior de la plancha sobre el mesón.',
    entradas: [
      { nombre: 'Commands', corto: 'C', tipo: 'comando', descripcion: 'Comandos, en orden' },
      { nombre: 'Robot', corto: 'R', tipo: 'robot', descripcion: 'Robot virtual' },
      { nombre: 'Tool', corto: 'T', tipo: 'herramienta', descripcion: 'Herramienta' },
      { nombre: 'Base', corto: 'B', tipo: 'plano', descripcion: 'Cero de la pieza (opcional: si no, se usan los parámetros)', opcional: true },
    ],
    salidas: [{ nombre: 'Program', corto: 'P', tipo: 'programa', descripcion: 'Programa listo para simular' }],
    params: [
      { clave: 'bx', etiqueta: 'Base X (mm)', tipo: 'numero', defecto: 450 },
      { clave: 'by', etiqueta: 'Base Y (mm)', tipo: 'numero', defecto: -150 },
      { clave: 'bz', etiqueta: 'Base Z: altura del mesón (mm)', tipo: 'numero', defecto: 300 },
      { clave: 'brot', etiqueta: 'Giro de la base (°)', tipo: 'numero', defecto: 0 },
      { clave: 'espesor', etiqueta: 'Espesor de la plancha (mm)', tipo: 'numero', defecto: 5 },
      { clave: 'ini', etiqueta: 'Empezar y terminar en HOME (con acercamiento PTP)', tipo: 'bool', defecto: true },
    ],
    evaluar(e, p, ctx) {
      const cmds = (e[0] ?? []).filter(esComando)
      const robot = (e[1] ?? []).find((x) => typeof x === 'object' && x !== null && 'modelo' in x) as RobotVirtual | undefined
      const herr = (e[2] ?? []).find((x) => typeof x === 'object' && x !== null && 'largo' in x && 'diametro' in x) as Herramienta | undefined
      if (!robot) return { salidas: [[]], error: 'Falta el robot (R): conecta un componente Robot.' }
      if (!herr) return { salidas: [[]], error: 'Falta la herramienta (T): conecta un componente Tool.' }
      if (!cmds.length) return { salidas: [[]], error: 'No hay comandos (C): conecta LIN, PTP u otros movimientos.' }
      const bIn = (e[3] ?? []).find(esPlano)
      const giro = rotZ(rad(n(p.brot as number)))
      const base: Plano = bIn ?? {
        o: v(n(p.bx as number), n(p.by as number), n(p.bz as number)),
        x: aplicar(giro, v(1, 0, 0)),
        y: aplicar(giro, v(0, 1, 0)),
        z: v(0, 0, 1),
      }
      let comandos: Comando[] = cmds
      if (p.ini !== false) {
        // Desde HOME la muñeca está en A5 = 0 (singular): si el primer
        // movimiento es LIN o CIR, se llega a su punto con PTP.
        const primero = cmds.find((c) => c.tipo === 'LIN' || c.tipo === 'CIR' || c.tipo === 'PTP' || c.tipo === 'AXIS')
        const acercar: Comando[] = primero && (primero.tipo === 'LIN' || primero.tipo === 'CIR') ? [{ tipo: 'PTP', plano: primero.plano, vel: 30, nodo: ctx.id }] : []
        comandos = [{ tipo: 'AXIS', q: [...HOME], vel: 50, nodo: ctx.id }, ...acercar, ...cmds, { tipo: 'AXIS', q: [...HOME], vel: 50, nodo: ctx.id }]
      }
      const prog: Programa = { comandos, robot, herramienta: herr, base, espesor: Math.max(0, n(p.espesor as number, 5)), inicio: [...HOME], nodo: ctx.id }
      return { salidas: [[prog]] }
    },
  },
  {
    tipo: 'robot',
    nombre: 'Robot',
    corto: 'Robot',
    pestana: 'KUKA|prc',
    grupo: '02 | Virtual Robot',
    descripcion: 'El robot que se simula, con su geometría, límites de sus ejes y velocidades. Elige el modelo según el alcance y la carga del trabajo.',
    entradas: [],
    salidas: [{ nombre: 'Robot', corto: 'R', tipo: 'robot', descripcion: 'Robot virtual' }],
    params: [
      { clave: 'modelo', etiqueta: 'Modelo', tipo: 'opcion', defecto: 'kr6r900', opciones: [...ROBOTS.map((r): [string, string] => [r.id, r.nombre]), ['personalizado', 'Personalizado (medidas propias)']] },
      { clave: 'pedestal', etiqueta: 'Altura del pedestal (mm)', tipo: 'numero', defecto: 0 },
      ...MEDIDAS_PROPIAS,
    ],
    evaluar: (_e, p) => {
      const modelo = String(p.modelo) === 'personalizado' ? robotPropio(p) : robotPorId(String(p.modelo))
      if ('error' in modelo) return { salidas: [[]], error: modelo.error }
      return { salidas: [[{ modelo, pedestal: Math.max(0, n(p.pedestal as number)) } as RobotVirtual]] }
    },
  },
  {
    tipo: 'herramienta',
    nombre: 'Tool',
    corto: 'Tool',
    pestana: 'KUKA|prc',
    grupo: '03 | Virtual Tool',
    descripcion: 'La herramienta montada en el flange: su largo define dónde está el punto de trabajo (TCP).',
    entradas: [],
    salidas: [{ nombre: 'Tool', corto: 'T', tipo: 'herramienta', descripcion: 'Herramienta' }],
    params: [
      {
        clave: 'tipo',
        etiqueta: 'Tipo',
        tipo: 'opcion',
        defecto: 'fresa',
        opciones: Object.entries(HERRAMIENTAS).map(([k, h]) => [k, h.nombre]),
      },
      { clave: 'largo', etiqueta: 'Largo hasta el TCP (mm)', tipo: 'numero', defecto: 200 },
      { clave: 'diametro', etiqueta: 'Diámetro (mm)', tipo: 'numero', defecto: 5 },
    ],
    evaluar(_e, p) {
      const tipo = (String(p.tipo) in HERRAMIENTAS ? String(p.tipo) : 'fresa') as TipoHerramienta
      return { salidas: [[{ tipo, nombre: HERRAMIENTAS[tipo].nombre, largo: Math.max(10, n(p.largo as number, 200)), diametro: Math.max(0.5, n(p.diametro as number, 5)) } as Herramienta]] }
    },
  },
  {
    tipo: 'kukaDividir',
    nombre: 'Divide Curve (KUKA|prc)',
    corto: 'DivC',
    pestana: 'KUKA|prc',
    grupo: '04 | Toolpath Utilities',
    descripcion: 'Divide una curva cada D mm y entrega directamente los planos para el robot, con su X a lo largo de la curva: la herramienta avanza orientada con el trazo.',
    entradas: [
      { nombre: 'Curve', corto: 'C', tipo: 'curva', descripcion: 'Curva' },
      { nombre: 'Distance', corto: 'D', tipo: 'numero', descripcion: 'Distancia entre planos (mm)', param: 'd' },
    ],
    salidas: [{ nombre: 'Planes', corto: 'P', tipo: 'plano', descripcion: 'Planos sobre la curva' }],
    params: [{ clave: 'd', etiqueta: 'Distancia D', tipo: 'numero', defecto: 10 }],
    evaluar(e, p) {
      const out: Plano[] = []
      for (const [c, d] of emparejar([e[0] ?? [], entradaO(e, 1, p, 'd')])) {
        if (!esCurva(c)) return { salidas: [[]], error: 'C debe ser una curva.' }
        if (n(d) <= 0) return { salidas: [[]], error: 'La distancia D debe ser mayor que 0.' }
        const puntos = dividirLargo(c, n(d))
        if (!c.cerrada && puntos.length) puntos.push({ p: c.pts[c.pts.length - 1], t: puntos[puntos.length - 1].t })
        if (c.cerrada && puntos.length) puntos.push(puntos[0])
        for (const q of puntos) out.push(planoDe(q.p, q.t, v(0, 0, 1)))
      }
      return { salidas: [out] }
    },
  },
  {
    tipo: 'salida',
    nombre: 'Set Digital Out',
    corto: 'DOut',
    pestana: 'KUKA|prc',
    grupo: '05 | Utilities',
    descripcion: 'Activa o desactiva una salida digital del controlador: encender el husillo, abrir o cerrar una pinza, activar la ventosa.',
    entradas: [],
    salidas: [{ nombre: 'Command', corto: 'C', tipo: 'comando', descripcion: 'Comando' }],
    params: [
      { clave: 'salida', etiqueta: 'Salida n°', tipo: 'numero', defecto: 1 },
      { clave: 'valor', etiqueta: 'Activar (TRUE)', tipo: 'bool', defecto: true },
    ],
    evaluar: (_e, p, ctx) => ({ salidas: [[{ tipo: 'OUT', salida: Math.max(1, Math.round(n(p.salida as number, 1))), valor: p.valor !== false, nodo: ctx.id }]] }),
  },
  {
    tipo: 'esperar',
    nombre: 'Wait',
    corto: 'Wait',
    pestana: 'KUKA|prc',
    grupo: '05 | Utilities',
    descripcion: 'Espera T segundos (por ejemplo, a que el husillo tome velocidad o a que la ventosa agarre).',
    entradas: [],
    salidas: [{ nombre: 'Command', corto: 'C', tipo: 'comando', descripcion: 'Comando' }],
    params: [{ clave: 't', etiqueta: 'Segundos', tipo: 'numero', defecto: 1 }],
    evaluar: (_e, p, ctx) => ({ salidas: [[{ tipo: 'WAIT', seg: Math.max(0, n(p.t as number, 1)), nodo: ctx.id }]] }),
  },
  {
    tipo: 'krl',
    nombre: 'Custom KRL',
    corto: 'KRL',
    pestana: 'KUKA|prc',
    grupo: '01 | Core',
    descripcion: 'Una línea de código KRL escrita a mano, que se copia tal cual en el programa (no se simula).',
    entradas: [],
    salidas: [{ nombre: 'Command', corto: 'C', tipo: 'comando', descripcion: 'Comando' }],
    params: [{ clave: 'texto', etiqueta: 'Código KRL', tipo: 'texto', defecto: '; comentario' }],
    evaluar: (_e, p, ctx) => ({ salidas: [[{ tipo: 'KRL', texto: String(p.texto ?? ''), nodo: ctx.id }]] }),
  },
  {
    tipo: 'tejer',
    nombre: 'Command Weaver',
    corto: 'Weave',
    pestana: 'KUKA|prc',
    grupo: '05 | Utilities',
    descripcion:
      'Combina varias listas de comandos en una sola. «En secuencia» pone primero todos los de C1, luego C2 y C3; «Intercalar» los alterna uno a uno (C1[0], C2[0], C1[1], C2[1]…).',
    entradas: [
      { nombre: 'Commands 1', corto: 'C1', tipo: 'comando', descripcion: 'Comandos', opcional: true },
      { nombre: 'Commands 2', corto: 'C2', tipo: 'comando', descripcion: 'Comandos', opcional: true },
      { nombre: 'Commands 3', corto: 'C3', tipo: 'comando', descripcion: 'Comandos', opcional: true },
    ],
    salidas: [{ nombre: 'Commands', corto: 'C', tipo: 'comando', descripcion: 'Comandos combinados' }],
    params: [
      {
        clave: 'modo',
        etiqueta: 'Modo',
        tipo: 'opcion',
        defecto: 'secuencia',
        opciones: [
          ['secuencia', 'En secuencia'],
          ['intercalar', 'Intercalar'],
        ],
      },
    ],
    evaluar(e, p) {
      const ls = [e[0] ?? [], e[1] ?? [], e[2] ?? []]
      if (p.modo !== 'intercalar') return { salidas: [ls.flat()] }
      const out: Dato[] = []
      const m = Math.max(...ls.map((l) => l.length))
      for (let i = 0; i < m; i++) for (const l of ls) if (i < l.length) out.push(l[i])
      return { salidas: [out] }
    },
  },
]

export function componente(tipo: string): Componente | undefined {
  return COMPONENTES.find((c) => c.tipo === tipo)
}

export function paramsIniciales(c: Componente): Record<string, ValorParam> {
  return Object.fromEntries(c.params.map((p) => [p.clave, p.defecto]))
}

// ---------------------------------------------------------------------------
// Evaluación de la definición
// ---------------------------------------------------------------------------
export type EstadoNodo = 'ok' | 'aviso' | 'error'

export interface EvaluacionNodo {
  salidas: Dato[][]
  estado: EstadoNodo
  mensajes: string[]
}

export interface Evaluacion {
  nodos: Record<string, EvaluacionNodo>
  programas: Programa[]
  /** Hay un ciclo entre cables. */
  ciclo: boolean
}

export function evaluar(def: Definicion, dxf: DibujoDXF | null): Evaluacion {
  const porId = new Map(def.nodos.map((x) => [x.id, x]))
  const entrantes = new Map<string, Cable[]>()
  for (const c of def.cables) {
    if (!porId.has(c.de) || !porId.has(c.a)) continue
    const l = entrantes.get(c.a) ?? []
    l.push(c)
    entrantes.set(c.a, l)
  }
  // Orden topológico.
  const grado = new Map(def.nodos.map((x) => [x.id, 0]))
  for (const c of def.cables) if (porId.has(c.de) && porId.has(c.a)) grado.set(c.a, (grado.get(c.a) ?? 0) + 1)
  const cola = def.nodos.filter((x) => (grado.get(x.id) ?? 0) === 0).map((x) => x.id)
  const orden: string[] = []
  while (cola.length) {
    const id = cola.shift() as string
    orden.push(id)
    for (const c of def.cables) {
      if (c.de !== id || !porId.has(c.a)) continue
      grado.set(c.a, (grado.get(c.a) ?? 0) - 1)
      if (grado.get(c.a) === 0) cola.push(c.a)
    }
  }
  const ciclo = orden.length < def.nodos.length
  const res: Record<string, EvaluacionNodo> = {}
  for (const nodo of def.nodos) if (!orden.includes(nodo.id)) res[nodo.id] = { salidas: [], estado: 'error', mensajes: ['Este componente forma parte de un ciclo de cables: una salida no puede volver a su propia entrada.'] }
  const programas: Programa[] = []
  for (const id of orden) {
    const nodo = porId.get(id) as NodoDef
    const comp = componente(nodo.tipo)
    if (!comp) {
      res[id] = { salidas: [], estado: 'error', mensajes: [`Componente desconocido «${nodo.tipo}».`] }
      continue
    }
    const entradas: Dato[][] = comp.entradas.map(() => [])
    for (const c of entrantes.get(id) ?? []) {
      const origen = res[c.de]
      const datos = origen?.salidas[c.salida] ?? []
      if (entradas[c.entrada]) entradas[c.entrada].push(...datos)
    }
    const faltan = comp.entradas.filter((p, i) => !p.opcional && !p.param && !entradas[i].length && p.tipo !== 'cualquiera')
    const faltanCualquiera = comp.entradas.filter((p, i) => !p.opcional && p.tipo === 'cualquiera' && !entradas[i].length && comp.tipo !== 'panel')
    if (faltan.length || faltanCualquiera.length) {
      res[id] = {
        salidas: comp.salidas.map(() => []),
        estado: 'aviso',
        mensajes: [`Faltan datos en: ${[...faltan, ...faltanCualquiera].map((p) => `${p.corto} (${p.nombre})`).join(', ')}.`],
      }
      if (comp.tipo !== 'core') continue
    }
    try {
      const r = comp.evaluar(entradas, { ...paramsIniciales(comp), ...nodo.params }, { dxf, id })
      const mensajes = [...(res[id]?.mensajes ?? []), ...(r.avisos ?? []), ...(r.error ? [r.error] : [])]
      const estado: EstadoNodo = r.error ? (res[id]?.estado === 'aviso' ? 'aviso' : 'error') : res[id]?.estado === 'aviso' || r.avisos?.length ? 'aviso' : 'ok'
      res[id] = { salidas: r.salidas, estado, mensajes }
      if (comp.tipo === 'core') for (const pr of r.salidas[0] ?? []) programas.push(pr as Programa)
    } catch (err) {
      res[id] = { salidas: comp.salidas.map(() => []), estado: 'error', mensajes: [err instanceof Error ? err.message : 'Error al evaluar.'] }
    }
  }
  return { nodos: res, programas, ciclo }
}

/** Texto corto de un dato, para el Panel y las ayudas. */
export function describirDato(d: Dato): string {
  const f = (x: number) => String(Math.round(x * 100) / 100)
  if (typeof d === 'number') return f(d)
  if (typeof d === 'boolean') return d ? 'True' : 'False'
  if (typeof d === 'string') return d
  if (esCurva(d)) return `Curva ${d.cerrada ? 'cerrada' : 'abierta'} · ${f(largoCurva(d))} mm`
  if (esPlano(d)) return `Plano O(${f(d.o.x)}, ${f(d.o.y)}, ${f(d.o.z)})`
  if (esPunto(d)) return `{${f(d.x)}, ${f(d.y)}, ${f(d.z)}}`
  if (esComando(d)) {
    if (d.tipo === 'LIN' || d.tipo === 'PTP') return `${d.tipo} → (${f(d.plano.o.x)}, ${f(d.plano.o.y)}, ${f(d.plano.o.z)})`
    if (d.tipo === 'CIR') return `CIR → (${f(d.plano.o.x)}, ${f(d.plano.o.y)}, ${f(d.plano.o.z)})`
    if (d.tipo === 'AXIS') return `AXIS {${d.q.map(f).join(', ')}}`
    if (d.tipo === 'OUT') return `$OUT[${d.salida}] = ${d.valor ? 'TRUE' : 'FALSE'}`
    if (d.tipo === 'WAIT') return `WAIT SEC ${d.seg}`
    return `KRL: ${d.texto}`
  }
  if (typeof d === 'object' && d && 'modelo' in d) return `Robot ${(d as RobotVirtual).modelo.nombre}`
  if (typeof d === 'object' && d && 'diametro' in d) return `Tool ${(d as Herramienta).nombre} (${(d as Herramienta).largo} mm)`
  if (typeof d === 'object' && d && 'comandos' in d) return `Programa: ${(d as Programa).comandos.length} comandos`
  return '?'
}

/** Planos de los comandos del programa en coordenadas del mundo (para dibujarlos). */
export function planoMundo(p: Programa, pl: Plano): Plano {
  return aMundo(p.base, pl)
}

