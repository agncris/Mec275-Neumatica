/**
 * Base común de las escenas 3D: el renderer con su lienzo, la escena, la cámara,
 * OrbitControls con sus cursores, el cubo de vistas, el ResizeObserver y el bucle
 * que se pausa cuando la escena no se ve (ver `visible.ts`).
 *
 * Lo que es propio de cada escena (luces, entorno, sombras, tono, el contenido y
 * cómo encuadra la cámara) lo pone la escena después de llamar a `crearEscena`.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { aplicarModoArrastre, cursoresCamara, type ModoArrastre } from '../components/mandoCamara'
import { crearViewCube, type ViewCube } from './viewcube'
import { bucleVisible } from './visible'

export interface OpcionesEscena {
  /** Con `preserveDrawingBuffer` el lienzo se puede exportar como imagen. */
  preserveDrawingBuffer?: boolean
  /** Cámara en perspectiva. */
  camara: { fov: number; near: number; far: number }
  /** Ajustes de OrbitControls (amortiguación, distancias, ángulos). */
  controles?: Partial<OrbitControls>
  /** Qué hace el botón izquierdo del mouse. Por defecto, girar. */
  modoArrastre?: ModoArrastre
  /** Identificador del cubo de vistas y qué hace la casita (volver a la vista inicial). */
  viewCube: { id: string; alInicio: () => void }
  /**
   * Con `true` el bucle solo llama a `render` cuando algo cambió: la cámara, el
   * puntero, el tamaño, el cubo de vistas o lo que la escena marque con
   * `marcarSucio`. Con `false` (por defecto) dibuja en cada cuadro.
   */
  soloSiCambia?: boolean
  /** La escena dejó de verse (por ejemplo, para callar sonidos). */
  alOcultar?: () => void
  /** Se agrega a lo que ya hace la base al cambiar el tamaño del contenedor. */
  alRedimensionar?: () => void
}

export interface EscenaBase {
  renderer: THREE.WebGLRenderer
  escena: THREE.Scene
  camara: THREE.PerspectiveCamera
  controles: OrbitControls
  cubo: ViewCube
  /** Pide dibujar el próximo cuadro (solo importa con `soloSiCambia`). */
  marcarSucio: () => void
  /**
   * Registra lo que se hace en cada cuadro y arranca el bucle. Se llama después de
   * armar la escena. La base actualiza los controles y dibuja (escena y cubo) al final.
   * `dt` va en segundos (máximo 0,1) y `ahora` es `performance.now()`.
   */
  alCuadro: (fn: (dt: number, ahora: number) => void) => void
  /** Detiene el bucle y suelta lo que creó la base. La escena suelta lo suyo aparte. */
  destruir: () => void
}

/** Devuelve `null` si el navegador no puede crear un contexto WebGL. */
export function crearEscena(cont: HTMLElement, opc: OpcionesEscena): EscenaBase | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: opc.preserveDrawingBuffer })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(cont.clientWidth, cont.clientHeight)
  cont.appendChild(renderer.domElement)

  const escena = new THREE.Scene()
  const camara = new THREE.PerspectiveCamera(opc.camara.fov, cont.clientWidth / Math.max(1, cont.clientHeight), opc.camara.near, opc.camara.far)
  const controles = new OrbitControls(camara, renderer.domElement)
  if (opc.controles) Object.assign(controles, opc.controles)
  // El botón del medio desplaza la vista. Lo engancha cursoresCamara.
  aplicarModoArrastre(controles, opc.modoArrastre ?? 'girar')
  const quitarCursores = cursoresCamara(controles, renderer.domElement)
  const cubo = crearViewCube(camara, renderer, controles, cont, opc.viewCube.id, opc.viewCube.alInicio)

  let sucio = true
  const marcarSucio = () => {
    sucio = true
  }
  const eventosPuntero = ['pointermove', 'pointerdown', 'pointerup', 'pointerleave', 'wheel'] as const
  if (opc.soloSiCambia) {
    controles.addEventListener('change', marcarSucio)
    for (const e of eventosPuntero) cont.addEventListener(e, marcarSucio, { passive: true })
  }
  const observador = new ResizeObserver(() => {
    sucio = true
    renderer.setSize(cont.clientWidth, cont.clientHeight)
    camara.aspect = cont.clientWidth / Math.max(1, cont.clientHeight)
    camara.updateProjectionMatrix()
    cubo.actualizar()
    opc.alRedimensionar?.()
  })
  observador.observe(cont)

  let pararBucle: (() => void) | null = null
  const alCuadro = (fn: (dt: number, ahora: number) => void) => {
    pararBucle?.()
    let antes = performance.now()
    const cuadro = () => {
      const ahora = performance.now()
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      fn(dt, ahora)
      if (controles.update() && opc.soloSiCambia) sucio = true
      if (opc.soloSiCambia) {
        if (cubo.animando()) sucio = true
        if (!sucio) return
        sucio = false
      }
      renderer.render(escena, camara)
      cubo.render()
    }
    pararBucle = bucleVisible(cont, cuadro, { alOcultar: opc.alOcultar, alMostrar: marcarSucio })
  }

  return {
    renderer,
    escena,
    camara,
    controles,
    cubo,
    marcarSucio,
    alCuadro,
    destruir: () => {
      pararBucle?.()
      pararBucle = null
      if (opc.soloSiCambia) {
        controles.removeEventListener('change', marcarSucio)
        for (const e of eventosPuntero) cont.removeEventListener(e, marcarSucio)
      }
      observador.disconnect()
      quitarCursores()
      controles.dispose()
      cubo.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === cont) cont.removeChild(renderer.domElement)
    },
  }
}
