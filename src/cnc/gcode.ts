/**
 * Intérprete de código G (norma DIN 66024/66025, dialecto tipo Fanuc como el
 * de CNC Simulator Pro).
 *
 * Lee el programa bloque por bloque, lleva el estado modal (G90/G91, G21,
 * plano, avance, husillo…) y lo traduce a «pasos»: tramos rectos o arcos ya
 * divididos en segmentos, pausas y cambios de herramienta, cada uno con su
 * línea de origen y su duración. El simulador recorre esos pasos.
 *
 * En el torno X es el DIÁMETRO (como en la máquina y en los planos) y los
 * arcos van en el plano Z-X: con Z hacia la derecha y X hacia arriba, G02
 * gira como el reloj y G03 al revés. I y K son las distancias del inicio al
 * centro del arco (I en radio). U y W son movimientos incrementales en X y Z.
 */
import type { TipoMaquina } from './maquinas'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type TipoPaso = 'rapido' | 'corte' | 'pausa' | 'herramienta'
export type Husillo = 'cw' | 'ccw' | 'off'

export interface Paso {
  /** Línea del programa (desde 0). */
  linea: number
  tipo: TipoPaso
  /** Polilínea del recorrido (el primer punto es la posición de partida). */
  puntos: Vec3[]
  largo: number
  /** Segundos que tarda la máquina. */
  duracion: number
  /** Avance efectivo en mm/min (0 en pausas). */
  avance: number
  codigo: string
  herramienta: number
  husillo: Husillo
  rpm: number
  refrigerante: boolean
  /** M00 / M01: la máquina se detiene hasta que se pulse «Continuar». */
  parada?: boolean
  /** Roscado (G33 / G76): paso de la rosca, para dibujar el filete. */
  paso?: number
  /** Cero del programa vigente (en coordenadas de la máquina simulada). */
  origen: Vec3
  /** Compensación de radio (G41/G42) que afecta a este paso. */
  comp?: { lado: 41 | 42; r: number; fase: 'arranque' | 'activa' | 'salida' }
}

export type Nivel = 'error' | 'aviso' | 'info'

export interface Diagnostico {
  linea: number
  nivel: Nivel
  texto: string
}

export interface EstadoModal {
  movimiento: number
  absoluto: boolean
  pulgadas: boolean
  plano: 17 | 18 | 19
  avancePorVuelta: boolean
  velocidadConstante: boolean
  avance: number
  s: number
  herramienta: number
  husillo: Husillo
  refrigerante: boolean
  pos: Vec3
  /** Dónde está el cero del programa (lo mueve G92). */
  origen: Vec3
  /** Tope de rpm con velocidad de corte constante (G92 S… en el torno). */
  rpmMax: number
  ciclo: { r: number; z: number; q: number; retorno: 98 | 99; zInicial: number } | null
  /** Primer bloque del ciclo de roscado G76. */
  g76: { repasos: number; angulo: number; minimo: number; acabado: number } | null
  /** Primer bloque del ciclo de desbaste G71 (profundidad y retiro, en radio). */
  g71: { prof: number; retiro: number } | null
  /** Compensación de radio vigente (40 = sin compensación). */
  comp: 40 | 41 | 42
}

export interface PuntoPrograma {
  linea: number
  /** En la máquina simulada. */
  pos: Vec3
  /** Como se programó (respecto del cero del programa). */
  prog: Vec3
  codigo: string
}

export interface ResultadoGcode {
  maquina: TipoMaquina
  pasos: Paso[]
  diagnosticos: Diagnostico[]
  /** Estado modal ANTES de cada línea (para explicar el bloque). */
  estados: EstadoModal[]
  /** Fin de cada bloque con movimiento, para la tabla de coordenadas. */
  puntos: PuntoPrograma[]
  /** Línea donde está el primer error (el programa corre sólo hasta ahí). */
  primerError: number | null
  tiempoTotal: number
  /** Líneas con código pero sin comentario. */
  sinComentario: number[]
  lineas: number
  /** Número de bruto pedido con $AddRegPart (CNC Simulator Pro), si lo hay. */
  addRegPart: number | null
}

export interface OpcionesInterprete {
  /** Cero del programa al empezar (por omisión, el de la máquina simulada). */
  origen?: Vec3
  /** Radio de la herramienta o corrector n (para G41/G42 en la fresadora). */
  radio?: (n: number) => number | undefined
}

export interface LineaAnalizada {
  palabras: Array<{ letra: string; valor: number; texto: string }>
  comentario: string
  directiva: string | null
  resto: string | null
  vacia: boolean
}

const NUM = /^([A-Za-z])\s*([+-]?(?:\d+\.?\d*|\.\d+))/

/** Separa una línea en palabras (letra + número) y comentario. */
export function analizarLinea(texto: string): LineaAnalizada {
  let t = texto
  const comentarios: string[] = []
  t = t.replace(/\(([^)]*)\)?/g, (_, c: string) => {
    comentarios.push(c.trim())
    return ' '
  })
  const pc = t.search(/;|\/\//)
  if (pc >= 0) {
    comentarios.push(t.slice(pc).replace(/^(;|\/\/)/, '').trim())
    t = t.slice(0, pc)
  }
  t = t.trim()
  const comentario = comentarios.filter(Boolean).join(' · ')
  if (t.startsWith('%') || t === '') return { palabras: [], comentario, directiva: null, resto: null, vacia: t === '' || t.startsWith('%') }
  if (t.startsWith('$')) return { palabras: [], comentario, directiva: t.slice(1).trim(), resto: null, vacia: false }
  if (t.startsWith('/')) t = t.slice(1).trim() // salto de bloque opcional: se ejecuta igual
  // ET: herramienta integrada de CNC Simulator Pro; aquí equivale a T.
  t = t.replace(/(^|[\s\d.])ET\s*(\d+)/gi, '$1T$2')
  const palabras: LineaAnalizada['palabras'] = []
  let resto: string | null = null
  while (t.length) {
    const m = NUM.exec(t)
    if (!m) {
      resto = t.split(/\s+/)[0]
      break
    }
    palabras.push({ letra: m[1].toUpperCase(), valor: Number(m[2]), texto: `${m[1].toUpperCase()}${m[2]}` })
    t = t.slice(m[0].length).trim()
  }
  return { palabras, comentario, directiva: null, resto, vacia: palabras.length === 0 && resto === null }
}

// ---------------------------------------------------------------------------
// Diccionario de códigos (también lo usa «Explicar bloque» y la teoría)
// ---------------------------------------------------------------------------
export const CODIGOS_G: Record<string, string> = {
  G00: 'Posicionamiento rápido: va a máxima velocidad, sin cortar',
  G01: 'Interpolación lineal: corta en línea recta al avance F',
  G02: 'Interpolación circular en sentido horario (CW)',
  G03: 'Interpolación circular en sentido antihorario (CCW)',
  G04: 'Pausa (dwell): espera el tiempo indicado con X o P',
  G17: 'Plano de trabajo XY',
  G18: 'Plano de trabajo XZ (el del torno)',
  G19: 'Plano de trabajo YZ',
  G20: 'Programar en pulgadas',
  G21: 'Programar en milímetros',
  G28: 'Volver a la posición de referencia (home)',
  G33: 'Roscado: avance sincronizado con el giro (F = paso de la rosca)',
  G40: 'Cancelar la compensación de radio: el centro de la herramienta vuelve a seguir la trayectoria programada',
  G41: 'Compensación de radio a la izquierda: la herramienta va corrida un radio a la izquierda del contorno, mirando en el sentido del avance',
  G42: 'Compensación de radio a la derecha: la herramienta va corrida un radio a la derecha del contorno, mirando en el sentido del avance',
  G54: 'Usar el cero pieza 1',
  G70: 'Unidad de medida en pulgadas (DIN). En el torno, G70 P… Q… es el ciclo de acabado: recorre el perfil de los bloques P a Q',
  G71: 'Unidad de medida en milímetros (DIN). En el torno, G71 U… R… y G71 P… Q… es el ciclo de desbaste del perfil',
  G80: 'Cancelar ciclo fijo de taladrado',
  G81: 'Ciclo de taladrado: baja a Z al avance F y sube en rápido',
  G76: 'Ciclo de roscado en el torno (dos bloques: parámetros y rosca)',
  G83: 'Ciclo de taladrado por picoteo: baja de a Q mm y sale a botar la viruta',
  G90: 'Coordenadas absolutas: medidas desde el cero pieza',
  G91: 'Coordenadas incrementales: medidas desde la posición actual',
  G92: 'Mover el cero: la posición actual pasa a tener las coordenadas indicadas (en el torno, G92 S… limita las rpm)',
  G94: 'Avance F en mm/min',
  G95: 'Avance F en mm por vuelta del husillo',
  G96: 'Velocidad de corte constante: S en m/min',
  G97: 'Velocidad de husillo constante: S en rpm',
  G98: 'En ciclos fijos, volver al plano inicial',
  G99: 'En ciclos fijos, volver al plano R',
}

export const CODIGOS_M: Record<string, string> = {
  M00: 'Detención obligatoria del programa (se sigue con «Continuar»)',
  M01: 'Detención opcional del programa',
  M02: 'Fin de programa',
  M03: 'Encender husillo en sentido horario',
  M04: 'Encender husillo en sentido antihorario',
  M05: 'Parar husillo',
  M06: 'Cambio automático de herramienta',
  M07: 'Inicio del aporte de rocío enfriador',
  M08: 'Encender líquido refrigerante',
  M09: 'Apagar líquido refrigerante',
  M30: 'Fin de programa con vuelta al inicio',
  M98: 'Llamar a un subprograma (P = su número O, L = cuántas veces)',
  M99: 'Fin del subprograma: vuelve al bloque siguiente al M98',
}

export function codigo(letra: 'G' | 'M', v: number): string {
  const n = Math.round(v * 10) / 10
  return `${letra}${Number.isInteger(n) && n < 10 ? '0' : ''}${n}`
}

// ---------------------------------------------------------------------------
// Intérprete
// ---------------------------------------------------------------------------
const RAPIDO = { torno: 6000, fresadora: 5000 }
const RPM_MAX = { torno: 4000, fresadora: 12000 }
const G_CONOCIDOS = new Set([0, 1, 2, 3, 4, 17, 18, 19, 20, 21, 28, 33, 40, 41, 42, 54, 55, 56, 57, 58, 59, 70, 71, 76, 80, 81, 83, 90, 91, 92, 94, 95, 96, 97, 98, 99])
const M_CONOCIDOS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 30, 98, 99])

export function interpretar(texto: string, maquina: TipoMaquina, casa: Vec3, opciones: OpcionesInterprete = {}): ResultadoGcode {
  const lineas = texto.replace(/\r/g, '').split('\n')
  const an = lineas.map(analizarLinea)
  const diagnosticos: Diagnostico[] = []
  const pasos: Paso[] = []
  const estados: EstadoModal[] = new Array(lineas.length)
  const puntos: PuntoPrograma[] = []
  const sinComentario: number[] = []
  const torno = maquina === 'torno'
  let primerError: number | null = null
  /** Cuántos pasos quedan válidos: el programa corre sólo hasta el primer error. */
  let corte: number | null = null
  let inicioBloque = 0
  const diag = (linea: number, nivel: Nivel, t: string) => {
    diagnosticos.push({ linea, nivel, texto: t })
    if (nivel === 'error') {
      if (primerError === null) primerError = linea
      if (corte === null) corte = inicioBloque
    }
  }

  // Números de bloque (N) y de programa (O), para los ciclos y los subprogramas.
  const numeros = new Map<number, number>()
  const programas = new Map<number, number>()
  let primeraCodigo = -1
  an.forEach((a, i) => {
    if (a.vacia || a.directiva !== null || a.resto !== null) return
    if (primeraCodigo < 0) primeraCodigo = i
    if (!a.comentario) sinComentario.push(i)
    const nn = a.palabras.find((p) => p.letra === 'N')
    if (nn && !numeros.has(nn.valor)) numeros.set(nn.valor, i)
    const o = a.palabras.find((p) => p.letra === 'O')
    if (o && !programas.has(o.valor)) programas.set(o.valor, i)
  })
  // Líneas que son subprogramas (de O… hasta M99).
  const enSub = new Uint8Array(lineas.length)
  for (const [num, i] of programas) {
    if (i === primeraCodigo) continue
    let k = i
    for (; k < lineas.length; k++) {
      enSub[k] = 1
      if (an[k].palabras.some((p) => p.letra === 'M' && p.valor === 99)) break
    }
    if (k >= lineas.length) diag(i, 'aviso', `El subprograma O${num} no termina con M99.`)
  }

  const e: EstadoModal = {
    movimiento: 0,
    absoluto: true,
    pulgadas: false,
    plano: torno ? 18 : 17,
    avancePorVuelta: false,
    velocidadConstante: false,
    avance: 0,
    s: 0,
    herramienta: 1,
    husillo: 'off',
    refrigerante: false,
    pos: { ...casa },
    origen: { x: 0, y: 0, z: 0, ...opciones.origen },
    rpmMax: RPM_MAX[maquina],
    ciclo: null,
    g76: null,
    g71: null,
    comp: 40,
  }
  let addRegPart: number | null = null
  let unidadesDichas = false
  let fin: number | null = null
  let herramientaElegida = false
  let tAvisado = false
  let sinFAvisado = false
  let compAvisada = false
  let pendienteT: number | null = null
  // Compensación de radio en la fresadora.
  let faseComp: 'nada' | 'arranque' | 'activa' | 'cancelando' = 'nada'
  let radioComp = 0
  let ladoAnterior: 41 | 42 = 41

  const rpmEn = (xDiam: number) => {
    if (e.husillo === 'off') return 0
    if (e.velocidadConstante && torno) {
      const d = Math.max(Math.abs(xDiam), 1)
      return Math.min(e.rpmMax, (1000 * e.s) / (Math.PI * d))
    }
    return e.s
  }
  const agregar = (linea: number, tipo: TipoPaso, pts: Vec3[], avance: number, cod: string, extra: Partial<Paso> = {}) => {
    let largo = 0
    for (let i = 1; i < pts.length; i++) largo += dist(pts[i - 1], pts[i])
    const duracion = extra.duracion ?? (avance > 0 ? (largo / avance) * 60 : 0)
    let comp: Paso['comp']
    if (faseComp !== 'nada' && e.comp !== 40 && faseComp !== 'cancelando') {
      const enXY = pts.some((p) => Math.hypot(p.x - pts[0].x, p.y - pts[0].y) > 1e-6)
      if (faseComp === 'arranque') {
        if (enXY) {
          comp = { lado: e.comp, r: radioComp, fase: 'arranque' }
          faseComp = 'activa'
        }
      } else comp = { lado: e.comp, r: radioComp, fase: 'activa' }
    } else if (faseComp === 'cancelando') {
      const enXY = pts.some((p) => Math.hypot(p.x - pts[0].x, p.y - pts[0].y) > 1e-6)
      comp = { lado: ladoAnterior, r: radioComp, fase: enXY ? 'salida' : 'activa' }
      if (enXY) faseComp = 'nada'
    }
    pasos.push({
      linea,
      tipo,
      puntos: pts,
      largo,
      duracion,
      avance,
      codigo: cod,
      herramienta: e.herramienta,
      husillo: e.husillo,
      rpm: rpmEn(e.pos.x),
      refrigerante: e.refrigerante,
      origen: { ...e.origen },
      ...extra,
      ...(comp ? { comp } : {}),
    })
  }
  const avanceMmMin = (linea: number): number => {
    let f = e.avance
    if (f <= 0) {
      if (!sinFAvisado) diag(linea, 'error', 'Falta el avance F: un movimiento de corte (G01/G02/G03) necesita saber a qué velocidad avanzar.')
      sinFAvisado = true
      return 0
    }
    if (e.avancePorVuelta) {
      const rpm = rpmEn(e.pos.x)
      if (rpm <= 0) {
        diag(linea, 'error', 'Con G95 el avance es por vuelta, pero el husillo está detenido: enciéndelo con M03 o M04.')
        return 0
      }
      f = f * rpm
    }
    return f
  }

  const pila: Array<{ vuelta: number; quedan: number; inicio: number; o: number }> = []
  const ejecutada = new Uint8Array(lineas.length)
  let ejecutadas = 0
  let siguiente = 0
  for (let n = 0; n < lineas.length; n = siguiente) {
    siguiente = n + 1
    inicioBloque = pasos.length
    if (++ejecutadas > 20000) {
      diag(n, 'error', 'El programa no termina: se repite sin fin. Revisa los M98 y M99.')
      break
    }
    if (!estados[n]) estados[n] = clonarEstado(e)
    ejecutada[n] = 1
    const a = an[n]
    if (a.directiva !== null) {
      const d = a.directiva.toLowerCase()
      if (d.startsWith('millimeter')) {
        e.pulgadas = false
        unidadesDichas = true
      } else if (d.startsWith('inch')) {
        e.pulgadas = true
        unidadesDichas = true
      } else if (d.startsWith('addregpart')) {
        const m = /addregpart\s*[, ]?\s*(\d+)/i.exec(a.directiva)
        addRegPart = m ? Number(m[1]) : 1
      }
      continue
    }
    if (a.vacia) continue
    if (a.resto !== null) {
      diag(n, 'error', `No entiendo «${a.resto}». Cada palabra es una letra seguida de un número, por ejemplo G01 o X25.5. Los comentarios van entre paréntesis ( ) o después de ;`)
      continue
    }
    // Bloque O: nombre del programa o comienzo de un subprograma.
    const oPal = a.palabras.find((p) => p.letra === 'O')
    if (oPal) {
      if (n === primeraCodigo) continue
      if (pila.length) {
        diag(n, 'error', `Falta M99 al final del subprograma O${pila[pila.length - 1].o}: la ejecución llegó al bloque O${oPal.valor}.`)
        break
      }
      diag(n, 'aviso', `El programa principal llega al subprograma O${oPal.valor} sin haber terminado: falta M30 antes de los subprogramas.`)
      fin = n
      break
    }

    // Reunir las palabras del bloque.
    const gs: number[] = []
    const ms: number[] = []
    const val: Record<string, number> = {}
    let error = false
    for (const p of a.palabras) {
      if (p.letra === 'G') gs.push(p.valor)
      else if (p.letra === 'M') ms.push(p.valor)
      else if (p.letra in val) {
        diag(n, 'error', `La letra ${p.letra} aparece dos veces en el mismo bloque.`)
        error = true
      } else val[p.letra] = p.valor
    }
    if (error) continue
    for (const l of Object.keys(val)) {
      if ('NXYZUVWIJKRFSTPODHQL'.indexOf(l) < 0) {
        if ('ABC'.includes(l)) diag(n, 'aviso', `${l} es un eje rotativo: esta máquina no lo tiene y se ignora.`)
        else diag(n, 'aviso', `La letra ${l} no se usa en esta máquina y se ignora.`)
      }
    }
    if (torno && ('Y' in val || 'V' in val || 'J' in val)) {
      diag(n, 'error', 'El torno trabaja sólo en X (diámetro) y Z: no tiene eje Y (ni V ni J).')
      continue
    }
    for (const g of gs) if (!G_CONOCIDOS.has(g)) diag(n, 'aviso', `${codigo('G', g)} no está disponible en este simulador y se ignora.`)
    for (const m of ms) if (!M_CONOCIDOS.has(m)) diag(n, 'aviso', `${codigo('M', m)} no está disponible en este simulador y se ignora.`)
    const tieneG = (g: number) => gs.includes(g)
    const tieneM = (m: number) => ms.includes(m)
    // G70/G71 son unidades (DIN) o, con P y Q (o U y R), los ciclos del torno.
    const esG71 = tieneG(71) && (('P' in val && 'Q' in val) || ('U' in val && 'R' in val && !('X' in val) && !('Z' in val)))
    const esG70 = tieneG(70) && 'P' in val && 'Q' in val

    // 1. Modos.
    if ((tieneG(20) || tieneG(70)) && !esG70) {
      e.pulgadas = true
      unidadesDichas = true
    }
    if ((tieneG(21) || tieneG(71)) && !esG71) {
      e.pulgadas = false
      unidadesDichas = true
    }
    if (tieneG(90)) e.absoluto = true
    if (tieneG(91)) e.absoluto = false
    if (tieneG(17) || tieneG(18) || tieneG(19)) {
      const p = tieneG(17) ? 17 : tieneG(18) ? 18 : 19
      if (torno && p !== 18) diag(n, 'aviso', 'El torno trabaja siempre en el plano XZ (G18).')
      else e.plano = p
    }
    if (tieneG(94)) e.avancePorVuelta = false
    if (tieneG(95)) e.avancePorVuelta = true
    if (tieneG(96)) {
      if (torno) e.velocidadConstante = true
      else diag(n, 'aviso', 'G96 (velocidad de corte constante) es propio del torno.')
    }
    if (tieneG(97)) e.velocidadConstante = false
    const esc = e.pulgadas ? 25.4 : 1
    if ('F' in val) {
      if (val.F < 0) diag(n, 'error', 'El avance F no puede ser negativo.')
      e.avance = val.F * esc
    }
    if ('S' in val && !(torno && tieneG(92))) {
      if (val.S < 0) diag(n, 'error', 'La velocidad S no puede ser negativa.')
      e.s = val.S
      if (!e.velocidadConstante && val.S > RPM_MAX[maquina]) diag(n, 'aviso', `S${val.S}: la máquina llega a ${RPM_MAX[maquina]} rpm como máximo.`)
    }
    // 2. Herramienta.
    let cambio: number | null = null
    if ('T' in val) {
      // T0101 (torno: herramienta 01, corrector 01) o T1 / T01.
      const tt = Math.round(val.T)
      const num = torno && tt >= 100 ? Math.floor(tt / 100) : tt
      if (torno || tieneM(6)) cambio = num
      else {
        // En la fresadora T sólo prepara la herramienta: se monta con M06.
        pendienteT = num
        diag(n, 'info', `T${num} prepara la herramienta; se monta en el husillo con M06.`)
      }
    }
    if (tieneM(6) && !torno) {
      if (cambio === null) cambio = pendienteT ?? e.herramienta
    }
    if (cambio !== null) {
      if (e.comp !== 40 && !torno) diag(n, 'aviso', 'Cambias de herramienta con la compensación de radio activa: cancélala antes con G40.')
      e.herramienta = cambio
      herramientaElegida = true
      pendienteT = null
      agregar(n, 'herramienta', [{ ...e.pos }], 0, `T${cambio}`, { duracion: torno ? 1 : 2 })
    }
    // Compensación de radio (G41/G42/G40).
    if (tieneG(41) || tieneG(42)) {
      if (torno) {
        if (!compAvisada) diag(n, 'info', 'En el torno la compensación del radio de la punta (G41/G42) no se simula: las herramientas tienen punta viva.')
        compAvisada = true
      } else if (e.plano !== 17) {
        diag(n, 'aviso', 'La compensación de radio se simula sólo en el plano XY (G17).')
      } else {
        const nr = 'D' in val ? Math.round(val.D) : e.herramienta
        const r = nr === 0 ? 0 : opciones.radio?.(nr)
        if (r === undefined) diag(n, 'aviso', `No hay una herramienta ${nr} para leer su radio: se compensa con radio 0.`)
        radioComp = r ?? 0
        if (faseComp === 'cancelando') faseComp = 'activa'
        else if (e.comp === 40) faseComp = 'arranque'
        e.comp = tieneG(41) ? 41 : 42
        ladoAnterior = e.comp
      }
    }
    if (tieneG(40) && !torno && e.comp !== 40) {
      ladoAnterior = e.comp
      e.comp = 40
      faseComp = faseComp === 'arranque' ? 'nada' : 'cancelando'
    }
    // 3. Husillo y refrigerante que empiezan antes del movimiento.
    if (tieneM(3)) e.husillo = 'cw'
    if (tieneM(4)) e.husillo = 'ccw'
    if (tieneM(7) || tieneM(8)) e.refrigerante = true
    if (tieneM(3) || tieneM(4)) {
      if (e.s <= 0) diag(n, 'aviso', 'Se enciende el husillo sin velocidad: indica S (por ejemplo S1500).')
      agregar(n, 'pausa', [{ ...e.pos }], 0, tieneM(3) ? 'M03' : 'M04', { duracion: 0.6 })
    }

    // 4. Movimiento.
    const mov = gs.filter((g) => [0, 1, 2, 3, 33, 81, 83].includes(g))
    if (mov.length > 1) {
      diag(n, 'error', `Hay dos movimientos en el mismo bloque (${mov.map((g) => codigo('G', g)).join(' y ')}).`)
      continue
    }
    if (mov.length) {
      e.movimiento = mov[0]
      if (mov[0] < 80) e.ciclo = null
    }
    if (tieneG(80)) {
      e.ciclo = null
      if (e.movimiento >= 80) e.movimiento = 0
    }
    const ejes = torno ? ['X', 'Z', 'U', 'W'] : ['X', 'Y', 'Z', 'U', 'V', 'W']
    const hayEjes = ejes.some((l) => l in val)
    const destino = (): Vec3 => destinoDe(val, e.pos, e.origen, e.absoluto, esc)

    if (tieneG(92)) {
      // G92: la posición actual pasa a tener las coordenadas indicadas.
      let movio = false
      for (const [k, l] of [
        ['x', 'X'],
        ['y', 'Y'],
        ['z', 'Z'],
      ] as Array<[keyof Vec3, string]>) {
        if (l in val) {
          e.origen[k] = e.pos[k] - val[l] * esc
          movio = true
        }
      }
      if (torno && 'S' in val) e.rpmMax = val.S
      if (movio) diag(n, 'info', `G92: el cero del programa se mueve; desde aquí la posición actual es ${['X', 'Y', 'Z'].filter((l) => l in val).map((l) => `${l}${val[l]}`).join(' ')}.`)
    } else if (esG71 || esG70) {
      const nombre = esG71 ? 'G71 (ciclo de desbaste)' : 'G70 (ciclo de acabado)'
      if (!torno) {
        diag(n, 'error', `${nombre} es propio del torno. En la fresadora, G70 y G71 sólo eligen pulgadas o milímetros.`)
        continue
      }
      if (esG71 && !('P' in val)) {
        // Primer bloque: U = profundidad de cada pasada (en radio), R = retiro.
        if (val.U <= 0) diag(n, 'error', 'En G71 U… R…, U es la profundidad de cada pasada (en radio) y tiene que ser positiva.')
        else e.g71 = { prof: val.U * esc, retiro: Math.abs(val.R) * esc }
      } else {
        const ns = numeros.get(val.P)
        const nf = numeros.get(val.Q)
        if (ns === undefined || nf === undefined || nf < ns) {
          diag(n, 'error', `${nombre}: no encuentro el perfil. P y Q son los números N del primer y del último bloque del contorno (por ejemplo P10 Q90 para los bloques N10 a N90).`)
          continue
        }
        const perfil = leerPerfil(an, ns, nf, e, esc)
        if ('error' in perfil) {
          diag(perfil.linea, 'error', perfil.error)
          continue
        }
        const inicio = { ...e.pos }
        if (esG71) {
          const prof = 'D' in val ? (val.D >= 100 ? val.D / 1000 : val.D) * esc : e.g71?.prof
          if (!prof || prof <= 0) {
            diag(n, 'error', 'Falta la profundidad de pasada de G71: escribe antes un bloque G71 U… R… (U = profundidad en radio, R = retiro).')
            continue
          }
          const f = avanceMmMin(n)
          if (f <= 0) continue
          const r = desbasteG71(perfil.tramos, inicio, prof, e.g71?.retiro ?? 0.5, (val.U ?? 0) * esc, (val.W ?? 0) * esc)
          if ('error' in r) {
            diag(n, 'error', r.error)
            continue
          }
          if (r.rebajes) diag(n, 'info', 'El perfil tiene rebajes (el diámetro vuelve a achicarse): G71 desbasta en escalones y los rebajes quedan para la pasada que sigue el contorno.')
          for (const m of r.movs) agregar(n, m.corte ? 'corte' : 'rapido', m.pts, m.corte ? f : RAPIDO.torno, 'G71')
        } else {
          for (const t of perfil.tramos) {
            if (t.tipo === 'rapido') agregar(t.linea, 'rapido', t.pts, RAPIDO.torno, 'G70')
            else {
              let f = t.f ?? e.avance
              if (f <= 0) {
                diag(n, 'error', 'Falta el avance F del acabado: ponlo en el bloque G70 o en los bloques del perfil.')
                break
              }
              if (e.avancePorVuelta) f *= rpmEn(t.pts[0].x)
              if (f <= 0) {
                diag(n, 'error', 'Con G95 el avance es por vuelta, pero el husillo está detenido: enciéndelo con M03 o M04.')
                break
              }
              agregar(t.linea, 'corte', t.pts, f, 'G70')
            }
          }
          const ult = perfil.tramos[perfil.tramos.length - 1].pts.slice(-1)[0]
          agregar(n, 'rapido', [{ ...ult }, { ...ult, x: inicio.x }, { ...inicio }], RAPIDO.torno, 'G70')
        }
        e.pos = inicio
        puntos.push({ linea: n, pos: { ...inicio }, prog: resta(inicio, e.origen), codigo: esG71 ? 'G71' : 'G70' })
        // Los bloques del perfil no se ejecutan de nuevo.
        if (ns > n) siguiente = nf + 1
      }
    } else if (tieneG(76)) {
      if (!torno) {
        diag(n, 'error', 'G76 (ciclo de roscado) es propio del torno.')
        continue
      }
      const conDestino = 'X' in val || 'Z' in val || 'U' in val || 'W' in val
      if (!conDestino) {
        // Primer bloque: P = repasos, salida y ángulo (010060); Q = pasada mínima (µm); R = acabado (mm).
        const pp = Math.round(val.P ?? 10060)
        e.g76 = { repasos: Math.max(0, Math.floor(pp / 10000)), angulo: pp % 100 || 60, minimo: (val.Q ?? 50) / 1000, acabado: val.R ?? 0 }
      } else {
        const g = e.g76 ?? { repasos: 1, angulo: 60, minimo: 0.05, acabado: 0 }
        if (!('P' in val) || !('Q' in val) || !('F' in val)) {
          diag(n, 'error', 'El segundo bloque de G76 necesita X (diámetro del fondo), Z (fin de la rosca), P (altura del filete en µm), Q (primera pasada en µm) y F (paso).')
          continue
        }
        const rpm = rpmEn(e.pos.x)
        if (rpm <= 0) {
          diag(n, 'error', 'Para roscar (G76) el husillo tiene que estar girando.')
          continue
        }
        const d = destino()
        const pitch = val.F * esc
        const h = (val.P / 1000) * esc
        const q1 = (val.Q / 1000) * esc
        const mayor = d.x + 2 * h
        const ini = { ...e.pos }
        if (ini.x < mayor) diag(n, 'aviso', 'G76 empieza bajo el diámetro exterior de la rosca: parte con X mayor que el diámetro nominal.')
        const prof: number[] = []
        for (let k = 1; k < 200; k++) {
          const dk = Math.max(q1 * Math.sqrt(k), (prof[prof.length - 1] ?? 0) + g.minimo)
          if (dk >= h - g.acabado) break
          prof.push(dk)
        }
        if (g.acabado > 0) prof.push(h - g.acabado)
        prof.push(h)
        for (let k = 0; k < g.repasos; k++) prof.push(h)
        for (const dk of prof) {
          const xc = mayor - 2 * dk
          agregar(n, 'rapido', [{ ...ini }, { ...ini, x: xc }], RAPIDO.torno, 'G76')
          agregar(n, 'corte', [{ ...ini, x: xc }, { ...ini, x: xc, z: d.z }], pitch * rpm, 'G76', { paso: pitch })
          agregar(n, 'rapido', [{ ...ini, x: xc, z: d.z }, { ...ini, z: d.z }], RAPIDO.torno, 'G76')
          agregar(n, 'rapido', [{ ...ini, z: d.z }, { ...ini }], RAPIDO.torno, 'G76')
        }
        puntos.push({ linea: n, pos: { ...ini }, prog: resta(ini, e.origen), codigo: 'G76' })
      }
    } else if (tieneG(4)) {
      const seg = 'X' in val ? val.X : 'U' in val ? val.U : 'P' in val ? (val.P >= 100 ? val.P / 1000 : val.P) : 0
      if (seg <= 0) diag(n, 'aviso', 'G04 sin tiempo: indica los segundos con X (G04 X1.5) o los milisegundos con P (G04 P1500).')
      agregar(n, 'pausa', [{ ...e.pos }], 0, 'G04', { duracion: Math.max(0, seg) })
    } else if (tieneG(28)) {
      const inter = hayEjes ? destino() : { ...e.pos }
      if (hayEjes && dist(inter, e.pos) > 1e-6) agregar(n, 'rapido', [{ ...e.pos }, inter], RAPIDO[maquina], 'G28')
      const fin3 = { ...inter }
      const todos = !hayEjes
      if (todos || 'X' in val || 'U' in val) fin3.x = casa.x
      if (todos || 'Y' in val || 'V' in val) fin3.y = casa.y
      if (todos || 'Z' in val || 'W' in val) fin3.z = casa.z
      agregar(n, 'rapido', [{ ...inter }, fin3], RAPIDO[maquina], 'G28')
      e.pos = fin3
      puntos.push({ linea: n, pos: { ...fin3 }, prog: resta(fin3, e.origen), codigo: 'G28' })
    } else if (hayEjes || (e.movimiento >= 2 && e.movimiento <= 3 && ('I' in val || 'J' in val || 'K' in val))) {
      const d = destino()
      const m = e.movimiento
      if (m === 0) {
        agregar(n, 'rapido', [{ ...e.pos }, d], RAPIDO[maquina], 'G00')
      } else if (m === 1 || m === 33) {
        if (m === 33 && !torno) {
          diag(n, 'error', 'G33 (roscado) es propio del torno.')
          continue
        }
        const f = m === 33 ? e.avance * rpmEn(e.pos.x) : avanceMmMin(n)
        if (m === 33 && rpmEn(e.pos.x) <= 0) diag(n, 'error', 'Para roscar (G33) el husillo tiene que estar girando.')
        if (f <= 0) continue
        agregar(n, 'corte', [{ ...e.pos }, d], f, m === 33 ? 'G33' : 'G01', m === 33 ? { paso: e.avance } : {})
      } else if (m === 2 || m === 3) {
        const f = avanceMmMin(n)
        if (f <= 0) continue
        const arco = puntosArco(e.pos, d, m === 2, val, esc, e.plano, torno)
        if ('error' in arco) {
          diag(n, 'error', arco.error)
          continue
        }
        if (faseComp === 'arranque' || (faseComp === 'cancelando' && e.plano === 17)) diag(n, 'aviso', 'La compensación de radio se activa y se cancela en un bloque recto (G00 o G01), no en un arco.')
        agregar(n, 'corte', arco.puntos, f, codigo('G', m))
      } else if (m === 81 || m === 83) {
        if (!e.ciclo || 'R' in val || 'Z' in val || 'Q' in val) {
          const zIni = e.ciclo?.zInicial ?? e.pos.z
          const r = 'R' in val ? (e.absoluto ? e.origen.z + val.R * esc : zIni + val.R * esc) : e.ciclo?.r
          const zc = 'Z' in val ? (e.absoluto ? e.origen.z + val.Z * esc : (r ?? zIni) + val.Z * esc) : e.ciclo?.z
          if (r === undefined || zc === undefined) {
            diag(n, 'error', `${codigo('G', m)} necesita el plano de aproximación R y la profundidad Z.`)
            continue
          }
          e.ciclo = { r, z: zc, q: 'Q' in val ? val.Q * esc : e.ciclo?.q ?? 0, retorno: tieneG(99) ? 99 : 98, zInicial: zIni }
        }
        if (tieneG(98)) e.ciclo.retorno = 98
        if (tieneG(99)) e.ciclo.retorno = 99
        const f = avanceMmMin(n)
        if (f <= 0) continue
        const c = e.ciclo
        const xy = { x: 'X' in val || 'U' in val ? d.x : e.pos.x, y: 'Y' in val || 'V' in val ? d.y : e.pos.y }
        if (torno && Math.abs(xy.x - e.origen.x) > 0.2) diag(n, 'aviso', 'En el torno el taladrado se hace en el eje: X0.')
        const p0 = { ...e.pos }
        const sobre = { ...xy, z: e.pos.z }
        agregar(n, 'rapido', [p0, sobre], RAPIDO[maquina], codigo('G', m))
        agregar(n, 'rapido', [sobre, { ...xy, z: c.r }], RAPIDO[maquina], codigo('G', m))
        if (m === 83 && c.q > 0) {
          let z = c.r
          while (z > c.z + 1e-6) {
            const hasta = Math.max(c.z, z - c.q)
            agregar(n, 'corte', [{ ...xy, z: z === c.r ? c.r : z + 0.5 }, { ...xy, z: hasta }], f, 'G83')
            agregar(n, 'rapido', [{ ...xy, z: hasta }, { ...xy, z: c.r }], RAPIDO[maquina], 'G83')
            if (hasta > c.z + 1e-6) agregar(n, 'rapido', [{ ...xy, z: c.r }, { ...xy, z: hasta + 0.5 }], RAPIDO[maquina], 'G83')
            z = hasta
          }
        } else {
          agregar(n, 'corte', [{ ...xy, z: c.r }, { ...xy, z: c.z }], f, codigo('G', m))
          agregar(n, 'rapido', [{ ...xy, z: c.z }, { ...xy, z: c.r }], RAPIDO[maquina], codigo('G', m))
        }
        const zf = c.retorno === 98 ? c.zInicial : c.r
        if (zf !== c.r) agregar(n, 'rapido', [{ ...xy, z: c.r }, { ...xy, z: zf }], RAPIDO[maquina], codigo('G', m))
        d.x = xy.x
        d.y = xy.y
        d.z = zf
      }
      if (e.movimiento !== 0 && e.movimiento !== 81 && e.movimiento !== 83 && torno && d.x < -0.001) {
        diag(n, 'aviso', 'X negativo en el torno: la herramienta pasa al otro lado del eje de giro.')
      }
      e.pos = d
      puntos.push({ linea: n, pos: { ...d }, prog: resta(d, e.origen), codigo: codigo('G', e.movimiento) })
    } else if (('I' in val || 'J' in val || 'K' in val || 'R' in val) && !tieneG(4)) {
      diag(n, 'aviso', 'I, J, K o R sin coordenadas de destino: el bloque no mueve la máquina.')
    }

    // 5. Lo que ocurre después del movimiento.
    if (tieneM(5)) {
      e.husillo = 'off'
      agregar(n, 'pausa', [{ ...e.pos }], 0, 'M05', { duracion: 0.5 })
    }
    if (tieneM(9)) e.refrigerante = false
    if (tieneM(0) || tieneM(1)) agregar(n, 'pausa', [{ ...e.pos }], 0, tieneM(0) ? 'M00' : 'M01', { duracion: 0, parada: true })
    if (tieneM(98)) {
      // Llamada a subprograma: M98 P1000 L3, o M98 P31000 (3 veces el O1000).
      if (!('P' in val)) diag(n, 'error', 'M98 necesita P con el número del subprograma, por ejemplo M98 P1000.')
      else {
        let num = Math.round(val.P)
        let veces = 'L' in val ? Math.round(val.L) : 1
        if (!('L' in val) && num > 9999 && !programas.has(num)) {
          veces = Math.floor(num / 10000)
          num = num % 10000
        }
        const ini = programas.get(num)
        if (ini === undefined || ini === primeraCodigo) diag(n, 'error', `No existe el subprograma O${num}: escríbelo después del M30, empezando con el bloque O${num} y terminando con M99.`)
        else if (pila.length >= 8) diag(n, 'error', 'Demasiados subprogramas uno dentro de otro (el máximo es 8).')
        else if (veces > 0) {
          pila.push({ vuelta: n + 1, quedan: veces - 1, inicio: ini + 1, o: num })
          siguiente = ini + 1
        }
      }
    }
    if (tieneM(99)) {
      const tope = pila[pila.length - 1]
      if (!tope) {
        diag(n, 'aviso', 'M99 en el programa principal: la máquina volvería al comienzo sin parar; aquí se toma como fin de programa.')
        fin = n
        siguiente = lineas.length
      } else if (tope.quedan > 0) {
        tope.quedan--
        siguiente = tope.inicio
      } else {
        pila.pop()
        siguiente = tope.vuelta
      }
    }
    if (tieneM(2) || tieneM(30)) {
      fin = n
      e.husillo = 'off'
      e.refrigerante = false
      if (pila.length) diag(n, 'aviso', 'El fin de programa quedó dentro de un subprograma: el subprograma termina con M99.')
      siguiente = lineas.length
    }
    if (!herramientaElegida && !tAvisado && pasos.some((p) => p.tipo === 'corte')) {
      tAvisado = true
      diag(n, 'info', `No se eligió herramienta: se trabaja con la T${e.herramienta} que está montada.`)
    }
  }
  if (e.comp !== 40 && faseComp !== 'nada') diag(lineas.length - 1, 'aviso', 'La compensación de radio queda activa al final: cancélala con G40 en un bloque de salida.')

  // Lo que no se ejecutó: errores de escritura y líneas después del fin.
  inicioBloque = pasos.length
  let avisoTrasFin = false
  for (let i = 0; i < lineas.length; i++) {
    if (!estados[i]) estados[i] = clonarEstado(i > 0 ? estados[i - 1] : e)
    if (ejecutada[i] || an[i].vacia || an[i].directiva !== null) continue
    if (an[i].resto !== null) {
      diag(i, 'error', `No entiendo «${an[i].resto}». Cada palabra es una letra seguida de un número, por ejemplo G01 o X25.5. Los comentarios van entre paréntesis ( ) o después de ;`)
      continue
    }
    if (fin !== null && i > fin && !enSub[i] && !avisoTrasFin) {
      diag(i, 'aviso', `Esta línea está después del fin de programa (línea ${fin + 1}): no se ejecuta.`)
      avisoTrasFin = true
    }
  }

  if (!unidadesDichas) diag(0, 'aviso', 'No indicas las unidades: se asume milímetros. Escribe G21 al comienzo del programa.')
  if (fin === null && pasos.length) diag(lineas.length - 1, 'aviso', 'Falta el fin de programa (M30 o M02).')

  // Si hay un error, el programa corre sólo hasta el bloque anterior.
  const validos = corte === null ? pasos : pasos.slice(0, corte)
  compensar(validos, (linea, t) => diag(linea, 'aviso', t))
  diagnosticos.sort((x, y) => x.linea - y.linea || orden(x.nivel) - orden(y.nivel))
  return {
    maquina,
    pasos: validos,
    diagnosticos,
    estados,
    puntos,
    primerError,
    tiempoTotal: validos.reduce((s, p) => s + p.duracion, 0),
    sinComentario,
    lineas: lineas.length,
    addRegPart,
  }
}

function destinoDe(val: Record<string, number>, pos: Vec3, origen: Vec3, absoluto: boolean, esc: number): Vec3 {
  const d = { ...pos }
  const ax: Array<[keyof Vec3, string, string]> = [
    ['x', 'X', 'U'],
    ['y', 'Y', 'V'],
    ['z', 'Z', 'W'],
  ]
  for (const [k, abs, inc] of ax) {
    if (abs in val) d[k] = absoluto ? origen[k] + val[abs] * esc : pos[k] + val[abs] * esc
    if (inc in val) d[k] = pos[k] + val[inc] * esc
  }
  return d
}

interface Tramo {
  linea: number
  tipo: 'rapido' | 'corte'
  pts: Vec3[]
  f?: number
}

/** Lee el contorno de los bloques ns a nf (para G71 y G70). */
function leerPerfil(an: LineaAnalizada[], ns: number, nf: number, e: EstadoModal, esc: number): { tramos: Tramo[] } | { error: string; linea: number } {
  let mov = [0, 1, 2, 3].includes(e.movimiento) ? e.movimiento : 1
  let absoluto = e.absoluto
  let pos = { ...e.pos }
  let f: number | undefined
  const tramos: Tramo[] = []
  for (let i = ns; i <= nf; i++) {
    const a = an[i]
    if (a.vacia || a.directiva !== null) continue
    if (a.resto !== null) return { linea: i, error: `No entiendo «${a.resto}» en el perfil.` }
    const val: Record<string, number> = {}
    for (const p of a.palabras) {
      if (p.letra === 'G') {
        if ([0, 1, 2, 3].includes(p.valor)) mov = p.valor
        else if (p.valor === 90) absoluto = true
        else if (p.valor === 91) absoluto = false
        else if (![40, 41, 42].includes(p.valor)) return { linea: i, error: `El perfil de G71/G70 sólo puede tener movimientos G00, G01, G02 y G03 (aparece ${codigo('G', p.valor)}).` }
      } else if (p.letra === 'M') return { linea: i, error: 'El perfil de G71/G70 no puede tener funciones M.' }
      else val[p.letra] = p.valor
    }
    if ('F' in val) f = val.F * esc
    if ('Y' in val) return { linea: i, error: 'El torno no tiene eje Y.' }
    if (!['X', 'Z', 'U', 'W'].some((l) => l in val)) continue
    const d = destinoDe(val, pos, e.origen, absoluto, esc)
    if (mov === 0 || mov === 1) tramos.push({ linea: i, tipo: mov === 0 ? 'rapido' : 'corte', pts: [{ ...pos }, d], f })
    else {
      const arco = puntosArco(pos, d, mov === 2, val, esc, 18, true)
      if ('error' in arco) return { linea: i, error: arco.error }
      tramos.push({ linea: i, tipo: 'corte', pts: arco.puntos, f })
    }
    pos = d
  }
  if (!tramos.length) return { linea: ns, error: 'El perfil (bloques P a Q) no tiene movimientos.' }
  return { tramos }
}

/**
 * Desbaste G71 (tipo I, como Fanuc): pasadas paralelas a Z de profundidad
 * «prof» (en radio) desde el punto de partida hasta el contorno con su
 * sobremetal (du en diámetro, dw en Z), y al final una pasada siguiendo el
 * contorno. Sirve para exterior (el perfil está bajo el punto de partida) y
 * para interior (sobre él).
 */
function desbasteG71(
  tramos: Tramo[],
  inicio: Vec3,
  prof: number,
  retiro: number,
  du: number,
  dw: number,
): { movs: Array<{ corte: boolean; pts: Vec3[] }>; rebajes: boolean } | { error: string } {
  const bruto = tramos.flatMap((t) => t.pts.slice(1))
  const c = bruto.map((p) => ({ ...p, x: p.x + du, z: p.z + dw }))
  if (!c.length) return { error: 'El perfil de G71 está vacío.' }
  const x0 = c[0].x
  const s = x0 < inicio.x ? -1 : 1 // −1: exterior (se baja el diámetro); +1: interior
  if (Math.abs(x0 - inicio.x) < 1e-6) return { error: 'G71: el primer bloque del perfil tiene que llevar la herramienta al diámetro inicial del contorno (por ejemplo N10 G00 X20).' }
  const niveles = Math.abs(inicio.x - x0) / (2 * prof)
  if (niveles > 400) return { error: 'G71: son demasiadas pasadas; revisa U (profundidad en radio) y el punto de partida.' }
  let rebajes = false
  for (let i = 1; i < c.length; i++) if (s * (c[i].x - c[i - 1].x) > 0.01) rebajes = true
  const zS = inicio.z
  const dz = Math.sign(c[c.length - 1].z - zS) || -1
  const tol = 1e-6
  const hastaDonde = (xc: number): number => {
    for (let i = 0; i < c.length; i++) {
      if (s * (c[i].x - xc) < -tol) {
        if (i === 0) return zS
        const a = c[i - 1]
        const b = c[i]
        const t = (xc - a.x) / (b.x - a.x)
        return a.z + (b.z - a.z) * t
      }
    }
    return c[c.length - 1].z
  }
  const movs: Array<{ corte: boolean; pts: Vec3[] }> = []
  let cur = { ...inicio }
  const niv: number[] = []
  for (let xc = inicio.x + s * 2 * prof; s * (xc - x0) < -tol; xc += s * 2 * prof) niv.push(xc)
  niv.push(x0)
  for (const xc of niv) {
    const zE = hastaDonde(xc)
    if (Math.abs(zE - zS) < 1e-6) continue
    const a = { ...inicio, x: xc, z: zS }
    const b = { ...inicio, x: xc, z: zE }
    const sale = { ...inicio, x: xc - s * 2 * retiro, z: zE - dz * retiro }
    movs.push({ corte: false, pts: [cur, a] })
    movs.push({ corte: true, pts: [a, b] })
    movs.push({ corte: true, pts: [b, sale] })
    cur = { ...sale, z: zS }
    movs.push({ corte: false, pts: [sale, cur] })
  }
  // Pasada siguiendo el contorno (deja el sobremetal parejo).
  const p0 = { ...c[0] }
  movs.push({ corte: false, pts: [cur, { ...p0, z: zS }, p0].filter((p, i, arr) => i === 0 || dist(p, arr[i - 1]) > 1e-9) })
  movs.push({ corte: true, pts: c.map((p) => ({ ...p })) })
  const ult = c[c.length - 1]
  movs.push({ corte: false, pts: [{ ...ult }, { ...ult, x: inicio.x }, { ...inicio }] })
  return { movs: movs.filter((m) => m.pts.length > 1), rebajes }
}

/**
 * Compensación de radio G41/G42 en la fresadora: corre la trayectoria del
 * centro de la herramienta un radio hacia el lado pedido. En las esquinas
 * interiores se corta en la intersección de las paralelas; en las exteriores
 * la herramienta rodea la esquina con un arco.
 */
function compensar(pasos: Paso[], avisar: (linea: number, texto: string) => void) {
  let i = 0
  while (i < pasos.length) {
    const c = pasos[i].comp
    if (!c || c.fase !== 'arranque') {
      i++
      continue
    }
    let j = i + 1
    let cierra = false
    while (j < pasos.length) {
      const cj = pasos[j].comp
      if (!cj || cj.fase === 'arranque') break
      j++
      if (cj.fase === 'salida') {
        cierra = true
        break
      }
    }
    desfasarTramo(pasos.slice(i, j), c.lado, c.r, cierra, avisar)
    i = j
  }
}

function desfasarTramo(run: Paso[], lado: 41 | 42, r: number, cierra: boolean, avisar: (linea: number, texto: string) => void) {
  if (r <= 0) return
  type Oc = { k: number; idx: number }
  const verts: Array<{ x: number; y: number; occ: Oc[] }> = []
  run.forEach((p, k) =>
    p.puntos.forEach((q, idx) => {
      const u = verts[verts.length - 1]
      if (u && Math.hypot(u.x - q.x, u.y - q.y) < 1e-7) u.occ.push({ k, idx })
      else verts.push({ x: q.x, y: q.y, occ: [{ k, idx }] })
    }),
  )
  const m = verts.length
  if (m < 2) return
  const signo = lado === 41 ? 1 : -1
  const dir = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const l = Math.hypot(b.x - a.x, b.y - a.y)
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }
  }
  const normal = (d: { x: number; y: number }) => ({ x: -d.y * signo, y: d.x * signo })
  const listas: Array<Array<{ x: number; y: number }>> = []
  for (let v = 0; v < m; v++) {
    const P = verts[v]
    const mas = (n: { x: number; y: number }, k = r) => ({ x: P.x + n.x * k, y: P.y + n.y * k })
    if (v === 0) {
      listas.push([{ x: P.x, y: P.y }])
      continue
    }
    const n1 = normal(dir(verts[v - 1], P))
    if (v === m - 1) {
      listas.push([cierra ? { x: P.x, y: P.y } : mas(n1)])
      continue
    }
    const d1 = dir(verts[v - 1], P)
    const d2 = dir(P, verts[v + 1])
    const n2 = normal(d2)
    if (v === 1) {
      listas.push([mas(n2)])
      continue
    }
    if (cierra && v === m - 2) {
      listas.push([mas(n1)])
      continue
    }
    const cruz = d1.x * d2.y - d1.y * d2.x
    const punto = d1.x * d2.x + d1.y * d2.y
    if (Math.abs(cruz) < 1e-9 && punto > 0) listas.push([mas(n1)])
    else if (cruz * signo > 0) {
      // Esquina interior: intersección de las dos paralelas.
      const den = Math.max(0.05, 1 + n1.x * n2.x + n1.y * n2.y)
      listas.push([mas({ x: n1.x + n2.x, y: n1.y + n2.y }, r / den)])
    } else {
      // Esquina exterior: la herramienta la rodea con un arco.
      const a1 = Math.atan2(n1.y, n1.x)
      let da = Math.atan2(n2.y, n2.x) - a1
      while (da > Math.PI) da -= 2 * Math.PI
      while (da <= -Math.PI) da += 2 * Math.PI
      const pasosArco = Math.max(1, Math.ceil(Math.abs(da) / (Math.PI / 18)))
      const l: Array<{ x: number; y: number }> = []
      for (let s = 0; s <= pasosArco; s++) {
        const ang = a1 + (da * s) / pasosArco
        l.push(mas({ x: Math.cos(ang), y: Math.sin(ang) }))
      }
      listas.push(l)
    }
  }
  // ¿La herramienta cabe? Si un tramo desfasado queda al revés, se comería la pieza.
  for (let v = 0; v < m - 1; v++) {
    const a = listas[v][listas[v].length - 1]
    const b = listas[v + 1][0]
    const d = { x: verts[v + 1].x - verts[v].x, y: verts[v + 1].y - verts[v].y }
    if ((b.x - a.x) * d.x + (b.y - a.y) * d.y < -1e-6) {
      const oc = verts[v + 1].occ[0]
      avisar(run[oc.k].linea, `La herramienta (radio ${r} mm) no cabe en este rincón: con la compensación se devuelve y se comería la pieza. Usa una herramienta más chica.`)
      break
    }
  }
  const nuevos: Vec3[][] = run.map(() => [])
  verts.forEach((vt, v) => {
    const l = listas[v]
    vt.occ.forEach((o, q) => {
      const z = run[o.k].puntos[o.idx].z
      const usar = q === vt.occ.length - 1 ? l : [l[0]]
      for (const p of usar) nuevos[o.k].push({ x: p.x, y: p.y, z })
    })
  })
  run.forEach((p, k) => {
    p.puntos = nuevos[k]
    if (p.tipo === 'corte' || p.tipo === 'rapido') {
      let largo = 0
      for (let s = 1; s < p.puntos.length; s++) largo += dist(p.puntos[s - 1], p.puntos[s])
      p.largo = largo
      if (p.avance > 0) p.duracion = (largo / p.avance) * 60
    }
  })
}

function orden(n: Nivel) {
  return n === 'error' ? 0 : n === 'aviso' ? 1 : 2
}

function clonarEstado(e: EstadoModal): EstadoModal {
  return { ...e, pos: { ...e.pos }, origen: { ...e.origen }, ciclo: e.ciclo ? { ...e.ciclo } : null, g76: e.g76 ? { ...e.g76 } : null, g71: e.g71 ? { ...e.g71 } : null }
}

export function resta(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/**
 * Divide un arco en segmentos. Devuelve los puntos (incluido el de partida)
 * o un error explicado para el alumno.
 */
function puntosArco(
  desde: Vec3,
  hasta: Vec3,
  horario: boolean,
  val: Record<string, number>,
  esc: number,
  plano: 17 | 18 | 19,
  torno: boolean,
): { puntos: Vec3[] } | { error: string } {
  // (a, b) son las coordenadas del plano y c el eje perpendicular. En el
  // torno b es el radio (X/2).
  type Ejes = { a: keyof Vec3; b: keyof Vec3; c: keyof Vec3; ia: string; ib: string }
  const ej: Ejes =
    plano === 17
      ? { a: 'x', b: 'y', c: 'z', ia: 'I', ib: 'J' }
      : plano === 18
        ? { a: 'z', b: 'x', c: 'y', ia: 'K', ib: 'I' }
        : { a: 'y', b: 'z', c: 'x', ia: 'J', ib: 'K' }
  const fb = torno ? 0.5 : 1 // el diámetro pasa a radio
  const p = { a: desde[ej.a], b: desde[ej.b] * fb }
  const q = { a: hasta[ej.a], b: hasta[ej.b] * fb }
  let cx: number
  let cy: number
  if ('R' in val) {
    const R = val.R * esc
    const dx = q.a - p.a
    const dy = q.b - p.b
    const d = Math.hypot(dx, dy)
    if (d < 1e-9) return { error: 'Con R no se puede hacer un círculo completo: usa I/J/K para el centro.' }
    if (d > 2 * Math.abs(R) + 1e-3) {
      return { error: `El radio R${val.R} es muy chico: los puntos están a ${(d / (torno ? 1 : 1)).toFixed(2)} mm y el diámetro del arco es ${(2 * Math.abs(R)).toFixed(2)} mm.` }
    }
    const h = Math.sqrt(Math.max(0, R * R - (d * d) / 4))
    const mx = (p.a + q.a) / 2
    const my = (p.b + q.b) / 2
    // Normal a la izquierda de la cuerda.
    const nx = -dy / d
    const ny = dx / d
    const izquierda = !horario !== R < 0
    cx = mx + (izquierda ? h : -h) * nx
    cy = my + (izquierda ? h : -h) * ny
  } else {
    if (!(ej.ia in val) && !(ej.ib in val)) {
      return { error: `El arco necesita su centro (${ej.ia} y ${ej.ib}, distancias desde el punto de partida) o su radio R.` }
    }
    cx = p.a + (val[ej.ia] ?? 0) * esc
    cy = p.b + (val[ej.ib] ?? 0) * esc
    const r1 = Math.hypot(p.a - cx, p.b - cy)
    const r2 = Math.hypot(q.a - cx, q.b - cy)
    if (Math.abs(r1 - r2) > Math.max(0.02, r1 * 0.002)) {
      return {
        error: `El arco no cierra: desde el centro, el punto de partida está a ${r1.toFixed(2)} mm y el de llegada a ${r2.toFixed(2)} mm. Revisa ${ej.ia}/${ej.ib} (son distancias desde el punto de partida al centro${torno ? ', I en radio' : ''}).`,
      }
    }
  }
  const r = Math.hypot(p.a - cx, p.b - cy)
  if (r < 1e-6) return { error: 'El arco tiene radio cero.' }
  const a1 = Math.atan2(p.b - cy, p.a - cx)
  const a2 = Math.atan2(q.b - cy, q.a - cx)
  let barrido = a2 - a1
  const cerrado = Math.hypot(q.a - p.a, q.b - p.b) < 1e-6
  if (horario) {
    while (barrido >= -1e-9) barrido -= 2 * Math.PI
    if (!cerrado && barrido < -2 * Math.PI + 1e-9) barrido += 2 * Math.PI
  } else {
    while (barrido <= 1e-9) barrido += 2 * Math.PI
    if (!cerrado && barrido > 2 * Math.PI - 1e-9) barrido -= 2 * Math.PI
  }
  const n = Math.min(720, Math.max(6, Math.ceil(Math.abs(barrido) * r * 2), Math.ceil(Math.abs(barrido) / (Math.PI / 90))))
  const pts: Vec3[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const ang = a1 + barrido * t
    const v = { ...desde }
    v[ej.a] = cx + r * Math.cos(ang)
    v[ej.b] = (cy + r * Math.sin(ang)) / fb
    v[ej.c] = desde[ej.c] + (hasta[ej.c] - desde[ej.c]) * t
    pts.push(v)
  }
  pts[pts.length - 1] = { ...hasta }
  return { puntos: pts }
}

// ---------------------------------------------------------------------------
// Explicar un bloque (para el alumno)
// ---------------------------------------------------------------------------
export function explicarBloque(texto: string, antes: EstadoModal | undefined, maquina: TipoMaquina): Array<{ palabra: string; texto: string }> {
  const a = analizarLinea(texto)
  const out: Array<{ palabra: string; texto: string }> = []
  if (a.directiva !== null) {
    out.push({ palabra: `$${a.directiva.split(/\s/)[0]}`, texto: 'Instrucción propia de CNC Simulator Pro (unidades, material, etc.).' })
  }
  const torno = maquina === 'torno'
  let absoluto = antes?.absoluto ?? true
  let porVuelta = antes?.avancePorVuelta ?? false
  let css = antes?.velocidadConstante ?? false
  let mov = antes?.movimiento ?? 0
  const u = antes?.pulgadas ? 'pulg' : 'mm'
  const letras = new Set(a.palabras.map((p) => p.letra))
  const hay = (l: string, v: number) => a.palabras.some((p) => p.letra === l && p.valor === v)
  const llamada = hay('M', 98)
  const cicloPerfil = torno && (hay('G', 71) || hay('G', 70)) && letras.has('P') && letras.has('Q')
  const g71Param = torno && hay('G', 71) && letras.has('U') && letras.has('R') && !letras.has('P')
  for (const p of a.palabras) {
    if (p.letra === 'G') {
      if (p.valor === 90) absoluto = true
      if (p.valor === 91) absoluto = false
      if (p.valor === 94) porVuelta = false
      if (p.valor === 95) porVuelta = true
      if (p.valor === 96) css = true
      if (p.valor === 97) css = false
      if ([0, 1, 2, 3, 33].includes(p.valor)) mov = p.valor
    }
  }
  for (const p of a.palabras) {
    const v = p.valor
    let t: string
    switch (p.letra) {
      case 'N':
        t = `Número de bloque (secuencia) ${v}.`
        break
      case 'O':
        t = `Número de programa ${v}. Si va después del M30, aquí empieza el subprograma O${v} (termina con M99).`
        break
      case 'G':
        t =
          (v === 71 && (cicloPerfil || g71Param)) || (v === 70 && cicloPerfil)
            ? v === 71
              ? 'Ciclo de desbaste del torno: pasadas paralelas a Z hasta el perfil de los bloques P a Q, dejando el sobremetal U/W.'
              : 'Ciclo de acabado del torno: recorre una vez el perfil de los bloques P a Q y vuelve al punto de partida.'
            : CODIGOS_G[codigo('G', v)] ?? 'Función preparatoria que este simulador no usa.'
        break
      case 'M':
        t = CODIGOS_M[codigo('M', v)] ?? 'Función auxiliar que este simulador no usa.'
        break
      case 'X':
        t = torno
          ? absoluto
            ? `Diámetro ${v} ${u} (en el torno X es el diámetro).`
            : `Cambia el diámetro en ${v > 0 ? '+' : ''}${v} ${u} desde el actual.`
          : absoluto
            ? `Posición del eje X: ${v} ${u} desde el cero pieza.`
            : `Avanza ${v > 0 ? '+' : ''}${v} ${u} en X desde donde está.`
        break
      case 'Y':
        t = absoluto ? `Posición del eje Y: ${v} ${u} desde el cero pieza.` : `Avanza ${v > 0 ? '+' : ''}${v} ${u} en Y desde donde está.`
        break
      case 'Z':
        t = absoluto
          ? `Posición del eje Z: ${v} ${u}${torno ? ' (negativo = hacia el plato)' : v < 0 ? ' (bajo la cara superior: corta)' : ''}.`
          : `Avanza ${v > 0 ? '+' : ''}${v} ${u} en Z desde donde está.`
        break
      case 'U':
        t = g71Param
          ? `Profundidad de cada pasada de desbaste: ${v} ${u} (en radio).`
          : cicloPerfil
            ? `Sobremetal que se deja para el acabado en X: ${v} ${u} (en diámetro).`
            : torno
              ? `Incremental en X: cambia el diámetro en ${v} ${u}.`
              : `Incremental en X: ${v} ${u}.`
        break
      case 'V':
        t = `Incremental en Y: ${v} ${u}.`
        break
      case 'W':
        t = cicloPerfil ? `Sobremetal que se deja para el acabado en Z: ${v} ${u}.` : `Incremental en Z: ${v} ${u}.`
        break
      case 'I':
        t = `Centro del arco: ${v} ${u} en X desde el punto de partida${torno ? ' (en radio)' : ''}.`
        break
      case 'J':
        t = `Centro del arco: ${v} ${u} en Y desde el punto de partida.`
        break
      case 'K':
        t = `Centro del arco: ${v} ${u} en Z desde el punto de partida.`
        break
      case 'R':
        t = g71Param
          ? `Retiro después de cada pasada: ${v} ${u}.`
          : mov === 2 || mov === 3 ? `Radio del arco: ${Math.abs(v)} ${u}${v < 0 ? ' (negativo: el arco largo, más de media vuelta)' : ''}.` : `Plano de aproximación R = ${v} ${u} del ciclo.`
        break
      case 'F':
        t = mov === 33 ? `Paso de la rosca: ${v} ${u} por vuelta.` : porVuelta ? `Avance de ${v} ${u} por vuelta del husillo.` : `Velocidad de avance: ${v} ${u}/min.`
        break
      case 'S':
        t = css ? `Velocidad de corte constante de ${v} m/min.` : `Velocidad del husillo: ${v} rpm.`
        break
      case 'T': {
        const tt = Math.round(v)
        const num = torno && tt >= 100 ? Math.floor(tt / 100) : tt
        t = torno && tt >= 100 ? `Herramienta ${num} con su corrector ${tt % 100}.` : `Selecciona la herramienta ${num}.`
        break
      }
      case 'P':
        t = llamada
          ? `Número del subprograma que se llama: O${v > 9999 && !letras.has('L') ? v % 10000 : v}${v > 9999 && !letras.has('L') ? `, ${Math.floor(v / 10000)} veces` : ''}.`
          : cicloPerfil
            ? `Primer bloque del perfil: N${v}.`
            : `Parámetro P = ${v} (en G04, tiempo de espera en milisegundos).`
        break
      case 'Q':
        t = cicloPerfil ? `Último bloque del perfil: N${v}.` : `Profundidad de cada picada: ${v} ${u}.`
        break
      case 'L':
        t = `Cuántas veces se repite el subprograma: ${v}.`
        break
      case 'D':
        t = cicloPerfil ? `Profundidad de cada pasada: ${v} ${u}.` : `Corrector de radio ${v}: la compensación usa el radio de la herramienta ${v}.`
        break
      case 'H':
        t = `Número de corrector de largo ${v}.`
        break
      default:
        t = 'Esta letra no se usa en esta máquina.'
    }
    out.push({ palabra: p.texto, texto: t })
  }
  if (a.resto) out.push({ palabra: a.resto, texto: 'No se entiende: revisa que sea letra + número.' })
  if (a.comentario) out.push({ palabra: '( )', texto: `Comentario: ${a.comentario}` })
  return out
}
