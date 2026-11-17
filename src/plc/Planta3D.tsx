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
import { MAT, caja, cilindro } from '../vista3d/modelos'
import { SonidoBanco } from '../vista3d/sonido'
import { ponerNotacionEscena, type SimPLC } from './plantas3d/comun'
import { type Notacion } from './notacion'
import {
  PLANTAS,
  type PlantaPorton,
  type PlantaSemaforo,
} from './plantas'
import { escenaTablero } from './plantas3d/tablero'
import { escenaEstanque } from './plantas3d/estanque'
import { escenaElevador } from './plantas3d/elevador'
import { placa, led, piloto, crearPLC, type Escena, montarMandos, clicsDeRele, ZERO } from './plantas3d/comun'
import { escenaSilo } from './plantas3d/silo'
import { CARTON } from './plantas3d/comun'

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

const CLAVE_SONIDO = 'neumalab.plc.sonido'

function escenaSemaforo(): Escena {
  const raiz = new THREE.Group()
  const pulsables: THREE.Object3D[] = []
  const plc = crearPLC()
  plc.grupo.position.set(-0.55, 0.16, 0)
  raiz.add(plc.grupo)
  // Maqueta del cruce sobre una base.
  const c = new THREE.Vector3(0.2, 0.02, 0.42)
  const R = 0.4
  const base = caja(0.9, 0.02, 0.86, new THREE.MeshStandardMaterial({ color: 0x6d8f5a, roughness: 0.95 }), 0.004)
  base.position.set(c.x, 0.01, c.z)
  raiz.add(base)
  const asfalto = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.9 })
  const calleNS = caja(0.15, 0.004, 0.86, asfalto, 0.001)
  calleNS.position.set(c.x, 0.022, c.z)
  const calleEO = caja(0.9, 0.004, 0.15, asfalto, 0.001)
  calleEO.position.set(c.x, 0.0225, c.z)
  raiz.add(calleNS, calleEO)
  // Líneas de detención.
  const blanco = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 })
  const pareNS = caja(0.075, 0.001, 0.008, blanco, 0.0003)
  pareNS.position.set(c.x - 0.037, 0.0248, c.z - 0.22 * R - 0.005)
  const pareEO = caja(0.008, 0.001, 0.075, blanco, 0.0003)
  pareEO.position.set(c.x - 0.22 * R - 0.005, 0.0248, c.z + 0.037)
  raiz.add(pareNS, pareEO)
  // Semáforos: uno por calle, en la esquina de su línea de detención.
  const semaforo = (pos: THREE.Vector3, rotY: number, dirs: [string, string, string], nombre: string) => {
    const poste = cilindro(0.005, 0.16, MAT.grafito, 12)
    poste.position.copy(pos).add(new THREE.Vector3(0, 0.08, 0))
    const cabeza = caja(0.035, 0.09, 0.03, MAT.negro, 0.004)
    cabeza.position.copy(pos).add(new THREE.Vector3(0, 0.19, 0))
    cabeza.rotation.y = rotY
    raiz.add(poste, cabeza)
    const colores = [0xff2d20, 0xffb300, 0x22d65a]
    const luces = dirs.map((d, i) => {
      const l = piloto(colores[i])
      l.grupo.scale.setScalar(0.9)
      const off = new THREE.Vector3(0, 0.025 - i * 0.025, 0.016).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
      l.grupo.position.copy(cabeza.position).add(off)
      l.grupo.rotation.y = rotY
      raiz.add(l.grupo)
      return { d, l }
    })
    const r = placa(nombre, '', 0.05)
    r.position.copy(pos).add(new THREE.Vector3(0, 0.25, 0))
    r.rotation.y = rotY
    raiz.add(r)
    return luces
  }
  const lucesNS = semaforo(new THREE.Vector3(c.x - 0.1, 0.022, c.z - 0.13), 0, ['Q0.0', 'Q0.1', 'Q0.2'], 'NORTE-SUR')
  const lucesEO = semaforo(new THREE.Vector3(c.x - 0.13, 0.022, c.z + 0.1), Math.PI / 2, ['Q0.3', 'Q0.4', 'Q0.5'], 'ESTE-OESTE')
  // Botonera.
  const botonera = caja(0.18, 0.06, 0.04, new THREE.MeshStandardMaterial({ color: 0xe9e6de, roughness: 0.5 }), 0.004)
  botonera.position.set(-0.25, 0.05, 0.02)
  raiz.add(botonera)
  const ponerMandos = montarMandos(raiz, pulsables, PLANTAS.semaforo.mandos, new THREE.Vector3(-0.305, 0.058, 0.041), 0.055)

  const coloresAuto = [0xd23b3b, 0x2f6fd0, 0xf2f2f2, 0x2f9e5a, 0xf0b400, 0x6b4bb8]
  const autos = new Map<number, THREE.Group>()
  const crearAuto = (id: number) => {
    const g = new THREE.Group()
    const mat = new THREE.MeshPhysicalMaterial({ color: coloresAuto[id % coloresAuto.length], roughness: 0.3, clearcoat: 1 })
    const carro = caja(0.05, 0.016, 0.028, mat, 0.004)
    carro.position.y = 0.014
    const techo = caja(0.026, 0.012, 0.024, mat, 0.004)
    techo.position.set(-0.003, 0.027, 0)
    const vidrios = caja(0.027, 0.008, 0.025, new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.1 }), 0.003)
    vidrios.position.set(-0.003, 0.026, 0)
    g.add(carro, vidrios, techo)
    for (const [x, z] of [[0.016, 0.014], [-0.016, 0.014], [0.016, -0.014], [-0.016, -0.014]]) {
      const rueda = cilindro(0.006, 0.005, MAT.negro, 12)
      rueda.rotation.x = Math.PI / 2
      rueda.position.set(x, 0.006, z)
      g.add(rueda)
    }
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true))
    return g
  }
  let q = { ...ZERO }
  return {
    raiz,
    pulsables,
    vistaAlta: true,
    actualizar: (sim, _dt, sonido, pan) => {
      const bits = sim.estado.bits
      plc.actualizar(bits, sim.corriendo)
      ponerMandos(sim.mandos)
      for (const { d, l } of [...lucesNS, ...lucesEO]) l.poner(!!bits[d])
      const p = sim.planta as PlantaSemaforo
      const vivos = new Set<number>()
      for (const a of p.autos) {
        vivos.add(a.id)
        let g = autos.get(a.id)
        if (!g) {
          g = crearAuto(a.id)
          autos.set(a.id, g)
          raiz.add(g)
        }
        if (a.eje === 'NS') {
          g.position.set(c.x - 0.037, 0.024, c.z + a.s * R)
          g.rotation.y = -Math.PI / 2
        } else {
          g.position.set(c.x + a.s * R, 0.024, c.z + 0.037)
          g.rotation.y = 0
        }
        g.visible = Math.abs(a.s) <= 1.02
      }
      for (const [id, g] of autos) {
        if (vivos.has(id)) continue
        raiz.remove(g)
        autos.delete(id)
      }
      q = clicsDeRele(q, bits, sonido, pan(plc.grupo.position))
    },
  }
}

function escenaPorton(): Escena {
  const raiz = new THREE.Group()
  const pulsables: THREE.Object3D[] = []
  const plc = crearPLC()
  plc.grupo.position.set(-0.7, 0.2, 0)
  raiz.add(plc.grupo)
  const ANCHO = 0.42
  const ALTO = 0.3
  const xc = 0.05
  const hormigon = new THREE.MeshStandardMaterial({ color: 0xcfc8bd, roughness: 0.9 })
  for (const sx of [-1, 1]) {
    const pilar = caja(0.06, ALTO + 0.08, 0.08, hormigon, 0.004)
    pilar.position.set(xc + sx * (ANCHO / 2 + 0.03), (ALTO + 0.08) / 2, 0.06)
    raiz.add(pilar)
  }
  const dintel = caja(ANCHO + 0.12, 0.08, 0.08, hormigon, 0.004)
  dintel.position.set(xc, ALTO + 0.04, 0.06)
  const piso = caja(ANCHO + 0.3, 0.01, 0.3, new THREE.MeshStandardMaterial({ color: 0x8f8f8f, roughness: 0.95 }), 0.002)
  piso.position.set(xc, -0.005, 0.15)
  raiz.add(dintel, piso)
  // Portón seccional. Al subir entra al techo del garaje: lo que pasa por
  // encima del dintel no se dibuja (plano de recorte).
  const recorte = [new THREE.Plane(new THREE.Vector3(0, -1, 0), ALTO + 0.075)]
  const chapa = new THREE.MeshStandardMaterial({ color: 0xe7ebef, metalness: 0.4, roughness: 0.45, clippingPlanes: recorte, clipShadows: true })
  const matJunta = new THREE.MeshStandardMaterial({ color: 0x8d949c, metalness: 0.8, roughness: 0.45, clippingPlanes: recorte, clipShadows: true })
  const matTirador = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.3, roughness: 0.5, clippingPlanes: recorte, clipShadows: true })
  const porton = new THREE.Group()
  const hoja = caja(ANCHO, ALTO, 0.012, chapa, 0.002)
  hoja.position.y = ALTO / 2
  porton.add(hoja)
  for (let i = 1; i < 5; i++) {
    const junta = caja(ANCHO - 0.004, 0.003, 0.002, matJunta, 0.0005)
    junta.position.set(0, (i * ALTO) / 5, 0.007)
    porton.add(junta)
  }
  const tirador = caja(0.06, 0.008, 0.01, matTirador, 0.002)
  tirador.position.set(0, 0.03, 0.011)
  porton.add(tirador)
  // Va por dentro, detrás de los pilares y el dintel: al subir se esconde tras él.
  porton.position.set(xc, 0, 0.012)
  raiz.add(porton)
  // Motor en el dintel.
  const motor = caja(0.1, 0.05, 0.06, new THREE.MeshStandardMaterial({ color: 0x1f3fa8, metalness: 0.3, roughness: 0.4 }), 0.006)
  motor.position.set(xc, ALTO + 0.11, 0.08)
  raiz.add(motor)
  const rMotor = placa('MOTOR', 'Q0.0 sube · Q0.1 baja', 0.1, true)
  rMotor.position.set(xc, ALTO + 0.155, 0.1105)
  raiz.add(rMotor)
  // Finales de carrera arriba y abajo.
  const fc = (y: number, nombre: string, dir: string) => {
    const cuerpo = caja(0.025, 0.02, 0.02, MAT.aluminio, 0.002)
    cuerpo.position.set(xc + ANCHO / 2 - 0.015, y, 0.13)
    const l = led(0x2ee06d, 0.0026)
    l.malla.position.set(xc + ANCHO / 2 - 0.015, y, 0.141)
    const r = placa(nombre, dir, 0.05, true)
    r.position.set(xc + ANCHO / 2 + 0.03, y, 0.1005)
    raiz.add(cuerpo, l.malla, r)
    return l
  }
  const ledArriba = fc(ALTO - 0.02, 'FC_ABIERTO', 'I0.3')
  const ledAbajo = fc(0.02, 'FC_CERRADO', 'I0.4')
  // Fotocelda.
  const postes = [-1, 1].map((sx) => {
    const p = caja(0.014, 0.05, 0.014, MAT.grafito, 0.002)
    p.position.set(xc + sx * (ANCHO / 2 - 0.02), 0.025, 0.2)
    raiz.add(p)
    return p
  })
  void postes
  const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.001, ANCHO - 0.04, 8), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.7 }))
  haz.rotation.z = Math.PI / 2
  haz.position.set(xc, 0.04, 0.2)
  const ledFoto = led(0x2ee06d, 0.0026)
  ledFoto.malla.position.set(xc - ANCHO / 2 + 0.02, 0.055, 0.2)
  const rFoto = placa('FOTOCELDA', 'I0.5', 0.06, true)
  rFoto.position.set(xc - ANCHO / 2 - 0.02, 0.03, 0.21)
  raiz.add(haz, ledFoto.malla, rFoto)
  // Obstáculo.
  const obstaculo = caja(0.08, 0.1, 0.08, CARTON, 0.003)
  obstaculo.position.set(xc, 0.05, 0.13)
  raiz.add(obstaculo)
  // Botonera con pilotos.
  const botonera = caja(0.14, 0.12, 0.04, new THREE.MeshStandardMaterial({ color: 0xe9e6de, roughness: 0.5 }), 0.004)
  botonera.position.set(-0.36, 0.2, 0.02)
  raiz.add(botonera)
  const ponerMandos = montarMandos(raiz, pulsables, PLANTAS.porton.mandos, new THREE.Vector3(-0.405, 0.18, 0.041), 0.045)
  const pilotos = [
    { d: 'Q0.2', color: 0x22d65a, n: 'ABIERTO' },
    { d: 'Q0.3', color: 0xff2d20, n: 'CERRADO' },
    { d: 'Q0.4', color: 0xffb300, n: 'MOVIENDO' },
  ].map((x, i) => {
    const pl = piloto(x.color)
    pl.grupo.scale.setScalar(0.8)
    pl.grupo.position.set(-0.405 + i * 0.045, 0.24, 0.041)
    raiz.add(pl.grupo)
    const r = placa(x.n, x.d, 0.04)
    r.position.set(-0.405 + i * 0.045, 0.218, 0.0405)
    raiz.add(r)
    return { ...x, pl }
  })
  let q = { ...ZERO }
  let extremo: number | null = null
  return {
    raiz,
    pulsables,
    actualizar: (sim, _dt, sonido, pan) => {
      const bits = sim.estado.bits
      plc.actualizar(bits, sim.corriendo)
      ponerMandos(sim.mandos)
      const p = sim.planta as PlantaPorton
      porton.position.y = p.apertura * (ALTO - 0.02)
      // Al subir, la hoja se esconde tras el dintel.
      hoja.scale.y = 1
      obstaculo.visible = p.obstaculo
      const sens = p.sensores()
      ledArriba.poner(!!sens['I0.3'])
      ledAbajo.poner(!!sens['I0.4'])
      ledFoto.poner(!!sens['I0.5'])
      haz.material.opacity = p.obstaculo ? 0.2 : 0.7
      for (const x of pilotos) x.pl.poner(!!bits[x.d])
      const moviendo = (p.sube || p.baja) && !(p.sube && p.baja)
      sonido?.motor(moviendo ? 0.15 : 0)
      const ahora = sens['I0.3'] ? 1 : sens['I0.4'] ? -1 : 0
      if (extremo === 0 && ahora !== 0) sonido?.golpe('tope', 0.6, pan(porton.position))
      extremo = ahora
      q = clicsDeRele(q, bits, sonido, pan(plc.grupo.position))
    },
  }
}

function crearEscena(id: string): Escena {
  if (id === 'estanque') return escenaEstanque()
  if (id === 'elevador') return escenaElevador()
  if (id === 'silo') return escenaSilo()
  if (id === 'semaforo') return escenaSemaforo()
  if (id === 'porton') return escenaPorton()
  return escenaTablero()
}

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
    try {
      return localStorage.getItem(CLAVE_SONIDO) !== 'no'
    } catch {
      return true
    }
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
    try {
      return localStorage.getItem('neumalab.plc.rotulos3d') !== 'no'
    } catch {
      return true
    }
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
    try {
      localStorage.setItem('neumalab.plc.rotulos3d', conRotulos ? 'si' : 'no')
    } catch {
      /* sin almacenamiento */
    }
  }, [conRotulos])

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_SONIDO, conSonido ? 'si' : 'no')
    } catch {
      /* sin almacenamiento */
    }
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.localClippingEnabled = true
    renderer.domElement.style.display = 'block'
    renderer.domElement.dataset.planta3d = 'si'

    const pmrem = new THREE.PMREMGenerator(renderer)
    const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    escena.environment = entorno
    escena.environmentIntensity = 1.2
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
      new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.9 }),
    )
    pared.position.set(centro.x, centro.y, -0.005)
    pared.receiveShadow = true
    const mesa = new THREE.Mesh(
      new THREE.BoxGeometry(tam.x + 1.0, 0.04, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x5f6670, roughness: 0.82 }),
    )
    mesa.position.set(centro.x, caja3.min.y - 0.02, 0.33)
    mesa.receiveShadow = true
    escena.add(pared, mesa)

    const sol = new THREE.DirectionalLight(0xfff4e6, 2.2)
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
        <p style={{ padding: 24, color: '#33475c' }}>
          Tu navegador no tiene WebGL activado, así que no puede dibujar la planta en 3D. El panel de entradas y salidas
          funciona igual.
        </p>
      )}
      <div style={barra}>
        <button style={boton} onClick={() => { setVistaCamara('iso'); encuadrarRef.current() }} title="Volver a ver la planta entera" aria-label="Encuadrar">
          {celular ? '⌖' : 'Encuadrar'}
        </button>
        <button
          style={{ ...boton, background: conSonido ? '#1668c7' : '#fff', color: conSonido ? '#fff' : '#33475c' }}
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
          style={{ ...boton, background: conRotulos ? '#1668c7' : '#fff', color: conRotulos ? '#fff' : '#33475c' }}
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
