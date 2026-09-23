/**
 * Simulador de mecanizado: recorre los pasos del programa como lo haría la
 * máquina y va arrancando material del bruto.
 *
 *  - Torno: la pieza es de revolución, así que basta guardar, cada 0,1 mm de
 *    Z, el radio exterior y el radio del agujero. Cada herramienta arranca
 *    según su envolvente (ver maquinas.ts).
 *  - Fresadora: un mapa de alturas de la cara superior; la fresa baja la
 *    altura de las celdas que toca.
 *
 * Como en la máquina real, se detiene con una ALARMA si la herramienta entra
 * al material en rápido (G00), si corta con el husillo detenido o si choca
 * con el plato, las garras o la mesa. Los consejos (pasadas muy profundas,
 * etc.) se anotan sin detener nada.
 */
import type { Paso, ResultadoGcode, Vec3 } from './gcode'
import {
  envolventeTorno,
  herramientaFresa,
  herramientaTorno,
  perfilFresa,
  rangoTorno,
  type BrutoFresa,
  type BrutoTorno,
  type ConfigCNC,
} from './maquinas'

export const RES_TORNO = 0.1
/** Cuánto sobresalen las garras del plato por sobre el bruto (mm). */
export const ALTO_GARRA = 10

export class PiezaTorno {
  readonly tipo = 'torno'
  /** Z del extremo izquierdo del bruto (dentro del plato) y de la cara. */
  readonly z0: number
  readonly z1: number
  readonly ext: Float32Array
  readonly int: Float32Array
  /** Parte que se cortó con el tronzado (cae a la bandeja). */
  tronzada: { z: number; ext: Float32Array; int: Float32Array; z0: number } | null = null
  version = 0
  constructor(readonly bruto: BrutoTorno) {
    this.z1 = bruto.sobremetal
    this.z0 = bruto.sobremetal - bruto.largo
    const n = Math.round(bruto.largo / RES_TORNO) + 1
    this.ext = new Float32Array(n).fill(bruto.diametro / 2)
    this.int = new Float32Array(n)
  }
  get n() {
    return this.ext.length
  }
  zDe(i: number) {
    return this.z0 + i * RES_TORNO
  }
  indice(z: number) {
    return Math.round((z - this.z0) / RES_TORNO)
  }
  /** Z donde terminan las garras (hacia la cara). */
  get zGarras() {
    return this.z0 + this.bruto.agarre
  }
}

export class PiezaFresa {
  readonly tipo = 'fresa'
  readonly nx: number
  readonly ny: number
  readonly celda: number
  /** Altura de cada celda (Z, con la cara superior en 0 y el fondo en −alto). */
  readonly h: Float32Array
  version = 0
  constructor(readonly bruto: BrutoFresa) {
    this.celda = Math.max(0.25, Math.max(bruto.largo, bruto.ancho) / 240)
    this.nx = Math.max(2, Math.round(bruto.largo / this.celda) + 1)
    this.ny = Math.max(2, Math.round(bruto.ancho / this.celda) + 1)
    this.h = new Float32Array(this.nx * this.ny)
  }
}

export interface Alarma {
  linea: number
  texto: string
}

export interface Consejo {
  linea: number
  texto: string
}

export class SimuladorCNC {
  readonly pieza: PiezaTorno | PiezaFresa
  pos: Vec3
  /** Paso en curso y tiempo ya recorrido dentro de él. */
  indice = 0
  t = 0
  tiempo = 0
  alarma: Alarma | null = null
  /** Detenido por M00/M01: espera «Continuar». */
  parado = false
  consejos: Consejo[] = []
  /** Material arrancado en el último avance (para viruta y sonido). */
  cortando = 0
  private consejosDados = new Set<string>()
  private cosAxial = 1
  private lineaBloque: number | null = null

  constructor(
    readonly programa: ResultadoGcode,
    readonly config: ConfigCNC,
    readonly casa: Vec3,
  ) {
    this.pieza = config.maquina === 'torno' ? new PiezaTorno(config.torno) : new PiezaFresa(config.fresa)
    this.pos = { ...casa }
  }

  get terminado(): boolean {
    return this.indice >= this.programa.pasos.length
  }

  get pasoActual(): Paso | undefined {
    return this.programa.pasos[Math.min(this.indice, this.programa.pasos.length - 1)]
  }

  get linea(): number | null {
    if (!this.programa.pasos.length) return null
    return this.pasoActual?.linea ?? null
  }

  get herramienta(): number {
    const p = this.programa.pasos[this.indice] ?? this.programa.pasos[this.programa.pasos.length - 1]
    return p?.herramienta ?? 1
  }

  get husilloGira(): boolean {
    const p = this.programa.pasos[this.indice]
    return !!p && p.husillo !== 'off' && p.rpm > 0
  }

  continuar() {
    this.parado = false
  }

  /**
   * Avanza la simulación dt segundos de máquina. Si `hastaLinea` es true se
   * detiene al terminar el bloque en curso (modo bloque a bloque).
   */
  avanzar(dt: number, bloqueABloque = false): 'sigue' | 'fin-bloque' | 'parada' | 'alarma' | 'fin' {
    this.cortando = 0
    if (this.alarma) return 'alarma'
    const pasos = this.programa.pasos
    let resto = dt
    // En bloque a bloque se recuerda en qué línea empezó, aunque el bloque
    // dure varios fotogramas.
    if (!bloqueABloque) this.lineaBloque = null
    else if (this.lineaBloque === null) this.lineaBloque = this.linea
    const lineaInicio = this.lineaBloque
    while (resto > 0 && this.indice < pasos.length) {
      if (this.parado) return 'parada'
      const p = pasos[this.indice]
      if (bloqueABloque && p.linea !== lineaInicio && this.t === 0) {
        this.lineaBloque = null
        return 'fin-bloque'
      }
      const falta = p.duracion - this.t
      const usar = Math.min(resto, falta)
      const desde = this.t
      this.t += usar
      resto -= usar
      this.tiempo += usar
      if (p.puntos.length > 1 && p.duracion > 0) {
        const ok = this.recorrer(p, desde / p.duracion, this.t / p.duracion)
        if (!ok) return 'alarma'
      } else if (p.puntos.length) {
        this.pos = { ...p.puntos[p.puntos.length - 1] }
      }
      if (this.t >= p.duracion - 1e-9) {
        this.indice++
        this.t = 0
        if (p.parada) {
          this.parado = true
          return 'parada'
        }
      }
    }
    if (this.indice >= pasos.length) return 'fin'
    return 'sigue'
  }

  /** Corre lo que queda del programa de una vez. */
  terminar(): void {
    let guarda = 0
    while (!this.terminado && !this.alarma && guarda++ < 100000) {
      if (this.parado) this.parado = false
      this.avanzar(3600)
    }
    // Lo cortado de una vez no debe salir como viruta en la posición final.
    this.cortando = 0
  }

  /** Recorre el paso p entre las fracciones f0 y f1 de su largo. */
  private recorrer(p: Paso, f0: number, f1: number): boolean {
    const objetivo0 = f0 * p.largo
    const objetivo1 = Math.min(p.largo, f1 * p.largo)
    let acumulado = 0
    const paso = this.pieza.tipo === 'torno' ? RES_TORNO / 2 : (this.pieza as PiezaFresa).celda / 2
    for (let i = 1; i < p.puntos.length; i++) {
      const a = p.puntos[i - 1]
      const b = p.puntos[i]
      const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
      const s0 = Math.max(0, objetivo0 - acumulado)
      const s1 = Math.min(l, objetivo1 - acumulado)
      if (s1 > s0 - 1e-12 && l > 0) {
        // Espesor de la pasada medido perpendicular al avance (en el torno el
        // radio es X/2): lo que realmente come el filo.
        const dr = (b.x - a.x) / 2
        const dzs = b.z - a.z
        this.cosAxial = Math.abs(dzs) / Math.max(1e-9, Math.hypot(dr, dzs))
        const n = Math.max(1, Math.ceil((s1 - s0) / paso))
        for (let k = 1; k <= n; k++) {
          const s = s0 + ((s1 - s0) * k) / n
          const q = { x: a.x + ((b.x - a.x) * s) / l, y: a.y + ((b.y - a.y) * s) / l, z: a.z + ((b.z - a.z) * s) / l }
          if (!this.cortarEn(q, p)) return false
          this.pos = q
        }
      }
      acumulado += l
      if (acumulado >= objetivo1) break
    }
    return true
  }

  private consejo(linea: number, clave: string, texto: string) {
    if (this.consejosDados.has(clave)) return
    this.consejosDados.add(clave)
    this.consejos.push({ linea, texto })
  }

  private detener(p: Paso, texto: string): false {
    this.alarma = { linea: p.linea, texto }
    return false
  }

  /** Aplica la herramienta en q. Devuelve false si hay alarma. */
  private cortarEn(q: Vec3, p: Paso): boolean {
    return this.pieza.tipo === 'torno' ? this.cortarTorno(this.pieza, q, p) : this.cortarFresa(this.pieza, q, p)
  }

  private cortarTorno(pz: PiezaTorno, q: Vec3, p: Paso): boolean {
    const h = herramientaTorno(p.herramienta)
    if (!h) return this.detener(p, `La herramienta T${p.herramienta} no está en la torreta.`)
    const rTip = q.x / 2
    const R = pz.bruto.diametro / 2
    // Choque con las garras (tapan el bruto por fuera en los primeros
    // `agarre` mm) y con el cuerpo del plato.
    const [dz0, dz1] = rangoTorno(h)
    const zA = q.z + dz0
    const zB = q.z + dz1
    if (h.forma !== 'broca') {
      if (zA < pz.zGarras - 0.05 && zB > pz.z0 && rTip < R + ALTO_GARRA) {
        return this.detener(p, `Choque: la herramienta T${h.t} toca las garras del plato en Z${q.z.toFixed(1)}. Las garras toman ${pz.bruto.agarre} mm del material, hasta Z${pz.zGarras.toFixed(1)}.`)
      }
      if (zA < pz.z0 && rTip < R + 45) return this.detener(p, `Choque: la herramienta T${h.t} golpea el plato.`)
    } else if (q.z < pz.z0 + 0.5 && Math.abs(rTip) < R + 45) {
      return this.detener(p, 'Choque: la broca llega al plato.')
    }
    let arrancado = 0
    let profundidad = 0
    if (h.forma === 'broca') {
      if (Math.abs(q.x) > 0.2) {
        const i = pz.indice(q.z)
        if (i >= 0 && i < pz.n && pz.ext[i] > 0 && rTip < pz.ext[i]) {
          return this.detener(p, 'La broca del torno sólo trabaja en el centro (X0): fuera del eje rompe la broca.')
        }
        return true
      }
      const rb = (h.medida ?? 8) / 2
      const punta = rb * Math.tan((31 * Math.PI) / 180)
      const i0 = Math.max(0, pz.indice(q.z))
      for (let i = i0; i < pz.n; i++) {
        const dz = pz.zDe(i) - q.z
        const r = dz >= punta ? rb : (dz / punta) * rb
        if (r > pz.int[i] && pz.ext[i] > pz.int[i]) {
          arrancado += Math.min(r, pz.ext[i]) - pz.int[i]
          pz.int[i] = Math.min(r, pz.ext[i])
          if (pz.int[i] >= pz.ext[i] - 1e-4) pz.int[i] = pz.ext[i]
        }
      }
    } else {
      const i0 = Math.max(0, pz.indice(q.z + dz0))
      const i1 = Math.min(pz.n - 1, pz.indice(q.z + dz1))
      for (let i = i0; i <= i1; i++) {
        const e = envolventeTorno(h, pz.zDe(i) - q.z)
        if (e === null) continue
        const r = Math.max(0, rTip + e)
        if (r < pz.ext[i] - 1e-4) {
          const quita = pz.ext[i] - Math.max(r, pz.int[i])
          if (quita > 0) {
            arrancado += quita
            profundidad = Math.max(profundidad, quita * this.cosAxial)
          }
          pz.ext[i] = Math.max(r, 0)
          if (pz.ext[i] <= pz.int[i]) pz.ext[i] = pz.int[i]
        }
      }
    }
    if (arrancado > 0) {
      if (p.tipo === 'rapido') {
        return this.detener(p, 'Choque: la herramienta entra al material en avance rápido (G00). Para cortar usa G01, G02 o G03.')
      }
      if (p.husillo === 'off' || p.rpm <= 0) {
        return this.detener(p, 'La herramienta corta con el husillo detenido: enciéndelo antes con M03 (o M04) y una velocidad S.')
      }
      pz.version++
      this.cortando += arrancado
      if (profundidad > 2.5 + 0.05 && h.forma !== 'ranurado' && h.forma !== 'broca') {
        this.consejo(p.linea, `prof-${p.linea}`, `Pasada de ${(profundidad * 2).toFixed(1)} mm en diámetro: no conviene quitar más de 5 mm por pasada.`)
      }
      this.revisarTronzado(pz)
    }
    return true
  }

  /** Si el radio exterior llega al agujero en algún punto, la pieza se separa. */
  private revisarTronzado(pz: PiezaTorno) {
    if (pz.tronzada) return
    const iG = pz.indice(pz.zGarras)
    for (let i = pz.n - 2; i > iG; i--) {
      if (pz.ext[i] - pz.int[i] > 1e-3 || pz.ext[i + 1] - pz.int[i + 1] <= 1e-3) continue
      // Lo que queda hacia la cara (i+1 … n−1) se separa, salvo que sea
      // sólo la viruta fina que deja el refrentado.
      let volumen = 0
      for (let k = i + 1; k < pz.n; k++) volumen += Math.PI * (pz.ext[k] ** 2 - pz.int[k] ** 2) * RES_TORNO
      if (volumen < 5) {
        for (let k = i + 1; k < pz.n; k++) pz.ext[k] = pz.int[k] = 0
        continue
      }
      pz.tronzada = { z: pz.zDe(i), ext: pz.ext.slice(i + 1), int: pz.int.slice(i + 1), z0: pz.zDe(i + 1) }
      for (let k = i + 1; k < pz.n; k++) pz.ext[k] = pz.int[k] = 0
      return
    }
  }

  private cortarFresa(pz: PiezaFresa, q: Vec3, p: Paso): boolean {
    const h = herramientaFresa(p.herramienta)
    if (!h) return this.detener(p, `La herramienta T${p.herramienta} no está en el almacén.`)
    const b = pz.bruto
    if (q.z < -b.alto - 0.01 && q.x > -h.diametro / 2 && q.x < b.largo + h.diametro / 2 && q.y > -h.diametro / 2 && q.y < b.ancho + h.diametro / 2) {
      return this.detener(p, `Choque: la herramienta baja a Z${q.z.toFixed(1)} y corta la mesa (el bruto mide ${b.alto} mm de alto).`)
    }
    const r = h.diametro / 2
    const c = pz.celda
    const i0 = Math.max(0, Math.floor((q.x - r) / c))
    const i1 = Math.min(pz.nx - 1, Math.ceil((q.x + r) / c))
    const j0 = Math.max(0, Math.floor((q.y - r) / c))
    const j1 = Math.min(pz.ny - 1, Math.ceil((q.y + r) / c))
    let arrancado = 0
    let profundidad = 0
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(i * c - q.x, j * c - q.y)
        const extra = perfilFresa(h, d)
        if (extra === null) continue
        const z = Math.max(-b.alto, q.z + extra)
        const k = j * pz.nx + i
        if (z < pz.h[k] - 1e-4) {
          const quita = pz.h[k] - z
          arrancado += quita
          profundidad = Math.max(profundidad, quita)
          pz.h[k] = z
        }
      }
    }
    if (arrancado > 0) {
      if (p.tipo === 'rapido') {
        return this.detener(p, 'Choque: la herramienta entra al material en avance rápido (G00). Baja con G01 para cortar.')
      }
      if (p.husillo === 'off' || p.rpm <= 0) {
        return this.detener(p, 'La fresa corta con el husillo detenido: enciéndelo antes con M03 y una velocidad S.')
      }
      pz.version++
      this.cortando += arrancado * c * c
      if (h.forma !== 'broca' && profundidad > h.diametro + 0.05) {
        this.consejo(p.linea, `prof-${p.linea}`, `Pasada de ${profundidad.toFixed(1)} mm de profundidad con una fresa de Ø${h.diametro}: conviene bajar por etapas (no más que el diámetro).`)
      }
      if (h.forma === 'broca' && (Math.abs(q.x - p.puntos[0].x) > 0.01 || Math.abs(q.y - p.puntos[0].y) > 0.01)) {
        return this.detener(p, 'La broca sólo puede avanzar en Z: al moverse de lado dentro del material se rompe.')
      }
    }
    return true
  }
}

/** Resumen del volumen arrancado (mm³), para mostrar al alumno. */
export function volumenPieza(pz: PiezaTorno | PiezaFresa): number {
  if (pz.tipo === 'torno') {
    let v = 0
    for (let i = 0; i < pz.n; i++) v += Math.PI * (pz.ext[i] ** 2 - pz.int[i] ** 2) * RES_TORNO
    return v
  }
  let v = 0
  for (let k = 0; k < pz.h.length; k++) v += (pz.bruto.alto + pz.h[k]) * pz.celda * pz.celda
  return v
}
