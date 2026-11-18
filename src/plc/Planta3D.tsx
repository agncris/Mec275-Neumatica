/**
 * La planta del laboratorio de PLC en 3D, movida por el programa del alumno:
 * el PLC con sus módulos y los LED de cada entrada y salida, y la máquina
 * que controla (tablero de pruebas, estanque o elevador de piezas), con sus
 * sensores, actuadores y sonido.
 *
 * La escena no guarda estado propio: en cada fotograma lee la simulación
 * (`sim.current`) y se pone al día. Los botones de la máquina se pulsan con
 * el ratón o el dedo, igual que en el banco.
 */
import HudEscena, { type PlayEscena } from '../components/HudEscena'
import { aplicarModoArrastre, saltarVista, zoomCamara, type ModoArrastre, type VistaCamara } from '../components/mandoCamara'
import { acercar, useCelular, useTactil } from '../components/ui'
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { fondoTaller } from '../vista3d/realista'
import { crearEscena as crearEscenaBase } from '../vista3d/escena'
import { SonidoBanco } from '../vista3d/sonido'
import { ponerNotacionEscena, type SimPLC } from './plantas3d/comun'
import { type Notacion } from './notacion'
import { crearEscena } from './plantas3d'
import { CLAVES, guardarTexto, leerTexto } from '../persistencia'

export type { SimPLC }

interface Props {
  sim: MutableRefObject<SimPLC>
  /** Cambia cuando se cambia de planta: hay que montar otra escena. */
  version: number
  acciones: Array<{ id: string; etiqueta: string; titulo: string }>
  onAccion: (id: string) => void
  notacion: Notacion
  /** Alto de la vista (en píxeles, o '100%' para llenar el área). */
  alto?: number | string
  /** Play dentro de la escena, cuando está a pantalla completa. */
  play?: PlayEscena
}

const CLAVE_SONIDO = CLAVES.plcSonido

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export default function Planta3D({ sim, version, acciones, onAccion, notacion, alto = 440, play }: Props) {
  const tactil = useTactil()
  const contRef = useRef<HTMLDivElement>(null)
  const [sinWebGL, setSinWebGL] = useState(false)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [vistaCamara, setVistaCamara] = useState<VistaCamara>('iso')
  const [modoArrastre, setModoArrastre] = useState<ModoArrastre>('girar')
  const vistaRef = useRef<(v: VistaCamara) => void>(() => {})
  const controlesRef = useRef<OrbitControls | null>(null)
  useEffect(() => {
    if (!pantallaCompleta) setModoArrastre('girar')
  }, [pantallaCompleta])
  useEffect(() => {
    if (controlesRef.current) aplicarModoArrastre(controlesRef.current, modoArrastre)
  }, [modoArrastre])
  const [conSonido, setConSonido] = useState(() => {
    return leerTexto(CLAVE_SONIDO) !== 'no'
  })
  const conSonidoRef = useRef(conSonido)
  conSonidoRef.current = conSonido
  const sonidoRef = useRef<SonidoBanco | null>(null)
  const sonido = () => (sonidoRef.current ??= new SonidoBanco())
  const encuadrarRef = useRef<() => void>(() => {})
  // En el celular los botones de la vista 3D van sólo con su ícono, para no tapar la escena.
  const celular = useCelular()
  // Rótulos grandes (S0, Y1, Z1…): se pueden ocultar si tapan algo.
  const [conRotulos, setConRotulos] = useState(() => {
    return leerTexto(CLAVES.plcRotulos3d) !== 'no'
  })
  const conRotulosRef = useRef(conRotulos)
  conRotulosRef.current = conRotulos
  /** Rótulos grandes y, de las mismas piezas, la pegatina o placa chica: se ve uno u otro, nunca los dos. */
  const insigniasRef = useRef<{ grandes: THREE.Object3D[]; chicos: THREE.Mesh[] }>({ grandes: [], chicos: [] })
  const aplicarRotulos = (con: boolean) => {
    for (const o of insigniasRef.current.grandes) o.visible = con
    // Sólo el material: la placa chica es la madre de su rótulo grande y no puede ocultarse entera.
    for (const m of insigniasRef.current.chicos) (m.material as THREE.Material).visible = !con
  }
  useEffect(() => {
    aplicarRotulos(conRotulos)
    guardarTexto(CLAVES.plcRotulos3d, conRotulos ? 'si' : 'no')
  }, [conRotulos])

  useEffect(() => {
    guardarTexto(CLAVE_SONIDO, conSonido ? 'si' : 'no')
    if (conSonido) sonido().activar()
    else sonidoRef.current?.callar()
  }, [conSonido])

  useEffect(
    () => () => {
      sonidoRef.current?.cerrar()
      sonidoRef.current = null
    },
    [],
  )

  useEffect(() => {
    const cont = contRef.current
    if (!cont) return
    // Con las zonas apiladas (ventana mediana) la rueda baja por la página; para
    // acercar se usa Ctrl + rueda (o el gesto de pellizcar del trackpad). Va antes
    // que los controles para poder quitarles la rueda.
    const alGirarRueda = (e: WheelEvent) => {
      // En pantalla completa la rueda acerca; en la página apilada, baja el contenido.
      if (!e.ctrlKey && document.fullscreenElement !== cont && cont.closest('.banco--apilado')) e.stopImmediatePropagation()
    }
    const base = crearEscenaBase(cont, {
      preserveDrawingBuffer: true,
      camara: { fov: 32, near: 0.01, far: 20 },
      controles: { enableDamping: true, dampingFactor: 0.08, minDistance: 0.12, maxDistance: 4, maxPolarAngle: Math.PI * 0.62, zoomToCursor: true },
      modoArrastre,
      viewCube: {
        id: 'viewcube-plc',
        alInicio: () => {
          setVistaCamara('iso')
          encuadrar()
        },
      },
      alCrearLienzo: (lienzo) => lienzo.addEventListener('wheel', alGirarRueda),
      controlesPrimero: true,
      // Fuera de pantalla o con la pestaña oculta no se dibuja ni suena.
      alOcultar: () => sonidoRef.current?.callar(),
    })
    if (!base) {
      setSinWebGL(true)
      return
    }
    const { renderer, escena, camara, controles } = base
    renderer.outputColorSpace = THREE.SRGBColorSpace
    // Neutral conserva los colores de la pintura y del plástico. ACES los lavaba.
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 0.94
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.localClippingEnabled = true
    renderer.domElement.style.display = 'block'
    renderer.domElement.dataset.planta3d = 'si'

    const pmrem = new THREE.PMREMGenerator(renderer)
    const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    escena.environment = entorno
    escena.environmentIntensity = 0.9
    escena.background = fondoTaller()

    ponerNotacionEscena(notacion)
    const idPlanta = sim.current.planta.id
    const planta = crearEscena(idPlanta)
    planta.raiz.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    escena.add(planta.raiz)
    // El encuadre se hace con la planta en reposo (sin chorros ni agua).
    planta.actualizar(sim.current, 0, null, () => 0)
    planta.raiz.updateMatrixWorld(true)
    const caja3 = new THREE.Box3()
    planta.raiz.traverse((o) => {
      let visible = true
      for (let a: THREE.Object3D | null = o; a; a = a.parent) visible &&= a.visible
      if (visible && (o as THREE.Mesh).isMesh) caja3.expandByObject(o)
    })
    const centro = caja3.getCenter(new THREE.Vector3())
    const tam = caja3.getSize(new THREE.Vector3())
    // Pared de laboratorio y mesa.
    const pared = new THREE.Mesh(
      new THREE.PlaneGeometry(tam.x + 1.2, tam.y + 0.8),
      new THREE.MeshStandardMaterial({ color: 0xbfc8d2, roughness: 0.9 }),
    )
    pared.position.set(centro.x, centro.y, -0.005)
    pared.receiveShadow = true
    const mesa = new THREE.Mesh(
      new THREE.BoxGeometry(tam.x + 1.0, 0.04, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x2c3a4c, roughness: 0.5, metalness: 0.3 }),
    )
    mesa.position.set(centro.x, caja3.min.y - 0.02, 0.33)
    mesa.receiveShadow = true
    escena.add(pared, mesa)

    const sol = new THREE.DirectionalLight(0xfff6ec, 2.6)
    sol.position.set(centro.x - 0.5, centro.y + 1.0, 1.3)
    sol.target.position.copy(centro)
    sol.castShadow = true
    sol.shadow.mapSize.set(2048, 2048)
    const s = Math.max(tam.x, tam.y) * 0.8
    Object.assign(sol.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.2, far: 4 })
    sol.shadow.bias = -0.0004
    sol.shadow.normalBias = 0.01
    escena.add(sol, sol.target, new THREE.HemisphereLight(0xf2f6ff, 0x5d6168, 0.35))
    const relleno = new THREE.DirectionalLight(0xdfe8ff, 0.5)
    relleno.position.set(centro.x + 1.2, centro.y + 0.3, 0.9)
    escena.add(relleno)

    controlesRef.current = controles
    const encuadrar = () => {
      const aspecto = cont.clientWidth / Math.max(1, cont.clientHeight)
      const vfov = THREE.MathUtils.degToRad(camara.fov)
      const distV = ((tam.y + 0.06) * 0.52) / Math.tan(vfov / 2)
      const distH = ((tam.x + 0.06) * 0.52) / Math.tan(vfov / 2) / aspecto
      const dist = Math.max(distV, distH, 0.3)
      if (planta.vistaAlta) {
        // Maqueta horizontal: se mira desde arriba y por delante.
        const d = Math.max(dist, ((tam.z + 0.1) * 0.6) / Math.tan(vfov / 2))
        camara.position.set(centro.x, centro.y + d * 0.8, centro.z + d * 0.75)
        controles.target.set(centro.x, centro.y, centro.z * 0.8)
      } else {
        camara.position.set(centro.x + dist * 0.12, centro.y + dist * 0.14, dist + 0.05)
        controles.target.set(centro.x, centro.y, 0.04)
      }
      controles.update()
    }
    encuadrar()
    encuadrarRef.current = encuadrar
    vistaRef.current = (v) => {
      setVistaCamara(v)
      if (v === 'iso') encuadrar()
      else saltarVista(controles, v)
    }
    const grandes: THREE.Object3D[] = []
    escena.traverse((o) => {
      if (o.userData.insignia) grandes.push(o)
    })
    const nombres = new Set(grandes.map((o) => o.userData.insignia as string))
    const chicos: THREE.Mesh[] = []
    escena.traverse((o) => {
      if (o.userData.sello && nombres.has(o.userData.sello) && (o as THREE.Mesh).material) chicos.push(o as THREE.Mesh)
    })
    insigniasRef.current = { grandes, chicos }
    aplicarRotulos(conRotulosRef.current)

    // Pulsar los mandos de la máquina.
    const raycaster = new THREE.Raycaster()
    const puntero = new THREE.Vector2()
    let soltar: (() => void) | null = null
    const onDown = (e: PointerEvent) => {
      if (conSonidoRef.current) sonido().activar()
      const r = renderer.domElement.getBoundingClientRect()
      puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(puntero, camara)
      const tocado = raycaster.intersectObjects(planta.pulsables, true)[0]
      const dir = tocado?.object.userData.mando as string | undefined
      cont.dataset.pulsado = dir ?? ''
      if (!dir) return
      controles.enabled = false
      const actual = sim.current
      if (tocado.object.userData.tipoMando === 'interruptor') actual.pulsar(dir, !actual.mandos[dir])
      else {
        actual.pulsar(dir, true)
        soltar = () => sim.current.pulsar(dir, false)
      }
      sonidoRef.current?.golpe('rodillo', 0.7, 0)
    }
    const onUp = () => {
      soltar?.()
      soltar = null
      controles.enabled = true
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)

    const proyectada = new THREE.Vector3()
    const pan = (v: THREE.Vector3) => THREE.MathUtils.clamp(proyectada.copy(v).project(camara).x * 0.85, -1, 1)
    base.alCuadro((dt) => {
      // Al cambiar de planta, la simulación cambia antes de que se monte la
      // escena nueva: mientras tanto, esta escena no debe leer la otra planta.
      if (sim.current.planta.id !== idPlanta) return false
      planta.actualizar(sim.current, dt, conSonidoRef.current ? sonidoRef.current : null, pan)
    })
    cont.dataset.planta = sim.current.planta.id

    return () => {
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('wheel', alGirarRueda)
      window.removeEventListener('pointerup', onUp)
      controlesRef.current = null
      base.destruir(() => {
        escena.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.geometry) m.geometry.dispose()
        })
        entorno.dispose()
        pmrem.dispose()
      })
      sonidoRef.current?.callar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, notacion])

  useEffect(() => {
    const alCambiar = () => {
      setPantallaCompleta(document.fullscreenElement === contRef.current)
      requestAnimationFrame(() => requestAnimationFrame(() => encuadrarRef.current()))
    }
    document.addEventListener('fullscreenchange', alCambiar)
    return () => document.removeEventListener('fullscreenchange', alCambiar)
  }, [])

  return (
    <div
      ref={contRef}
      style={{
        position: 'relative',
        width: '100%',
        height: pantallaCompleta ? '100%' : alto,
        overflow: 'hidden',
        borderRadius: pantallaCompleta ? 0 : 10,
        border: '1px solid #d0d5db',
        background: '#dde2e7',
      }}
    >
      {sinWebGL && (
        <p style={{ padding: 24, color: 'var(--tinta)' }}>
          Tu navegador no tiene WebGL activado, así que no puede dibujar la planta en 3D. El panel de entradas y salidas
          funciona igual.
        </p>
      )}
      <div style={barra}>
        <button style={boton} onClick={() => { setVistaCamara('iso'); encuadrarRef.current() }} title="Volver a ver la planta entera" aria-label="Encuadrar">
          {celular ? '⌖' : 'Encuadrar'}
        </button>
        <button
          style={{ ...boton, background: conSonido ? 'var(--azul)' : '#fff', color: conSonido ? '#fff' : 'var(--tinta)' }}
          onClick={() => {
            if (!conSonido) sonido().activar()
            setConSonido((v) => !v)
          }}
          aria-pressed={conSonido}
          title="Relés, válvulas, agua, cilindros y zumbador"
          aria-label="Sonido"
        >
          {celular ? (conSonido ? '🔊' : '🔇') : conSonido ? '🔊 Sonido' : '🔇 Sonido'}
        </button>
        <button
          style={{ ...boton, background: conRotulos ? 'var(--azul)' : '#fff', color: conRotulos ? '#fff' : 'var(--tinta)' }}
          onClick={() => setConRotulos((v) => !v)}
          aria-pressed={conRotulos}
          title="Muestra u oculta los rótulos grandes de sensores y actuadores (S0, Y1, Z1…)"
          data-rotulos-3d="si"
          aria-label="Rótulos"
        >
          {celular ? 'S0' : 'Rótulos'}
        </button>
        {typeof document !== 'undefined' && document.fullscreenEnabled && (
          <button
            style={boton}
            aria-label={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
            onClick={() => {
              const c = contRef.current
              if (!c) return
              if (document.fullscreenElement === c) void document.exitFullscreen()
              else void c.requestFullscreen?.()
            }}
          >
            {celular ? (pantallaCompleta ? '⤡' : '⤢') : pantallaCompleta ? '⤡ Salir' : '⤢ Pantalla completa'}
          </button>
        )}
      </div>
      {pantallaCompleta && (
        <HudEscena
          play={play}
          vista={vistaCamara}
          onVista={(v) => vistaRef.current(v)}
          modo={modoArrastre}
          onModo={setModoArrastre}
          onZoom={(si) => controlesRef.current && zoomCamara(controlesRef.current, si)}
        />
      )}
      {acciones.length > 0 && (
        <div style={{ ...barra, left: 8, right: 'auto' }}>
          {acciones.map((a) => (
            <button key={a.id} style={boton} title={a.titulo} onClick={() => onAccion(a.id)}>
              {a.etiqueta}
            </button>
          ))}
        </div>
      )}
      <p style={pista}>Arrastra para girar · {acercar(tactil)} · {tactil ? 'toca' : 'pulsa'} los botones de la máquina</p>
    </div>
  )
}

const barra: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  zIndex: 2,
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
  padding: '4px 6px',
  background: 'rgba(255,255,255,0.9)',
  border: '1px solid #d0d5db',
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(28,39,51,0.15)',
}

const boton: React.CSSProperties = {
  border: '1px solid #c6ced6',
  background: '#fff',
  color: '#33475c',
  borderRadius: 6,
  padding: '3px 8px',
  cursor: 'pointer',
  fontSize: '0.78rem',
}

const pista: React.CSSProperties = {
  position: 'absolute',
  left: 10,
  bottom: 6,
  margin: 0,
  zIndex: 1,
  fontSize: '0.76rem',
  color: '#33475c',
  background: 'rgba(255,255,255,0.8)',
  padding: '2px 8px',
  borderRadius: 6,
  pointerEvents: 'none',
}
