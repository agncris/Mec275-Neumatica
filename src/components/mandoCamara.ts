/**
 * Cómo responde el arrastre de la cámara en las vistas 3D.
 * Girar da vueltas alrededor de la escena, Mover la desplaza y Zoom
 * acerca o aleja al arrastrar hacia arriba o abajo.
 */
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
