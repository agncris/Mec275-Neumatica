/**
 * Cómo responde el arrastre de la cámara en las vistas 3D.
 * Girar da vueltas alrededor de la escena, Mover la desplaza y Zoom
 * acerca o aleja al arrastrar hacia arriba o abajo.
 */
import { Vector3 } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/** Los mismos números que THREE.MOUSE / THREE.TOUCH (no están en los tipos de esta versión). */
const MOUSE = { ROTATE: 0, DOLLY: 1, PAN: 2 } as const
const TOUCH = { ROTATE: 0, PAN: 1, DOLLY_PAN: 2 } as const

export type ModoArrastre = 'girar' | 'mover' | 'zoom'
export type VistaCamara = 'iso' | 'frente' | 'lado' | 'arriba'

export function aplicarModoArrastre(c: OrbitControls, modo: ModoArrastre) {
  c.mouseButtons.LEFT = modo === 'mover' ? MOUSE.PAN : modo === 'zoom' ? MOUSE.DOLLY : MOUSE.ROTATE
  c.mouseButtons.RIGHT = modo === 'mover' ? MOUSE.ROTATE : MOUSE.PAN
  // Con un dedo, Zoom no gira: se acerca con + y −. Dos dedos siguen pellizcando.
  c.touches.ONE = modo === 'mover' ? TOUCH.PAN : modo === 'zoom' ? TOUCH.DOLLY_PAN : TOUCH.ROTATE
}

/** Acerca (true) o aleja (false) manteniendo el punto al que mira la cámara. */
export function zoomCamara(c: OrbitControls, acercar: boolean) {
  const cam = c.object
  const offset = cam.position.clone().sub(c.target)
  const dist = offset.length()
  if (dist < 1e-6) return
  const nueva = Math.min(c.maxDistance, Math.max(c.minDistance, dist * (acercar ? 0.8 : 1.25)))
  offset.multiplyScalar(nueva / dist)
  cam.position.copy(c.target).add(offset)
  c.update()
}

export type LadoCubo = 'izquierda' | 'derecha' | 'arriba' | 'abajo'

/**
 * Gira la cámara 90° hacia el lado indicado y cae en la cara siguiente
 * (frente, lado, arriba…), sin quedarse en la vista intermedia a 45°.
 */
export function girarCuadrante(c: OrbitControls, lado: LadoCubo) {
  const cam = c.object
  const offset = cam.position.clone().sub(c.target)
  const dist = Math.max(offset.length(), 1)
  const mirada = offset.clone().negate()
  if (mirada.lengthSq() < 1e-8) return
  mirada.normalize()
  const arriba = cam.up.clone().normalize()
  const derecha = new Vector3().crossVectors(mirada, arriba)
  if (derecha.lengthSq() < 1e-8) return
  derecha.normalize()
  const horizontal = lado === 'izquierda' || lado === 'derecha'
  const eje = horizontal ? arriba : derecha
  const ang = (lado === 'derecha' || lado === 'abajo' ? 1 : -1) * (Math.PI / 2)
  offset.applyAxisAngle(eje, ang)
  const ax = Math.abs(offset.x)
  const ay = Math.abs(offset.y)
  const az = Math.abs(offset.z)
  const destino = new Vector3()
  if (ay >= ax && ay >= az) destino.set(0, Math.sign(offset.y) || 1, 0)
  else if (ax >= az) destino.set(Math.sign(offset.x) || 1, 0, 0)
  else destino.set(0, 0, Math.sign(offset.z) || 1)
  destino.multiplyScalar(dist)
  if (Math.abs(destino.y) > dist * 0.9) {
    const pelo = new Vector3(offset.x, 0, offset.z)
    if (pelo.lengthSq() < 1e-6) pelo.set(0, 0, 1)
    pelo.normalize().multiplyScalar(dist * 0.02)
    destino.add(pelo)
  }
  cam.position.copy(c.target).add(destino)
  cam.lookAt(c.target)
  c.update()
}

/** Salta a una vista guardando la distancia actual. `iso` lo resuelve cada escena. */
export function saltarVista(c: OrbitControls, vista: Exclude<VistaCamara, 'iso'>) {
  const cam = c.object
  const t = c.target
  const d = Math.max(cam.position.distanceTo(t), c.minDistance || 0.05)
  const separacion = Math.max(d * 0.01, 0.001)
  if (vista === 'frente') cam.position.set(t.x, t.y, t.z + d)
  else if (vista === 'arriba') cam.position.set(t.x, t.y + d, t.z + separacion)
  else cam.position.set(t.x + d, t.y, t.z)
  c.update()
}
