/**
 * Herramientas para comprobar, sin WebGL, que una escena 3D de máquina está bien armada:
 * que lo que se mueve no atraviesa lo que está quieto y que nada queda en el aire.
 *
 * Cada malla se aproxima por su forma: caja, cilindro o cono (sus medidas salen de la
 * geometría) o, si es otra cosa, por la caja envolvente. Una colisión se declara cuando un
 * punto de una malla entra en la otra más que `tolerancia` mm (así los apoyos y los roces
 * no cuentan). Dos mallas «se tocan» si están a menos de `holgura` mm.
 */
import * as THREE from 'three'

export interface Cuerpo {
  malla: THREE.Mesh
  nombre: string
  /** Caja envolvente en el mundo. */
  caja: THREE.Box3
  inv: THREE.Matrix4
  forma: 'caja' | 'cilindro' | 'envolvente'
  local: THREE.Box3
  radio0: number
  radio1: number
  puntosLocales: THREE.Vector3[]
  puntos?: THREE.Vector3[]
}

const cacheLocal = new WeakMap<THREE.BufferGeometry, { forma: Cuerpo['forma']; local: THREE.Box3; radio0: number; radio1: number; puntos: THREE.Vector3[] }>()

function infoGeometria(g: THREE.BufferGeometry) {
  const c = cacheLocal.get(g)
  if (c) return c
  g.computeBoundingBox()
  const local = g.boundingBox!.clone()
  const tipo = g.type
  const p = (g as unknown as { parameters?: Record<string, number> }).parameters ?? {}
  let forma: Cuerpo['forma'] = 'envolvente'
  let radio0 = 0
  let radio1 = 0
  if (tipo === 'BoxGeometry' || tipo === 'RoundedBoxGeometry') forma = 'caja'
  else if (tipo === 'CylinderGeometry' || tipo === 'ConeGeometry') {
    forma = 'cilindro'
    // radio0 abajo (y = −h/2), radio1 arriba (y = +h/2).
    radio0 = p.radiusBottom ?? p.radius ?? 0
    radio1 = p.radiusTop ?? 0
  }
  const puntos: THREE.Vector3[] = []
  const pos = g.getAttribute('position')
  const visto = new Set<string>()
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i)
    const k = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`
    if (visto.has(k)) continue
    visto.add(k)
    puntos.push(v)
  }
  const info = { forma, local, radio0, radio1, puntos }
  // Relleno: una rejilla dentro del sólido (no basta con la superficie para detectar
  // una pared delgada que atraviesa otra pieza).
  const n = 4
  const t = local.getSize(new THREE.Vector3())
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++)
      for (let k = 0; k <= n; k++) {
        const v = new THREE.Vector3(local.min.x + (t.x * i) / n, local.min.y + (t.y * j) / n, local.min.z + (t.z * k) / n)
        if (forma === 'envolvente' || dentroLocal(info, v, 0)) puntos.push(v)
      }
  cacheLocal.set(g, info)
  return info
}

function dentroLocal(c: { forma: Cuerpo['forma']; local: THREE.Box3; radio0: number; radio1: number }, v: THREE.Vector3, margen: number): boolean {
  const l = c.local
  if (c.forma === 'cilindro') {
    const h = l.max.y - l.min.y
    if (v.y < l.min.y - margen || v.y > l.max.y + margen) return false
    const f = h > 0 ? (v.y - l.min.y) / h : 0
    const r = c.radio0 + (c.radio1 - c.radio0) * Math.min(1, Math.max(0, f))
    return Math.hypot(v.x, v.z) <= r + margen
  }
  return (
    v.x >= l.min.x - margen && v.x <= l.max.x + margen && v.y >= l.min.y - margen && v.y <= l.max.y + margen && v.z >= l.min.z - margen && v.z <= l.max.z + margen
  )
}

export function cuerpoDe(malla: THREE.Mesh, nombre = malla.name): Cuerpo {
  malla.updateWorldMatrix(true, false)
  const g = malla.geometry as THREE.BufferGeometry
  const info = infoGeometria(g)
  const caja = new THREE.Box3()
  const esq = [info.local.min, info.local.max]
  for (const x of esq) for (const y of esq) for (const z of esq) caja.expandByPoint(new THREE.Vector3(x.x, y.y, z.z).applyMatrix4(malla.matrixWorld))
  return {
    malla,
    nombre,
    caja,
    inv: malla.matrixWorld.clone().invert(),
    forma: info.forma,
    local: info.local,
    radio0: info.radio0,
    radio1: info.radio1,
    puntosLocales: info.puntos,
  }
}

export function puntosDe(c: Cuerpo): THREE.Vector3[] {
  if (!c.puntos) c.puntos = c.puntosLocales.map((p) => p.clone().applyMatrix4(c.malla.matrixWorld))
  return c.puntos
}

const tmp = new THREE.Vector3()

/** ¿El punto del mundo está dentro del cuerpo? margen > 0 agranda el cuerpo; < 0 lo achica. */
export function dentro(c: Cuerpo, p: THREE.Vector3, margen: number): boolean {
  if (p.x < c.caja.min.x - margen || p.x > c.caja.max.x + margen || p.y < c.caja.min.y - margen || p.y > c.caja.max.y + margen || p.z < c.caja.min.z - margen || p.z > c.caja.max.z + margen) {
    return false
  }
  if (c.forma === 'envolvente') return true
  return dentroLocal(c, tmp.copy(p).applyMatrix4(c.inv), margen)
}

/** Algún punto de `a` está dentro de `b` (agrandado o achicado por `margen`). */
export function penetra(a: Cuerpo, b: Cuerpo, margen: number): THREE.Vector3 | null {
  const caja = b.caja.clone().expandByScalar(Math.abs(margen))
  if (!caja.intersectsBox(a.caja)) return null
  for (const p of puntosDe(a)) if (dentro(b, p, margen)) return p
  return null
}

export const cercaDe = (a: Cuerpo, b: Cuerpo, holgura: number) => penetra(a, b, holgura) !== null || penetra(b, a, holgura) !== null
export const seCruzan = (a: Cuerpo, b: Cuerpo, tolerancia: number) => penetra(a, b, -tolerancia) !== null || penetra(b, a, -tolerancia) !== null

/** Mallas visibles de una escena (sin las instanciadas, las líneas ni las decoraciones). */
export function mallasDe(raiz: THREE.Object3D, omitir: (m: THREE.Mesh) => boolean = () => false): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  raiz.updateMatrixWorld(true)
  raiz.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || (o as THREE.InstancedMesh).isInstancedMesh) return
    if (!m.visible) return
    let a: THREE.Object3D | null = o
    while (a) {
      if (!a.visible) return
      a = a.parent
    }
    if (m.name === 'contacto' || m.name === 'marca') return
    if (omitir(m)) return
    out.push(m)
  })
  return out
}

/** Mallas que no llegan a la base por una cadena de contactos (la base es la raíz del grafo). */
export function enElAire(cuerpos: Cuerpo[], esBase: (c: Cuerpo) => boolean, holgura: number): Cuerpo[] {
  const visitado = new Set<Cuerpo>()
  const pila = cuerpos.filter(esBase)
  for (const b of pila) visitado.add(b)
  while (pila.length) {
    const a = pila.pop()!
    for (const b of cuerpos) {
      if (visitado.has(b)) continue
      if (cercaDe(a, b, holgura)) {
        visitado.add(b)
        pila.push(b)
      }
    }
  }
  return cuerpos.filter((c) => !visitado.has(c))
}
