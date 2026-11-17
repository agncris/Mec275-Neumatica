/**
 * Desbaste visual de la plancha del robot, con el mismo lenguaje que la
 * fresadora CNC: un mapa de alturas (cara, canto y fondo) que baja por donde
 * pasó la fresa, y viruta metálica junto a la punta.
 *
 * La malla se arma una vez. Al reproducir sólo se mueven los vértices de los
 * tramos que el cabezal ya recorrió; no se reconstruye la geometría.
 */
import * as THREE from 'three'
import type { Muestra } from './movimiento'
import type { V3 } from './matematica'

const CELDA_MM = 1.25
const MAX_CELDAS = 220
const UMBRAL_MM = 0.15

const CRUDO = new THREE.Color(0xc9d1d9)
const CORTADO = new THREE.Color(0x39434d)
const FONDO = new THREE.Color(0x12161a)
const CALOR = new THREE.Color(0xff9a3c)
/** Cuántos tramos atrás se nota el corte como recién hecho. */
const TRAMOS_CALIENTES = 5

export interface PlacaMm {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Distancia de un punto al segmento ab y el parámetro 0..1 del más cercano. */
function distSegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): { d: number; t: number } {
  const abx = bx - ax
  const aby = by - ay
  const den = abx * abx + aby * aby
  const t = den < 1e-8 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / den))
  const dx = px - (ax + abx * t)
  const dy = py - (ay + aby * t)
  return { d: Math.hypot(dx, dy), t }
}

function grillaDe(w: number, h: number): { nx: number; ny: number } {
  const lado = Math.max(w, h, CELDA_MM)
  const celda = Math.max(CELDA_MM, lado / MAX_CELDAS)
  return {
    nx: Math.max(2, Math.round(w / celda) + 1),
    ny: Math.max(2, Math.round(h / celda) + 1),
  }
}

/**
 * Stock sólido de la plancha. El origen local está en el cero de la base y
 * Z local mira hacia arriba: la cara superior queda en `zCara`.
 */
export class StockPlancha {
  readonly malla: THREE.Mesh
  private readonly geo: THREE.BufferGeometry
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly prof: Float32Array
  private readonly cuando: Float32Array
  private readonly borde: number[]
  private readonly nTop: number
  private readonly nx: number
  private readonly ny: number
  private readonly espesor: number
  private tocadas: Int32Array = new Int32Array(0)
  private indice = -1
  private normalPendiente = false
  private tNormal = 0
  private readonly tinte = new THREE.Color()

  constructor(placa: PlacaMm, espesor: number, zCara: number) {
    const w = Math.max(1, placa.x1 - placa.x0)
    const h = Math.max(1, placa.y1 - placa.y0)
    const { nx, ny } = grillaDe(w, h)
    this.nx = nx
    this.ny = ny
    this.espesor = Math.max(0.4, espesor)
    this.nTop = nx * ny
    const borde: number[] = []
    for (let i = 0; i < nx; i++) borde.push(i)
    for (let j = 1; j < ny; j++) borde.push(j * nx + nx - 1)
    for (let i = nx - 2; i >= 0; i--) borde.push((ny - 1) * nx + i)
    for (let j = ny - 2; j > 0; j--) borde.push(j * nx)
    this.borde = borde
    const nB = borde.length
    const total = this.nTop + nB * 2 + 4
    const pos = new Float32Array(total * 3)
    const col = new Float32Array(total * 3)
    this.pos = pos
    this.col = col
    this.prof = new Float32Array(this.nTop)
    this.cuando = new Float32Array(this.nTop)
    this.cuando.fill(1e9)
    const xy = (k: number): [number, number] => [placa.x0 + (k % nx) * (w / (nx - 1)), placa.y0 + Math.floor(k / nx) * (h / (ny - 1))]
    for (let k = 0; k < this.nTop; k++) {
      const [x, y] = xy(k)
      pos.set([x, y, 0], k * 3)
    }
    for (let b = 0; b < nB; b++) {
      const [x, y] = xy(borde[b])
      pos.set([x, y, 0], (this.nTop + b) * 3)
      pos.set([x, y, -this.espesor], (this.nTop + nB + b) * 3)
    }
    const x1 = placa.x1
    const y1 = placa.y1
    const f0 = this.nTop + nB * 2
    // Un pelo bajo la cara inferior para que el fondo no parpadee contra el surco.
    const zF = -this.espesor - 0.35
    pos.set([placa.x0, placa.y0, zF, x1, placa.y0, zF, x1, y1, zF, placa.x0, y1, zF], f0 * 3)
    const idx: number[] = []
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i
        idx.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx)
      }
    }
    for (let b = 0; b < nB; b++) {
      const b2 = (b + 1) % nB
      const t1 = this.nTop + b
      const t2 = this.nTop + b2
      const d1 = this.nTop + nB + b
      const d2 = this.nTop + nB + b2
      idx.push(t1, d1, t2, t2, d1, d2)
    }
    idx.push(f0, f0 + 1, f0 + 2, f0, f0 + 2, f0 + 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
    this.geo = geo
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.78,
      roughness: 0.34,
      envMapIntensity: 1.35,
      vertexColors: true,
      side: THREE.DoubleSide,
    })
    this.malla = new THREE.Mesh(geo, mat)
    this.malla.castShadow = true
    this.malla.receiveShadow = true
    this.malla.position.z = zCara
    this.pintarTodo(0)
  }

  /** Marca el surco de los tramos LIN/CIR. No toca la malla hasta `aplicar`. */
  cargar(muestras: Muestra[], radio: number, zCara: number, aLocal: (p: V3) => { x: number; y: number; z: number }, habilitar: boolean) {
    this.prof.fill(0)
    this.cuando.fill(1e9)
    if (habilitar && muestras.length > 1 && radio > 0) {
      const { nx, ny } = this
      const N = nx
      const w = this.pos[(nx - 1) * 3] - this.pos[0]
      const h = this.pos[((ny - 1) * nx) * 3 + 1] - this.pos[1]
      const x0 = this.pos[0]
      const y0 = this.pos[1]
      const loc = muestras.map((m) => aLocal(m.tcp))
      const profDe = (z: number) => Math.max(0, Math.min(this.espesor, zCara - z))
      const pintar = (ax: number, ay: number, bx: number, by: number, pa: number, pb: number, ia: number, ib: number) => {
        const minx = Math.min(ax, bx) - radio
        const maxx = Math.max(ax, bx) + radio
        const miny = Math.min(ay, by) - radio
        const maxy = Math.max(ay, by) + radio
        const ix0 = Math.max(0, Math.floor(((minx - x0) / w) * (nx - 1)) - 1)
        const ix1 = Math.min(nx - 1, Math.ceil(((maxx - x0) / w) * (nx - 1)) + 1)
        const iy0 = Math.max(0, Math.floor(((miny - y0) / h) * (ny - 1)) - 1)
        const iy1 = Math.min(ny - 1, Math.ceil(((maxy - y0) / h) * (ny - 1)) + 1)
        for (let iy = iy0; iy <= iy1; iy++) {
          const ly = y0 + (iy / (ny - 1)) * h
          for (let ix = ix0; ix <= ix1; ix++) {
            const lx = x0 + (ix / (nx - 1)) * w
            const { d, t } = distSegmento(lx, ly, ax, ay, bx, by)
            if (d > radio) continue
            const k = iy * N + ix
            const p = pa + (pb - pa) * t
            if (p > this.prof[k]) this.prof[k] = p
            const id = ia + (ib - ia) * t
            if (id < this.cuando[k]) this.cuando[k] = id
          }
        }
      }
      for (let i = 1; i < muestras.length; i++) {
        if (!muestras[i].corta) continue
        const a = loc[i - 1]
        const b = loc[i]
        let pa = profDe(a.z)
        let pb = profDe(b.z)
        if (pa < UMBRAL_MM && pb < UMBRAL_MM) continue
        let ax = a.x
        let ay = a.y
        let bx = b.x
        let by = b.y
        let ia = i - 1
        let ib = i
        if (pa < UMBRAL_MM) {
          const t = (UMBRAL_MM - pa) / (pb - pa)
          ax = a.x + (b.x - a.x) * t
          ay = a.y + (b.y - a.y) * t
          pa = UMBRAL_MM
          ia = i - 1 + t
        } else if (pb < UMBRAL_MM) {
          const t = (pa - UMBRAL_MM) / (pa - pb)
          bx = a.x + (b.x - a.x) * t
          by = a.y + (b.y - a.y) * t
          pb = UMBRAL_MM
          ib = i - 1 + t
        }
        pintar(ax, ay, bx, by, pa, pb, ia, ib)
      }
    }
    const lista: number[] = []
    for (let k = 0; k < this.nTop; k++) if (this.cuando[k] < 1e8) lista.push(k)
    this.tocadas = Int32Array.from(lista)
    this.indice = -1
    this.aplicar(0, 0, true)
  }

  /** Baja los vértices cuyo tramo ya pasó. `indice` puede ser fraccionario. */
  aplicar(indice: number, ahora: number, quieto: boolean) {
    if (indice === this.indice && !this.normalPendiente) return
    const primera = this.indice < 0
    const salto = Math.abs(indice - this.indice) > 1.5
    this.indice = indice
    const { pos, col, prof, cuando, nTop, borde } = this
    const nB = borde.length
    let cambio = false
    // Completo al empezar o al saltar; después sólo las celdas que el cabezal toca.
    const celdas = primera || salto ? null : this.tocadas
    const total = celdas ? celdas.length : nTop
    for (let n = 0; n < total; n++) {
      const k = celdas ? celdas[n] : n
      const baja = cuando[k] <= indice
      const h = baja ? -prof[k] : 0
      if (pos[k * 3 + 2] !== h) {
        pos[k * 3 + 2] = h
        cambio = true
      }
      const reciente = baja && indice - cuando[k] < TRAMOS_CALIENTES ? 1 - (indice - cuando[k]) / TRAMOS_CALIENTES : 0
      this.colorEn(col, k, baja ? prof[k] : 0, 1, quieto ? 0 : reciente)
    }
    for (let b = 0; b < nB; b++) {
      const z = pos[borde[b] * 3 + 2]
      const arriba = nTop + b
      if (pos[arriba * 3 + 2] !== z) {
        pos[arriba * 3 + 2] = z
        cambio = true
      }
      const p = z < -1e-4 ? prof[borde[b]] : 0
      this.colorEn(col, arriba, p, 0.92)
      this.colorEn(col, nTop + nB + b, 0, 0.9)
    }
    const f0 = nTop + nB * 2
    for (let q = 0; q < 4; q++) this.colorEn(col, f0 + q, this.espesor, 0.85)
    if (cambio || primera) {
      this.geo.attributes.position.needsUpdate = true
      this.geo.attributes.color.needsUpdate = true
      this.normalPendiente = true
    }
    if (this.normalPendiente && (quieto || salto || ahora - this.tNormal > 0.08)) {
      this.geo.computeVertexNormals()
      this.normalPendiente = false
      this.tNormal = ahora
    }
  }

  dispose() {
    this.geo.dispose()
    ;(this.malla.material as THREE.Material).dispose()
  }

  private pintarTodo(indice: number) {
    this.aplicar(indice, 0, true)
  }

  private colorEn(col: Float32Array, k: number, profundidad: number, escala = 1, calor = 0) {
    const t = Math.max(0, Math.min(1, profundidad / this.espesor))
    const c = profundidad >= this.espesor - 0.35 ? this.tinte.copy(FONDO) : this.tinte.copy(CRUDO).lerp(CORTADO, Math.pow(t, 0.55))
    if (calor > 0) c.lerp(CALOR, calor * 0.6)
    col[k * 3] = c.r * escala
    col[k * 3 + 1] = c.g * escala
    col[k * 3 + 2] = c.b * escala
  }
}

/** Viruta: espirales metálicas que saltan de la punta, caen a la plancha y se apagan. */
export class Virutas {
  readonly malla: THREE.InstancedMesh
  piso = 0
  private vivos: Array<{ p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: number; vida: number; k: number; apoyada: boolean }> = []
  private tmp = new THREE.Object3D()
  private readonly color = new THREE.Color()
  private static readonly MAX = 160

  constructor() {
    const geo = new THREE.TorusGeometry(5.5, 1.45, 5, 10, Math.PI * 1.5)
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.92, roughness: 0.22, envMapIntensity: 1.6 })
    this.malla = new THREE.InstancedMesh(geo, mat, Virutas.MAX)
    this.malla.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Virutas.MAX * 3), 3)
    this.malla.count = 0
    this.malla.frustumCulled = false
    this.malla.castShadow = true
  }

  /**
   * Una viruta sale de la punta, contraria al avance. `escala` crece con el
   * diámetro de la fresa y con la profundidad de corte; `avance` es la
   * dirección del movimiento (mm/s, ya en el mundo de la escena).
   */
  emitir(en: THREE.Vector3, avance: THREE.Vector3, escala: number) {
    if (this.vivos.length >= Virutas.MAX) this.vivos.shift()
    const rapidez = Math.min(1, avance.length() / 120)
    const atras = avance.clone().setZ(0)
    if (atras.lengthSq() > 1e-6) atras.normalize().multiplyScalar(-1)
    const lateral = new THREE.Vector3(-atras.y, atras.x, 0).multiplyScalar((Math.random() - 0.5) * 2)
    const empuje = 90 + 130 * rapidez
    this.vivos.push({
      p: en.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 0)),
      v: new THREE.Vector3(
        atras.x * empuje + lateral.x * 90 + (Math.random() - 0.5) * 70,
        atras.y * empuje + lateral.y * 90 + (Math.random() - 0.5) * 70,
        110 + Math.random() * 150,
      ),
      r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      w: 6 + Math.random() * 14,
      vida: 1.6,
      k: escala * (0.7 + Math.random() * 0.6),
      apoyada: false,
    })
  }

  actualizar(dt: number) {
    let n = 0
    for (const c of this.vivos) {
      c.vida -= dt
      if (c.vida <= 0) continue
      if (!c.apoyada) {
        c.v.z -= 1700 * dt
        c.p.addScaledVector(c.v, dt)
        if (c.v.z < 0 && c.p.z < this.piso) {
          c.p.z = this.piso + 0.5 * c.k
          c.v.set(c.v.x * 0.12, c.v.y * 0.12, 0)
          c.w = 0
          c.apoyada = true
          c.vida = Math.min(c.vida, 1.1)
        }
        c.r.x += c.w * dt
        c.r.y += c.w * dt * 0.7
      } else {
        c.p.addScaledVector(c.v, dt)
        c.v.multiplyScalar(Math.max(0, 1 - 6 * dt))
      }
      this.tmp.position.copy(c.p)
      this.tmp.rotation.copy(c.r)
      const e = c.k * Math.min(1, c.vida / 0.4)
      this.tmp.scale.setScalar(Math.max(0.05, e))
      this.tmp.updateMatrix()
      this.malla.setMatrixAt(n, this.tmp.matrix)
      // Plata, con algo de azul de recocido o dorado, como la viruta real.
      this.color.setHSL(0.08 + (n % 7) * 0.06, 0.12 + (n % 3) * 0.1, 0.78 - (n % 4) * 0.06)
      this.malla.setColorAt(n, this.color)
      n++
    }
    this.vivos = this.vivos.filter((c) => c.vida > 0)
    this.malla.count = n
    this.malla.instanceMatrix.needsUpdate = true
    if (this.malla.instanceColor) this.malla.instanceColor.needsUpdate = true
  }

  /** Deja de emitir, pero lo que ya cayó termina de apagarse. */
  apagar(dt = 0) {
    if (!this.vivos.length && this.malla.count === 0) return
    if (dt > 0) this.actualizar(dt)
    else {
      this.vivos = []
      this.malla.count = 0
      this.malla.instanceMatrix.needsUpdate = true
    }
  }

  dispose() {
    this.malla.geometry.dispose()
    ;(this.malla.material as THREE.Material).dispose()
  }
}
