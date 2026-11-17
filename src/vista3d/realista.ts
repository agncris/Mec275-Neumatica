/**
 * Calidad compartida de las escenas 3D: tono de película, sombras suaves,
 * reflejo de un interior claro y un piso de hormigón. No cambia la cinemática.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export function calidadRender(renderer: THREE.WebGLRenderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
}

/** Cielo de taller, claro arriba y un poco más frío abajo. */
export function fondoTaller(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#f7f9fc')
  grad.addColorStop(0.45, '#e7edf3')
  grad.addColorStop(1, '#cfd6df')
  g.fillStyle = grad
  g.fillRect(0, 0, 2, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Reflejos de un interior (ventanas y paredes) para que el metal y la pintura no se vean planos. */
export function entornoEstudio(renderer: THREE.WebGLRenderer, escena: THREE.Scene, intensidad = 0.85) {
  const pmrem = new THREE.PMREMGenerator(renderer)
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  escena.environmentIntensity = intensidad
  return pmrem
}

export function solSuave(color = 0xfff3e4, intensidad = 2.4): THREE.DirectionalLight {
  const sol = new THREE.DirectionalLight(color, intensidad)
  sol.castShadow = true
  sol.shadow.mapSize.set(2048, 2048)
  sol.shadow.bias = -0.00025
  sol.shadow.normalBias = 0.04
  sol.shadow.radius = 4
  return sol
}

/** Mancha suave bajo la base, para que el equipo se apoye en el piso. El plano queda en XY. */
export function sombraContacto(radio: number): THREE.Mesh {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const rad = g.createRadialGradient(64, 64, 10, 64, 64, 64)
  rad.addColorStop(0, 'rgba(24,28,34,0.42)')
  rad.addColorStop(0.55, 'rgba(24,28,34,0.16)')
  rad.addColorStop(1, 'rgba(24,28,34,0)')
  g.fillStyle = rad
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radio, 40),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  )
  m.renderOrder = 1
  return m
}

/** Disco de hormigón, con grano, que recibe la sombra del equipo. Queda en el plano XZ (Y arriba). */
export function pisoHormigon(radio: number): THREE.Mesh {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#d7dee6'
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 512
    g.fillStyle = `rgba(70,82,96,${0.03 + Math.random() * 0.07})`
    g.fillRect(x, y, 2, 2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radio, 64),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, metalness: 0.03 }),
  )
  m.rotation.x = -Math.PI / 2
  m.receiveShadow = true
  return m
}
