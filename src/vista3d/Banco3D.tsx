/**
 * Banco 3D: el circuito montado en una placa perfilada de laboratorio, con
 * luz, sombras y materiales físicos, y movido por el mismo motor que la
 * pizarra. Es el experimento tal como se vería en el banco: los vástagos salen,
 * la leva pisa el rodillo, el manómetro sube, la brida gira.
 *
 * Las piezas se colocan en la placa siguiendo el plano ordenado, salvo los
 * finales de carrera, que van donde van de verdad: junto a su cilindro, a la
 * altura del punto de la carrera que vigilan, para que se vea a la leva
 * pisarlos.
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Motor } from '../engine'
import { useStore, type Pieza } from '../store'
import { DESCRIPTORES } from '../components/descriptores'
import { MAT, crearModelo, type EstadoPieza, type Modelo3D } from './modelos'

interface Props {
  motor: Motor | null
}

interface PiezaEnEscena {
  pieza: Pieza
  modelo: Modelo3D
}

interface MangueraEnEscena {
  material: THREE.MeshPhysicalMaterial
  componente: string
  puerto: string
}

/** Metros por píxel del plano al montar el banco (ver `alPlano`). */
const ESPACIADO_X = 0.001
const ESPACIADO_Y = 0.00042
/** Las piezas se montan algo mayores que su tamaño real para que se lean bien. */
const TAMANO = 1.3

const COLOR_TUBO = new THREE.Color(0x2a76d2)
const COLOR_TUBO_AIRE = new THREE.Color(0x49a6ff)

/** Placa perfilada de aluminio con sus ranuras en T, de pie sobre la mesa. */
function crearPlaca(ancho: number, alto: number, centro: THREE.Vector2): THREE.Group {
  const g = new THREE.Group()
  const placa = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, 0.018), MAT.aluminio)
  placa.position.set(centro.x, centro.y, -0.009)
  placa.receiveShadow = true
  g.add(placa)
  const nRanuras = Math.floor(alto / 0.025)
  const ranuras = new THREE.InstancedMesh(
    new THREE.BoxGeometry(ancho - 0.01, 0.0045, 0.002),
    new THREE.MeshStandardMaterial({ color: 0x4d545c, metalness: 0.7, roughness: 0.6 }),
    nRanuras,
  )
  const m = new THREE.Matrix4()
  for (let i = 0; i < nRanuras; i++) {
    m.makeTranslation(centro.x, centro.y - alto / 2 + 0.0125 + i * 0.025, 0.0002)
    ranuras.setMatrixAt(i, m)
  }
  ranuras.receiveShadow = true
  g.add(ranuras)
  // Marco y patas.
  const marco = new THREE.MeshStandardMaterial({ color: 0x9aa1a9, metalness: 0.85, roughness: 0.4 })
  for (const sx of [-1, 1]) {
    const lateral = new THREE.Mesh(new THREE.BoxGeometry(0.03, alto + 0.03, 0.03), marco)
    lateral.position.set(centro.x + sx * (ancho / 2 + 0.015), centro.y - 0.015, -0.009)
    lateral.castShadow = lateral.receiveShadow = true
    const pie = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.22), marco)
    pie.position.set(centro.x + sx * (ancho / 2 + 0.015), centro.y - alto / 2 - 0.04, 0.05)
    pie.castShadow = pie.receiveShadow = true
    g.add(lateral, pie)
  }
  // Mesa de laboratorio.
  const mesa = new THREE.Mesh(
    new THREE.BoxGeometry(ancho + 0.8, 0.04, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x5f6670, roughness: 0.82, metalness: 0.05 }),
  )
  mesa.position.set(centro.x, centro.y - alto / 2 - 0.07, 0.25)
  mesa.receiveShadow = true
  g.add(mesa)
  return g
}

/**
 * Tubo de poliuretano entre dos racores: sale recto de cada uno y cuelga un
 * poco por delante de la placa, como una manguera de verdad.
 */
function crearTubo(
  a: THREE.Vector3,
  dirA: THREE.Vector3,
  b: THREE.Vector3,
  dirB: THREE.Vector3,
  indice: number,
  material: THREE.Material,
): THREE.Mesh {
  const adelante = new THREE.Vector3(0, 0, 1)
  const largo = a.distanceTo(b)
  const p1 = a.clone().addScaledVector(dirA, 0.02).addScaledVector(adelante, 0.012)
  const p3 = b.clone().addScaledVector(dirB, 0.02).addScaledVector(adelante, 0.012)
  const medio = p1.clone().lerp(p3, 0.5)
  medio.z += 0.03 + (indice % 5) * 0.009
  medio.y -= Math.min(0.08, 0.02 + largo * 0.1)
  const curva = new THREE.CatmullRomCurve3([a, p1, medio, p3, b], false, 'centripetal')
  const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, 72, 0.0029, 10, false), material)
  tubo.castShadow = true
  return tubo
}

/** Fondo en degradado: pared clara arriba, más oscura hacia el suelo. */
function fondoDegradado(): THREE.Texture {
  const lienzo = document.createElement('canvas')
  lienzo.width = 4
  lienzo.height = 256
  const c = lienzo.getContext('2d')!
  const g = c.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, '#eef1f4')
  g.addColorStop(0.55, '#d3d8de')
  g.addColorStop(1, '#9aa1aa')
  c.fillStyle = g
  c.fillRect(0, 0, 4, 256)
  const t = new THREE.CanvasTexture(lienzo)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Estado de la simulación que necesita cada modelo. */
function estadoDe(motor: Motor | null, p: Pieza): { estado: EstadoPieza; presion: number } {
  if (!motor) return { estado: {}, presion: 0 }
  const estado = motor.estadoDe<EstadoPieza>(p.id) ?? {}
  let presion = 0
  if (p.tipo === 'fuente') presion = motor.presionEn(p.id, '1')
  if (p.tipo === 'manometro') {
    const puerto = DESCRIPTORES.manometro?.puertos[0]?.id
    if (puerto) presion = motor.presionEn(p.id, puerto)
  }
  return { estado, presion }
}

export default function Banco3D({ motor }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const motorRef = useRef<Motor | null>(motor)
  motorRef.current = motor
  const [resaltarAire, setResaltarAire] = useState(true)
  const resaltarRef = useRef(resaltarAire)
  resaltarRef.current = resaltarAire
  /** Pide un repintado cuando cambia algo que no es la cámara ni el motor. */
  const resaltarCambio = useRef({ actual: true }).current
  useEffect(() => {
    // Al cambiar el resaltado, o al entrar o salir de la simulación (para que
    // el banco vuelva a pintarse en reposo), hay que repintar.
    resaltarCambio.actual = true
  }, [resaltarAire, motor, resaltarCambio])
  const [sinWebGL, setSinWebGL] = useState(false)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const encuadrarRef = useRef<() => void>(() => {})
  const piezas = useStore((s) => s.piezas)
  const mangueras = useStore((s) => s.mangueras)

  useEffect(() => {
    const cont = contenedorRef.current
    if (!cont) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    } catch {
      setSinWebGL(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(cont.clientWidth, cont.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.display = 'block'
    renderer.domElement.dataset.banco3d = 'si'
    cont.appendChild(renderer.domElement)

    const escena = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    escena.environment = entorno
    escena.background = fondoDegradado()
    escena.fog = new THREE.Fog(0xcfd4da, 2.6, 6)

    // --- piezas ---------------------------------------------------------------
    const enEscena: PiezaEnEscena[] = []
    const porId = new Map<string, PiezaEnEscena>()
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of piezas) {
      const d = DESCRIPTORES[p.tipo]
      const cx = p.x + (d?.ancho ?? 100) / 2
      const cy = p.y + (d?.alto ?? 80) / 2
      minX = Math.min(minX, cx); maxX = Math.max(maxX, cx)
      minY = Math.min(minY, cy); maxY = Math.max(maxY, cy)
    }
    const centroPlano = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
    // En horizontal cada columna necesita sitio para el cilindro Y su carrera
    // (si no, el vástago extendido chocaría con el actuador de al lado); en
    // vertical el plano se compacta, que en un banco real las bandas del
    // esquema no hacen falta tan separadas.
    const alPlano = (x: number, y: number) =>
      new THREE.Vector3((x - centroPlano.x) * ESPACIADO_X, (centroPlano.y - y) * ESPACIADO_Y, 0)

    for (const p of piezas) {
      const modelo = crearModelo(p)
      const d = DESCRIPTORES[p.tipo]
      modelo.grupo.position.copy(alPlano(p.x + (d?.ancho ?? 100) / 2, p.y + (d?.alto ?? 80) / 2))
      modelo.grupo.scale.setScalar(TAMANO)
      modelo.grupo.traverse((o) => (o.userData.idPieza = p.id))
      escena.add(modelo.grupo)
      const item = { pieza: p, modelo }
      enEscena.push(item)
      porId.set(p.id, item)
    }

    // Los finales de carrera se montan donde trabajan: junto a su actuador.
    for (const item of enEscena) {
      const p = item.pieza
      if (p.tipo !== 'finalCarrera') continue
      const idAct = typeof p.params.cilindro === 'string' ? p.params.cilindro : ''
      const act = porId.get(idAct)
      if (!act) continue
      const punto = Number(p.params.puntoDisparo ?? 1)
      const base = act.modelo.grupo.position
      const lineal = act.modelo as Modelo3D & { puntaVastago?: (pos: number) => number }
      const giro = act.modelo as Modelo3D & { radioBrazo?: number }
      if (lineal.puntaVastago) {
        // Encima del vástago, justo donde llega la leva en ese punto de la carrera.
        item.modelo.grupo.position.set(
          base.x + (lineal.puntaVastago(punto) - 0.004) * TAMANO,
          base.y + 0.0755 * TAMANO,
          0,
        )
      } else if (giro.radioBrazo) {
        const angulo = THREE.MathUtils.degToRad(punto * Number(act.pieza.params.angulo ?? 180))
        const dir = new THREE.Vector2(-Math.cos(angulo), Math.sin(angulo))
        const r = (giro.radioBrazo + 0.047) * TAMANO
        item.modelo.grupo.position.set(base.x + dir.x * r, base.y + dir.y * r, 0)
        item.modelo.grupo.rotation.z = Math.atan2(-dir.x, dir.y) + Math.PI
      }
    }

    // --- placa, mesa y encuadre -------------------------------------------------
    const cajaTotal = new THREE.Box3()
    for (const item of enEscena) cajaTotal.expandByObject(item.modelo.grupo)
    if (cajaTotal.isEmpty()) cajaTotal.set(new THREE.Vector3(-0.2, -0.15, 0), new THREE.Vector3(0.2, 0.15, 0.05))
    const tam = cajaTotal.getSize(new THREE.Vector3())
    const centro = cajaTotal.getCenter(new THREE.Vector3())
    const anchoPlaca = Math.max(0.5, tam.x + 0.16)
    const altoPlaca = Math.max(0.35, tam.y + 0.16)
    escena.add(crearPlaca(anchoPlaca, altoPlaca, new THREE.Vector2(centro.x, centro.y)))

    // --- mangueras --------------------------------------------------------------
    const tubos: MangueraEnEscena[] = []
    mangueras.forEach((m, i) => {
      const pa = porId.get(m.a.componente)
      const pb = porId.get(m.b.componente)
      const ra = pa?.modelo.racores[m.a.puerto]
      const rb = pb?.modelo.racores[m.b.puerto]
      if (!pa || !pb || !ra || !rb) return
      pa.modelo.grupo.updateMatrixWorld(true)
      pb.modelo.grupo.updateMatrixWorld(true)
      const a = pa.modelo.grupo.localToWorld(ra.punto.clone())
      const b = pb.modelo.grupo.localToWorld(rb.punto.clone())
      const dirA = ra.dir.clone().applyQuaternion(pa.modelo.grupo.quaternion)
      const dirB = rb.dir.clone().applyQuaternion(pb.modelo.grupo.quaternion)
      const material = new THREE.MeshPhysicalMaterial({
        color: COLOR_TUBO.clone(),
        roughness: 0.28,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        emissive: new THREE.Color(0x000000),
      })
      escena.add(crearTubo(a, dirA, b, dirB, i, material))
      tubos.push({ material, componente: m.a.componente, puerto: m.a.puerto })
    })
    // La toma de aire del compresor: entra al FRL por detrás de la mesa.
    for (const item of enEscena) {
      if (item.pieza.tipo !== 'fuente') continue
      const g = item.modelo.grupo.position
      const entrada = new THREE.Vector3(g.x - 0.025, g.y + 0.01, 0.02)
      const curva = new THREE.CatmullRomCurve3([
        entrada,
        entrada.clone().add(new THREE.Vector3(-0.04, -0.01, 0.02)),
        new THREE.Vector3(g.x - 0.1, centro.y - altoPlaca / 2 - 0.02, 0.12),
        new THREE.Vector3(g.x - 0.18, centro.y - altoPlaca / 2 - 0.045, 0.35),
      ])
      const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, 48, 0.0045, 12), MAT.negro)
      tubo.castShadow = true
      escena.add(tubo)
    }

    // --- luz --------------------------------------------------------------------
    const sol = new THREE.DirectionalLight(0xfff4e6, 2.4)
    sol.position.set(centro.x - 0.6, centro.y + 1.1, 1.3)
    sol.target.position.copy(centro)
    sol.castShadow = true
    sol.shadow.mapSize.set(2048, 2048)
    const s = Math.max(anchoPlaca, altoPlaca) * 0.75
    Object.assign(sol.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.2, far: 4 })
    sol.shadow.bias = -0.0004
    sol.shadow.normalBias = 0.01
    escena.add(sol, sol.target)
    escena.add(new THREE.HemisphereLight(0xf2f6ff, 0x5d6168, 0.35))
    // Relleno suave desde la derecha: levanta las sombras sin aplanar el volumen.
    const relleno = new THREE.DirectionalLight(0xdfe8ff, 0.55)
    relleno.position.set(centro.x + 1.2, centro.y + 0.3, 0.9)
    escena.add(relleno)
    escena.environmentIntensity = 1.15

    // --- cámara -----------------------------------------------------------------
    const camara = new THREE.PerspectiveCamera(32, cont.clientWidth / Math.max(1, cont.clientHeight), 0.01, 20)
    const controles = new OrbitControls(camara, renderer.domElement)
    controles.enableDamping = true
    controles.dampingFactor = 0.08
    controles.minDistance = 0.15
    controles.maxDistance = 4
    controles.maxPolarAngle = Math.PI * 0.62
    controles.zoomToCursor = true
    const encuadrar = () => {
      const aspecto = cont.clientWidth / Math.max(1, cont.clientHeight)
      const vfov = THREE.MathUtils.degToRad(camara.fov)
      const distV = ((tam.y + 0.08) * 0.52) / Math.tan(vfov / 2)
      const distH = ((tam.x + 0.08) * 0.52) / Math.tan(vfov / 2) / aspecto
      const dist = Math.max(distV, distH, 0.35)
      camara.position.set(centro.x + dist * 0.16, centro.y + dist * 0.12, dist)
      controles.target.set(centro.x, centro.y - 0.01, 0.03)
      controles.update()
    }
    encuadrar()
    encuadrarRef.current = encuadrar

    // --- interacción: pulsar botones del banco ---------------------------------
    const raycaster = new THREE.Raycaster()
    const puntero = new THREE.Vector2()
    const pulsables = enEscena.flatMap((i) => i.modelo.pulsables)
    let soltar: (() => void) | null = null
    const onDown = (e: PointerEvent) => {
      const mot = motorRef.current
      if (!mot) return
      const r = renderer.domElement.getBoundingClientRect()
      puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(puntero, camara)
      const tocado = raycaster.intersectObjects(pulsables, true)[0]
      const id = tocado?.object.userData.idPieza as string | undefined
      // Lo último que se pulsó queda a la vista en el DOM (sirve a las pruebas).
      cont.dataset.pulsado = id ?? ''
      const item = id ? porId.get(id) : undefined
      if (!item) return
      const p = item.pieza
      controles.enabled = false
      const biestable = p.params.modo === 'biestable'
      if (p.tipo === 'fuente') {
        const params = mot.circuito.componentes.find((c) => c.id === p.id)?.params
        mot.setParametro(p.id, 'encendida', !((params?.encendida as boolean) ?? true))
      } else if (biestable) {
        const est = mot.estadoDe<{ accionada: boolean }>(p.id)
        mot.accionar(p.id, !est.accionada)
      } else {
        mot.accionar(p.id, true)
        soltar = () => mot.accionar(p.id, false)
      }
    }
    const onUp = () => {
      soltar?.()
      soltar = null
      controles.enabled = true
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)

    // --- tamaño -----------------------------------------------------------------
    const alRedimensionar = () => {
      sucio = true
      const w = cont.clientWidth
      const h = cont.clientHeight
      renderer.setSize(w, h)
      camara.aspect = w / Math.max(1, h)
      camara.updateProjectionMatrix()
    }
    const observador = new ResizeObserver(alRedimensionar)
    observador.observe(cont)

    // --- bucle ------------------------------------------------------------------
    // Sólo se repinta cuando algo cambia (simulación en marcha, cámara en
    // movimiento o una tecla del panel): así el banco no le roba CPU al motor
    // de la simulación ni gasta batería con la escena quieta.
    let vivo = true
    let sucio = true
    controles.addEventListener('change', () => (sucio = true))
    const bucle = () => {
      if (!vivo) return
      requestAnimationFrame(bucle)
      const mot = motorRef.current
      const seMueve = controles.update()
      if (!mot && !seMueve && !sucio && !resaltarCambio.actual) return
      resaltarCambio.actual = false
      for (const item of enEscena) {
        const { estado, presion } = estadoDe(mot, item.pieza)
        item.modelo.actualizar(estado, presion)
      }
      for (const t of tubos) {
        const conAire = !!mot && mot.presionEn(t.componente, t.puerto) > 0.1
        const ver = conAire && resaltarRef.current
        t.material.color.copy(ver ? COLOR_TUBO_AIRE : COLOR_TUBO)
        t.material.emissive.setHex(ver ? 0x0a4fb0 : 0x000000)
      }
      renderer.render(escena, camara)
      sucio = false
    }
    requestAnimationFrame(bucle)
    cont.dataset.piezas = String(enEscena.length)
    cont.dataset.mangueras = String(tubos.length)

    return () => {
      vivo = false
      observador.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      controles.dispose()
      escena.traverse((o) => {
        const malla = o as THREE.Mesh
        if (malla.geometry) malla.geometry.dispose()
      })
      for (const t of tubos) t.material.dispose()
      entorno.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [piezas, mangueras])

  useEffect(() => {
    const alCambiar = () => {
      setPantallaCompleta(document.fullscreenElement === contenedorRef.current)
      requestAnimationFrame(() => requestAnimationFrame(() => encuadrarRef.current()))
    }
    document.addEventListener('fullscreenchange', alCambiar)
    return () => document.removeEventListener('fullscreenchange', alCambiar)
  }, [])

  // Mandos manuales del circuito: a la distancia a la que se ve el banco
  // entero, el botón de una válvula es diminuto, así que se repiten aquí.
  const mandos = piezas.filter(
    (p) =>
      (p.tipo === 'valvula32' || p.tipo === 'valvula52' || p.tipo === 'valvula42') &&
      p.params.modo !== 'biestable' &&
      p.params.accionamiento !== 'pilotaje',
  )
  const pulsar = (id: string, si: boolean) => {
    try {
      motorRef.current?.accionar(id, si)
    } catch {
      /* sin mando manual */
    }
  }

  const alternarPantallaCompleta = () => {
    const cont = contenedorRef.current
    if (!cont) return
    if (document.fullscreenElement === cont) void document.exitFullscreen()
    else void cont.requestFullscreen?.()
  }

  return (
    <div
      ref={contenedorRef}
      style={{
        position: 'relative',
        width: '100%',
        height: pantallaCompleta ? '100%' : 520,
        overflow: 'hidden',
        borderRadius: pantallaCompleta ? 0 : 10,
        border: `6px solid ${motor ? '#12a35a' : '#b9bec5'}`,
        background: '#d9dde2',
      }}
    >
      {sinWebGL && (
        <p style={{ padding: 24, color: '#33475c' }}>
          Tu navegador no tiene WebGL activado, así que no puede dibujar el banco en 3D. Usa la vista Esquema o
          Taller.
        </p>
      )}
      <div style={barra}>
        <button
          style={boton}
          onClick={() => {
            encuadrarRef.current()
            resaltarCambio.actual = true
          }}
          title="Volver a ver el banco entero"
        >
          Encuadrar
        </button>
        <button
          style={{ ...boton, background: resaltarAire ? '#1668c7' : '#fff', color: resaltarAire ? '#fff' : '#33475c' }}
          onClick={() => setResaltarAire((v) => !v)}
          title="Tiñe de azul claro las mangueras que tienen aire"
        >
          {resaltarAire ? '✓ Ver el aire' : 'Ver el aire'}
        </button>
        {typeof document !== 'undefined' && document.fullscreenEnabled && (
          <button style={boton} onClick={alternarPantallaCompleta}>
            {pantallaCompleta ? '⤡ Salir' : '⤢ Pantalla completa'}
          </button>
        )}
      </div>
      {motor && mandos.length > 0 && (
        <div style={panelMandos}>
          <span style={{ fontSize: '0.72rem', color: '#5a6b7d' }}>Mandos</span>
          {mandos.map((p) => (
            <button
              key={p.id}
              style={botonMando}
              title={`Mantén pulsado para accionar ${p.id}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                pulsar(p.id, true)
              }}
              onPointerUp={() => pulsar(p.id, false)}
              onPointerCancel={() => pulsar(p.id, false)}
            >
              ● {p.id}
            </button>
          ))}
        </div>
      )}
      <p style={pista}>
        {motor
          ? 'Arrastra para girar el banco · rueda para acercarte · mantén pulsado un mando para accionarlo'
          : 'Pulsa ▶ Simular para poner el banco en marcha · arrastra para girarlo · rueda para acercarte'}
      </p>
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

const panelMandos: React.CSSProperties = {
  position: 'absolute',
  right: 8,
  bottom: 8,
  zIndex: 2,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  padding: '5px 8px',
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid #d0d5db',
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(28,39,51,0.15)',
}

const botonMando: React.CSSProperties = {
  border: '1px solid #0f7a3b',
  background: '#19a34e',
  color: '#fff',
  fontWeight: 700,
  borderRadius: 999,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  userSelect: 'none',
  touchAction: 'none',
}

const pista: React.CSSProperties = {
  position: 'absolute',
  left: 10,
  bottom: 6,
  margin: 0,
  zIndex: 2,
  fontSize: '0.78rem',
  color: '#33475c',
  background: 'rgba(255,255,255,0.8)',
  padding: '2px 8px',
  borderRadius: 6,
  pointerEvents: 'none',
}
