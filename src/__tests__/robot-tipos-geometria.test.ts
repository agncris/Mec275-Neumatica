/**
 * Geometría de la galería «Tipos de robot» (Estudiar): sin WebGL, solo three.js en memoria.
 * Para cada tipo, en toda su animación («Mover solo») y en los extremos de los deslizadores:
 *   1. ninguna pieza atraviesa el piso ni la mesa;
 *   2. cada pieza está unida a la base (grafo de contacto desde lo que toca el piso);
 *   3. cada eje prismático sigue metido en su guía.
 *
 * Cómo se mide: cada malla se reemplaza por su caja envolvente orientada (OBB) en coordenadas de
 * mundo y se comparan con el teorema de ejes separadores. Es conservador: la caja de un cilindro
 * girado o de una barra inclinada sobra en las esquinas, así que esta prueba detecta piezas en el
 * aire o hundidas, pero no mide el roce fino entre superficies curvas.
 */
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { INFO, TIPOS, armar, juntasEnTiempo, type Modelo, type Tipo } from '../robot/tiposRobotModelos'

/** Holgura (mm) para decir que dos piezas se tocan: cubre los bordes redondeados y la unión visual. */
const TOL_CONTACTO = 2
/** Profundidad (mm) que se tolera antes de decir que una pieza atraviesa el piso o la mesa. */
const TOL_PENETRA = 1
/** Se tolera hundirse esto en el piso (mm). */
const TOL_PISO = 0.5

interface Obb {
  nombre: string
  c: THREE.Vector3
  ejes: THREE.Vector3[]
  h: [number, number, number]
}

function obbDe(m: THREE.Mesh): Obb {
  m.geometry.computeBoundingBox()
  const bb = m.geometry.boundingBox as THREE.Box3
  const c = bb.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld)
  const e = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5)
  const ejes: THREE.Vector3[] = []
  const h: number[] = []
  const col = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  m.matrixWorld.extractBasis(col[0], col[1], col[2])
  col.forEach((v, i) => {
    const s = v.length()
    ejes.push(v.clone().divideScalar(s))
    h.push([e.x, e.y, e.z][i] * s)
  })
  return { nombre: m.name || m.uuid, c, ejes, h: h as [number, number, number] }
}

/** Hay solape si no existe un eje que separe las cajas por más que `margen` (margen negativo = exige penetrar). */
function seCruzan(a: Obb, b: Obb, margen: number): boolean {
  const d = b.c.clone().sub(a.c)
  const candidatos: THREE.Vector3[] = [...a.ejes, ...b.ejes]
  for (const x of a.ejes) for (const y of b.ejes) {
    const w = new THREE.Vector3().crossVectors(x, y)
    if (w.lengthSq() > 1e-9) candidatos.push(w.normalize())
  }
  for (const L of candidatos) {
    const ra = a.h.reduce((s, hi, i) => s + hi * Math.abs(a.ejes[i].dot(L)), 0)
    const rb = b.h.reduce((s, hi, i) => s + hi * Math.abs(b.ejes[i].dot(L)), 0)
    if (Math.abs(d.dot(L)) > ra + rb + margen) return false
  }
  return true
}

function esquinas(o: Obb): THREE.Vector3[] {
  const r: THREE.Vector3[] = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    r.push(o.c.clone().addScaledVector(o.ejes[0], sx * o.h[0]).addScaledVector(o.ejes[1], sy * o.h[1]).addScaledVector(o.ejes[2], sz * o.h[2]))
  }
  return r
}

function mallas(g: THREE.Group): THREE.Mesh[] {
  const r: THREE.Mesh[] = []
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) r.push(o as THREE.Mesh)
  })
  return r
}

/** Revisa una pose y devuelve los problemas encontrados (lista vacía si está bien). */
function revisar(modelo: Modelo, opciones: { piso?: boolean } = {}): string[] {
  modelo.g.updateMatrixWorld(true)
  const ms = mallas(modelo.g)
  const cajas = new Map(ms.map((m) => [m, obbDe(m)]))
  const problemas: string[] = []
  const mesa = ms.find((m) => m.name === 'mesa')
  const cMesa = mesa ? cajas.get(mesa) : undefined
  const minY = new Map<THREE.Mesh, number>()
  for (const m of ms) {
    const c = cajas.get(m) as Obb
    const y = Math.min(...esquinas(c).map((p) => p.y))
    minY.set(m, y)
    if (opciones.piso !== false && y < -TOL_PISO) problemas.push(`${m.name} atraviesa el piso (${y.toFixed(1)} mm)`)
    if (cMesa && m !== mesa && seCruzan(c, cMesa, -TOL_PENETRA)) problemas.push(`${m.name} atraviesa la mesa`)
  }
  // Grafo de contacto: parten las piezas que se apoyan en el piso; todas deben quedar alcanzadas.
  const alcanzadas = new Set<THREE.Mesh>(ms.filter((m) => (minY.get(m) as number) <= TOL_CONTACTO))
  const pila = [...alcanzadas]
  while (pila.length) {
    const a = pila.pop() as THREE.Mesh
    for (const b of ms) {
      if (alcanzadas.has(b)) continue
      if (seCruzan(cajas.get(a) as Obb, cajas.get(b) as Obb, TOL_CONTACTO)) {
        alcanzadas.add(b)
        pila.push(b)
      }
    }
  }
  for (const m of ms) if (!alcanzadas.has(m)) problemas.push(`${m.name} está en el aire (sin unión a la base)`)
  // Guías: la corredera sigue metida en la guía a lo largo de su eje de deslizamiento.
  for (const gu of modelo.guias) {
    const co = cajas.get(gu.corredera) as Obb
    const gi = cajas.get(gu.guia) as Obb
    const eje = co.ejes[gu.eje]
    const rango = (o: Obb) => {
      const p = esquinas(o).map((q) => q.dot(eje))
      return [Math.min(...p), Math.max(...p)]
    }
    const [a0, a1] = rango(co)
    const [b0, b1] = rango(gi)
    const solape = Math.min(a1, b1) - Math.max(a0, b0)
    if (solape < gu.solape - 0.5) problemas.push(`${gu.nombre}: la corredera solo queda ${solape.toFixed(0)} mm dentro de la guía (mínimo ${gu.solape})`)
  }
  return problemas
}

/** Poses del «Mover solo»: el ciclo completo (las juntas tienen periodos distintos, se muestrean 3 minutos). */
function posesAnimacion(tipo: Tipo): number[][] {
  const r: number[][] = []
  for (let t = 0; t <= 180; t += 0.25) r.push(juntasEnTiempo(tipo, t))
  return r
}

/** Poses de los deslizadores: todas las combinaciones de mínimo, medio y máximo de cada junta. */
function posesDeslizadores(tipo: Tipo): number[][] {
  let r: number[][] = [[]]
  for (const j of INFO[tipo].juntas) {
    r = r.flatMap((p) => [j.min, (j.min + j.max) / 2, j.max].map((x) => [...p, x]))
  }
  return r
}

function todosLosProblemas(tipo: Tipo, poses: number[][], opciones: { piso?: boolean } = {}): string[] {
  const modelo = armar(tipo)
  const vistos = new Map<string, string>()
  for (const v of poses) {
    modelo.poner(v)
    for (const p of revisar(modelo, opciones)) {
      const clave = p.replace(/ \(-?[\d.]+ mm\)/, '').replace(/solo queda -?\d+ mm/, 'queda corta')
      if (!vistos.has(clave)) vistos.set(clave, `${p} (por ejemplo con ${v.map((x) => Math.round(x)).join(', ')})`)
    }
  }
  return [...vistos.values()]
}

describe('Tipos de robot: la geometría se sostiene en toda la animación', () => {
  it('cubre todos los tipos de la galería', () => {
    expect(TIPOS.length).toBeGreaterThanOrEqual(6)
    for (const t of TIPOS) expect(INFO[t].juntas.length).toBeGreaterThan(0)
  })
  for (const tipo of TIPOS) {
    it(`${INFO[tipo].nombre}: «Mover solo»`, () => {
      expect(todosLosProblemas(tipo, posesAnimacion(tipo))).toEqual([])
    })
    it(`${INFO[tipo].nombre}: extremos de los deslizadores`, () => {
      // El brazo de 6 ejes tiene los límites de cada eje del KUKA, pero no un límite de espacio de trabajo:
      // con los deslizadores en ciertos extremos la herramienta baja bajo el piso, como en un robot real
      // sin zona de seguridad. Para ese tipo no se exige lo del piso en los extremos (sí en «Mover solo»).
      expect(todosLosProblemas(tipo, posesDeslizadores(tipo), { piso: tipo !== 'angular' })).toEqual([])
    })
  }
  it('la comprobación detecta una pieza en el aire y una que atraviesa la mesa', () => {
    const g = new THREE.Group()
    const m = (n: string, y: number, h: number) => {
      const x = new THREE.Mesh(new THREE.BoxGeometry(100, h, 100))
      x.name = n
      x.position.y = y
      g.add(x)
      return x
    }
    m('mesa', 10, 20)
    m('colgada', 300, 20)
    m('hundida', 15, 40)
    const problemas = revisar({ g, poner: () => undefined, guias: [] })
    expect(problemas.join('|')).toContain('colgada está en el aire')
    expect(problemas.join('|')).toContain('hundida atraviesa la mesa')
  })
})
