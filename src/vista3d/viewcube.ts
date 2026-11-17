/**
 * El cubo de vistas (Frente, Arriba, Derecha…) y la casa de su esquina
 * superior izquierda, que vuelve a la vista con la que abre la escena.
 */
import type { WebGLRenderer } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ViewportGizmo } from 'three-viewport-gizmo'

export interface ViewCube {
  render: () => void
  actualizar: () => void
  /** El cubo está girando la cámara: la escena tiene que seguir dibujándose. */
  animando: () => boolean
  dispose: () => void
}

export function crearViewCube(
  camara: ConstructorParameters<typeof ViewportGizmo>[0],
  renderer: WebGLRenderer,
  controles: OrbitControls,
  contenedor: HTMLElement,
  id: string,
  alInicio: () => void,
): ViewCube {
  if (getComputedStyle(contenedor).position === 'static') contenedor.style.position = 'relative'
  const cara = {
    color: '#6d737b',
    labelColor: '#ffffff',
    opacity: 0.82,
    border: { size: 1.5, color: '#3a3a3a' },
    hover: { color: '#3a3e44', labelColor: '#ffffff', opacity: 0.96, border: { size: 1.5, color: '#2a2a2a' } },
  }
  const gizmo = new ViewportGizmo(camara, renderer, {
    container: contenedor,
    type: 'cube',
    placement: 'top-left',
    size: 100,
    offset: { top: 16, left: 16, right: 12, bottom: 12 },
    animated: true,
    speed: 1,
    radius: 0.08,
    resolution: 256,
    id,
    background: { enabled: false },
    font: { family: 'system-ui, sans-serif', weight: 600 },
    corners: {
      enabled: true,
      color: '#8d939b',
      opacity: 0,
      scale: 0.18,
      radius: 0.2,
      hover: { color: '#3a3e44', opacity: 0.95, scale: 0.22 },
    },
    edges: {
      enabled: true,
      color: '#5c6168',
      opacity: 0.75,
      scale: 0.7,
      radius: 0.12,
      hover: { color: '#3a3e44', opacity: 0.95, scale: 0.85 },
    },
    front: { ...cara, label: 'Frente' },
    top: { ...cara, label: 'Arriba' },
    right: { ...cara, label: 'Derecha' },
    left: { ...cara, label: 'Izquierda' },
    bottom: { ...cara, label: 'Abajo' },
    back: { ...cara, label: 'Atrás' },
  })
  gizmo.attachControls(controles as Parameters<ViewportGizmo['attachControls']>[0])

  const casa = document.createElement('button')
  casa.type = 'button'
  casa.className = 'viewcube-casa'
  casa.title = 'Volver a la vista inicial'
  casa.setAttribute('aria-label', 'Volver a la vista inicial')
  casa.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3.5 11.2 12 4l8.5 7.2V20a1 1 0 0 1-1 1h-5.2v-6.2H9.7V21H4.5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
  const ir = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    alInicio()
  }
  casa.addEventListener('pointerdown', ir)
  contenedor.appendChild(casa)

  return {
    render: () => gizmo.render(),
    actualizar: () => gizmo.domUpdate(),
    animando: () => gizmo.animating,
    dispose: () => {
      casa.remove()
      gizmo.dispose()
    },
  }
}
