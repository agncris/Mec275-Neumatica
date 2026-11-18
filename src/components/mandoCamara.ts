/**
 * Cómo responde el arrastre de la cámara en las vistas 3D.
 * Girar da vueltas alrededor de la escena, Mover la desplaza y Zoom
 * acerca o aleja al arrastrar hacia arriba o abajo.
 */
import { Raycaster, Vector2, Vector3, type Camera, type Object3D } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/** Los mismos números que THREE.MOUSE / THREE.TOUCH (no están en los tipos de esta versión). */
const MOUSE = { ROTATE: 0, DOLLY: 1, PAN: 2 } as const
const TOUCH = { ROTATE: 0, PAN: 1, DOLLY_PAN: 2 } as const

export type ModoArrastre = 'girar' | 'mover' | 'zoom'
export type VistaCamara = 'iso' | 'frente' | 'lado' | 'arriba'

const CURSOR_GIRAR = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none"><path d="M16 5.5a10.5 10.5 0 0 1 9 5" stroke="#1c2733" stroke-width="2.4" stroke-linecap="round"/><path d="M24.2 5.2 26 11.2 20.2 9.6" stroke="#1c2733" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 26.5a10.5 10.5 0 0 1-9-5" stroke="#1c2733" stroke-width="2.4" stroke-linecap="round"/><path d="M7.8 26.8 6 20.8 11.8 22.4" stroke="#1c2733" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>')}") 16 16, grab`
const CURSOR_MOVER = 'all-scroll'
const CURSOR_MOVIENDO = 'grabbing'
const CURSOR_ZOOM = 'ns-resize'

type Gesto = 'rotar' | 'arrastrar' | 'zoom'

function gestoDe(codigo: number): Gesto | null {
  if (codigo === MOUSE.ROTATE) return 'rotar'
  if (codigo === MOUSE.PAN) return 'arrastrar'
  if (codigo === MOUSE.DOLLY) return 'zoom'
  return null
}

function pintarCursor(el: HTMLElement, gesto: Gesto | null, activo: boolean) {
  if (gesto === 'rotar') el.style.cursor = CURSOR_GIRAR
  else if (gesto === 'arrastrar') el.style.cursor = activo ? CURSOR_MOVIENDO : CURSOR_MOVER
  else if (gesto === 'zoom') el.style.cursor = CURSOR_ZOOM
  else el.style.cursor = ''
}

const alSoltarModo = new WeakMap<OrbitControls, () => void>()

export function aplicarModoArrastre(c: OrbitControls, modo: ModoArrastre) {
  c.mouseButtons.LEFT = modo === 'mover' ? MOUSE.PAN : modo === 'zoom' ? MOUSE.DOLLY : MOUSE.ROTATE
  c.mouseButtons.RIGHT = modo === 'mover' ? MOUSE.ROTATE : MOUSE.PAN
  // El botón de la rueda desplaza la vista, sea cual sea el modo del botón izquierdo.
  c.mouseButtons.MIDDLE = MOUSE.PAN
  // Con un dedo, Zoom no gira: se acerca con + y −. Dos dedos siguen pellizcando.
  c.touches.ONE = modo === 'mover' ? TOUCH.PAN : modo === 'zoom' ? TOUCH.DOLLY_PAN : TOUCH.ROTATE
  alSoltarModo.get(c)?.()
}

/**
 * El cursor del lienzo dice qué está pasando: flechas de giro al rotar,
 * mano al desplazar con el botón izquierdo o con el de la rueda.
 */
export function cursoresCamara(c: OrbitControls, el: HTMLElement): () => void {
  let pulsado = false
  let rueda: { x: number; y: number } | null = null
  const gestoBoton = (button: number) => {
    const codigo = button === 0 ? c.mouseButtons.LEFT : button === 1 ? c.mouseButtons.MIDDLE : button === 2 ? c.mouseButtons.RIGHT : -1
    return gestoDe(codigo ?? -1)
  }
  const reposo = () => {
    if (!pulsado && !rueda) pintarCursor(el, gestoBoton(0), false)
  }
  alSoltarModo.set(c, reposo)
  reposo()
  // La rueda se arrastra aquí, y no por OrbitControls: en el Mac el clic del
  // medio llega con Ctrl y esos controles lo convierten en un giro.
  const alRueda = (e: PointerEvent) => {
    if (e.button !== 1) return
    e.preventDefault()
    e.stopImmediatePropagation()
    rueda = { x: e.clientX, y: e.clientY }
    pulsado = true
    pintarCursor(el, 'arrastrar', true)
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* el puntero ya no está */
    }
  }
  const moverRueda = (e: PointerEvent) => {
    if (!rueda) return
    const dx = e.clientX - rueda.x
    const dy = e.clientY - rueda.y
    rueda = { x: e.clientX, y: e.clientY }
    if (dx === 0 && dy === 0) return
    const ctrl = c as OrbitControls & { _pan: (x: number, y: number) => void }
    ctrl._pan(dx * c.panSpeed, dy * c.panSpeed)
    c.update()
  }
  const soltarRueda = (e: PointerEvent) => {
    if (!rueda) return
    if (e.type !== 'pointercancel' && e.button !== 1) return
    rueda = null
    pulsado = false
    reposo()
  }
  const alBajar = (e: PointerEvent) => {
    if (e.button === 1) return
    const gesto = gestoBoton(e.button)
    if (!gesto) return
    pulsado = true
    pintarCursor(el, gesto, true)
  }
  const alSubir = (e: PointerEvent) => {
    if (e.button === 1) return
    pulsado = false
    reposo()
  }
  const bloquearRueda = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault()
  }
  el.addEventListener('pointerdown', alRueda, true)
  el.addEventListener('pointermove', moverRueda)
  el.addEventListener('pointerup', soltarRueda)
  el.addEventListener('pointercancel', soltarRueda)
  el.addEventListener('pointerdown', alBajar)
  el.addEventListener('mousedown', bloquearRueda, true)
  window.addEventListener('pointerup', alSubir)
  window.addEventListener('pointercancel', alSubir)
  return () => {
    alSoltarModo.delete(c)
    el.removeEventListener('pointerdown', alRueda, true)
    el.removeEventListener('pointermove', moverRueda)
    el.removeEventListener('pointerup', soltarRueda)
    el.removeEventListener('pointercancel', soltarRueda)
    el.removeEventListener('pointerdown', alBajar)
    el.removeEventListener('mousedown', bloquearRueda, true)
    window.removeEventListener('pointerup', alSubir)
    window.removeEventListener('pointercancel', alSubir)
    el.style.cursor = ''
  }
}

/**
 * Sobre un botón, una válvula o cualquier cosa que se pueda pulsar, el cursor pasa a ser
 * la mano de «clic»; fuera de ellos vuelve al de la cámara (girar, mover o zoom).
 */
export function cursorPulsables(c: OrbitControls, el: HTMLElement, camara: Camera, pulsables: () => Object3D[]): () => void {
  const rayo = new Raycaster()
  const p = new Vector2()
  let sobre = false
  const mover = (e: PointerEvent) => {
    if (e.buttons !== 0 || e.pointerType === 'touch') return
    const r = el.getBoundingClientRect()
    p.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    rayo.setFromCamera(p, camara)
    const toca = rayo.intersectObjects(pulsables(), true).length > 0
    if (toca === sobre) return
    sobre = toca
    if (toca) el.style.cursor = 'pointer'
    else alSoltarModo.get(c)?.()
  }
  const salir = () => {
    if (!sobre) return
    sobre = false
    alSoltarModo.get(c)?.()
  }
  el.addEventListener('pointermove', mover)
  el.addEventListener('pointerleave', salir)
  return () => {
    el.removeEventListener('pointermove', mover)
    el.removeEventListener('pointerleave', salir)
  }
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
