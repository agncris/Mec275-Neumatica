/**
 * Galería de robots de base fija en 3D: cada uno con sus articulaciones
 * (R = rotacional, P = prismática) que se mueven con deslizadores, para ver
 * sus grados de libertad y cómo se mueven.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

type Tipo = 'scara' | 'cilindrico' | 'esferico' | 'cartesiano' | 'angular' | 'delta'

interface Junta {
  nombre: string
  clase: 'R' | 'P'
  min: number
  max: number
  valor: number
  unidad: string
}

interface Info {
  nombre: string
  gdl: number
  juntas: Junta[]
  texto: string
  usos: string
}

const INFO: Record<Tipo, Info> = {
  scara: {
    nombre: 'SCARA',
    gdl: 4,
    juntas: [
      { nombre: 'J1 hombro', clase: 'R', min: -150, max: 150, valor: 30, unidad: '°' },
      { nombre: 'J2 codo', clase: 'R', min: -145, max: 145, valor: -60, unidad: '°' },
      { nombre: 'J3 vertical', clase: 'P', min: 0, max: 150, valor: 60, unidad: 'mm' },
      { nombre: 'J4 giro herramienta', clase: 'R', min: -360, max: 360, valor: 0, unidad: '°' },
    ],
    texto:
      'Selective Compliance Assembly Robot Arm: dos brazos que giran en un plano horizontal (como un «pulpo») y un eje vertical. Es rígido en vertical y flexible en horizontal: ideal para insertar piezas.',
    usos: 'Pick & place y ensamblaje a gran velocidad; embalaje; industria automotriz, alimentaria y farmacéutica.',
  },
  cilindrico: {
    nombre: 'Cilíndrico',
    gdl: 3,
    juntas: [
      { nombre: 'J1 giro de la base', clase: 'R', min: -180, max: 180, valor: 20, unidad: '°' },
      { nombre: 'J2 altura', clase: 'P', min: 0, max: 400, valor: 200, unidad: 'mm' },
      { nombre: 'J3 extensión radial', clase: 'P', min: 0, max: 250, valor: 120, unidad: 'mm' },
    ],
    texto: 'La primera articulación es rotacional y la segunda y tercera son prismáticas: su espacio de trabajo es un cilindro.',
    usos: 'Ensamblaje, manejo de máquinas-herramienta, soldadura por puntos y manejo, vaciado y moldeado de metales.',
  },
  esferico: {
    nombre: 'Esférico o polar',
    gdl: 3,
    juntas: [
      { nombre: 'J1 giro de la base', clase: 'R', min: -180, max: 180, valor: 30, unidad: '°' },
      { nombre: 'J2 elevación', clase: 'R', min: -30, max: 70, valor: 20, unidad: '°' },
      { nombre: 'J3 extensión', clase: 'P', min: 0, max: 250, valor: 120, unidad: 'mm' },
    ],
    texto: 'Las dos primeras articulaciones son rotacionales y la tercera prismática: su espacio de trabajo es parte de una esfera.',
    usos: 'Manejo de máquinas-herramienta, soldadura por puntos, vaciado de metales y fresado.',
  },
  cartesiano: {
    nombre: 'Cartesiano (pórtico)',
    gdl: 3,
    juntas: [
      { nombre: 'X', clase: 'P', min: 0, max: 600, valor: 250, unidad: 'mm' },
      { nombre: 'Y', clase: 'P', min: 0, max: 400, valor: 180, unidad: 'mm' },
      { nombre: 'Z', clase: 'P', min: 0, max: 250, valor: 80, unidad: 'mm' },
    ],
    texto: 'Se mueve en línea recta en los tres ejes X, Y, Z: movimientos precisos y repetitivos, y de fabricación simple.',
    usos: 'Carga y descarga de máquinas, paletizado, impresión 3D, fresado (routers CNC).',
  },
  angular: {
    nombre: 'Angular o antropomórfico',
    gdl: 6,
    juntas: [
      { nombre: 'A1', clase: 'R', min: -170, max: 170, valor: 20, unidad: '°' },
      { nombre: 'A2', clase: 'R', min: -150, max: 20, valor: -70, unidad: '°' },
      { nombre: 'A3', clase: 'R', min: -30, max: 156, valor: 100, unidad: '°' },
      { nombre: 'A4', clase: 'R', min: -185, max: 185, valor: 0, unidad: '°' },
      { nombre: 'A5', clase: 'R', min: -120, max: 120, valor: 50, unidad: '°' },
      { nombre: 'A6', clase: 'R', min: -350, max: 350, valor: 0, unidad: '°' },
    ],
    texto:
      'Todas sus articulaciones son rotacionales, como un brazo humano (hombro, codo, muñeca). Con 6 grados de libertad (3 de posición + 3 de orientación) puede llevar la herramienta a cualquier punto de su alcance en cualquier orientación.',
    usos: 'Ensamblaje, vaciado de metales, fresado, soldaduras complejas, pintura con spray, laminado de fibra de carbono.',
  },
  delta: {
    nombre: 'Paralelo (delta)',
    gdl: 3,
    juntas: [
      { nombre: 'X plataforma', clase: 'P', min: -120, max: 120, valor: 40, unidad: 'mm' },
      { nombre: 'Y plataforma', clase: 'P', min: -120, max: 120, valor: -20, unidad: 'mm' },
      { nombre: 'Z plataforma', clase: 'P', min: -420, max: -250, valor: -330, unidad: 'mm' },
    ],
    texto:
      'Tres brazos unidos a la misma plataforma trabajan en paralelo: los motores van fijos en la base y la parte móvil es muy liviana, así que es rapidísimo. Los deslizadores mueven la plataforma y se calcula el ángulo de cada brazo (cinemática inversa).',
    usos: 'Pick & place de alta velocidad: alimentos, envases, electrónica.',
  },
}

const TIPOS: Tipo[] = ['scara', 'cilindrico', 'esferico', 'cartesiano', 'angular', 'delta']

const NAR = new THREE.MeshStandardMaterial({ color: 0xf06a14, metalness: 0.25, roughness: 0.45 })
const OSC = new THREE.MeshStandardMaterial({ color: 0x2b3036, metalness: 0.3, roughness: 0.55 })
const MET = new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.8, roughness: 0.3 })

const box = (w: number, h: number, d: number, m: THREE.Material) => {
  const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  x.castShadow = true
  return x
}
const cyl = (r: number, h: number, m: THREE.Material, r2 = r) => {
  const x = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, 32), m)
  x.castShadow = true
  return x
}

/** Arma el robot y devuelve una función que lo pone en la posición de sus juntas (Y arriba). */
function armar(tipo: Tipo): { g: THREE.Group; poner: (v: number[]) => void } {
  const g = new THREE.Group()
  const r = (x: number) => (x * Math.PI) / 180
  if (tipo === 'scara') {
    const base = cyl(60, 40, OSC)
    base.position.y = 20
    const col = cyl(40, 300, NAR)
    col.position.y = 190
    g.add(base, col)
    const j1 = new THREE.Group()
    j1.position.y = 340
    g.add(j1)
    const b1 = box(300, 50, 80, NAR)
    b1.position.x = 150
    j1.add(b1)
    const j2 = new THREE.Group()
    j2.position.x = 300
    j1.add(j2)
    const b2 = box(250, 45, 70, NAR)
    b2.position.set(125, -45, 0)
    const cab = cyl(45, 60, OSC)
    cab.position.set(250, -45, 0)
    j2.add(b2, cab)
    const quill = new THREE.Group()
    quill.position.set(250, -45, 0)
    j2.add(quill)
    const vara = cyl(12, 260, MET)
    quill.add(vara)
    const pinza = box(50, 20, 20, OSC)
    const giro = new THREE.Group()
    giro.add(pinza)
    quill.add(giro)
    return {
      g,
      poner: (v) => {
        j1.rotation.y = r(v[0])
        j2.rotation.y = r(v[1])
        vara.position.y = -v[2]
        giro.position.y = -130 - v[2]
        giro.rotation.y = r(v[3])
      },
    }
  }
  if (tipo === 'cilindrico') {
    const base = cyl(90, 40, OSC)
    base.position.y = 20
    g.add(base)
    const j1 = new THREE.Group()
    j1.position.y = 40
    g.add(j1)
    const col = cyl(35, 520, NAR)
    col.position.y = 260
    j1.add(col)
    const carro = new THREE.Group()
    j1.add(carro)
    const bloque = box(110, 80, 110, NAR)
    carro.add(bloque)
    const brazo = box(300, 36, 36, MET)
    carro.add(brazo)
    const mano = box(30, 60, 60, OSC)
    carro.add(mano)
    return {
      g,
      poner: (v) => {
        j1.rotation.y = r(v[0])
        carro.position.y = 60 + v[1]
        brazo.position.x = 60 + v[2]
        mano.position.x = 60 + v[2] + 160
      },
    }
  }
  if (tipo === 'esferico') {
    const base = cyl(90, 40, OSC)
    base.position.y = 20
    const torre = box(120, 260, 120, NAR)
    g.add(base)
    const j1 = new THREE.Group()
    j1.position.y = 40
    g.add(j1)
    j1.add(torre)
    torre.position.y = 130
    const j2 = new THREE.Group()
    j2.position.y = 300
    j1.add(j2)
    const eje = cyl(40, 150, OSC)
    eje.rotation.x = Math.PI / 2
    const funda = box(260, 70, 70, NAR)
    funda.position.x = 110
    j2.add(eje, funda)
    const vara = box(300, 40, 40, MET)
    j2.add(vara)
    const mano = box(30, 60, 60, OSC)
    j2.add(mano)
    return {
      g,
      poner: (v) => {
        j1.rotation.y = r(v[0])
        j2.rotation.z = r(v[1])
        vara.position.x = 150 + v[2]
        mano.position.x = 300 + v[2] + 10
      },
    }
  }
  if (tipo === 'cartesiano') {
    const L = 800
    const W = 560
    for (const [x, z] of [
      [0, 0],
      [L, 0],
      [0, W],
      [L, W],
    ]) {
      const p = box(40, 520, 40, OSC)
      p.position.set(x - L / 2, 260, z - W / 2)
      g.add(p)
    }
    const r1 = box(L + 40, 40, 40, NAR)
    r1.position.set(0, 520, -W / 2)
    const r2 = r1.clone()
    r2.position.z = W / 2
    g.add(r1, r2)
    const puente = new THREE.Group()
    g.add(puente)
    const viga = box(60, 50, W + 40, NAR)
    viga.position.y = 545
    puente.add(viga)
    const carro = new THREE.Group()
    puente.add(carro)
    const bloque = box(90, 90, 90, OSC)
    bloque.position.y = 545
    carro.add(bloque)
    const vara = box(34, 360, 34, MET)
    carro.add(vara)
    const mano = box(60, 20, 60, OSC)
    carro.add(mano)
    const mesa = box(L - 60, 20, W - 60, new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 }))
    mesa.position.y = 10
    g.add(mesa)
    return {
      g,
      poner: (v) => {
        puente.position.x = -L / 2 + 100 + v[0]
        carro.position.z = -W / 2 + 80 + v[1]
        vara.position.y = 545 - 180 - v[2]
        mano.position.y = 545 - 360 - v[2]
      },
    }
  }
  if (tipo === 'angular') {
    // Cadena como la del KUKA (Y arriba).
    const base = cyl(90, 40, OSC)
    base.position.y = 20
    g.add(base)
    const j1 = new THREE.Group()
    j1.position.y = 40
    g.add(j1)
    const torre = cyl(70, 300, NAR)
    torre.position.y = 150
    j1.add(torre)
    const j2 = new THREE.Group()
    j2.position.set(30, 360, 0)
    j1.add(j2)
    const b = box(60, 60, 80, NAR)
    b.position.x = 0
    const brazo = box(455, 70, 60, NAR)
    brazo.position.x = 227
    const hombro = cyl(55, 130, NAR)
    hombro.rotation.x = Math.PI / 2
    j2.add(b, brazo, hombro)
    const j3 = new THREE.Group()
    j3.position.x = 455
    j2.add(j3)
    const codo = cyl(48, 120, NAR)
    codo.rotation.x = Math.PI / 2
    j3.add(codo)
    const j4 = new THREE.Group()
    j4.position.y = 35
    j3.add(j4)
    const ante = cyl(38, 380, NAR, 30)
    ante.rotation.z = -Math.PI / 2
    ante.position.x = 190
    j4.add(ante)
    const j5 = new THREE.Group()
    j5.position.x = 420
    j4.add(j5)
    const mun = cyl(30, 90, NAR)
    mun.rotation.x = Math.PI / 2
    j5.add(mun)
    const j6 = new THREE.Group()
    j5.add(j6)
    const flange = cyl(24, 80, MET)
    flange.rotation.z = -Math.PI / 2
    flange.position.x = 50
    const pinza = box(20, 50, 50, OSC)
    pinza.position.x = 100
    j6.add(flange, pinza)
    return {
      g,
      poner: (v) => {
        j1.rotation.y = r(v[0])
        j2.rotation.z = -r(v[1])
        j3.rotation.z = -r(v[2])
        j4.rotation.x = r(v[3])
        j5.rotation.z = -r(v[4])
        j6.rotation.x = r(v[5])
      },
    }
  }
  // Delta
  const R = 150
  const rp = 45
  const L1 = 160
  const L2 = 360
  const H = 520
  const marco = box(460, 30, 460, OSC)
  marco.position.y = H + 15
  g.add(marco)
  const plataforma = cyl(rp + 10, 20, MET)
  g.add(plataforma)
  const brazos: Array<{ a: THREE.Mesh; b: THREE.Mesh; phi: number }> = []
  for (let i = 0; i < 3; i++) {
    const phi = (i * 2 * Math.PI) / 3
    const a = box(L1, 24, 24, NAR)
    const b = box(L2, 12, 12, MET)
    g.add(a, b)
    const motor = cyl(26, 50, OSC)
    motor.rotation.z = Math.PI / 2
    motor.rotation.y = -phi
    motor.position.set(R * Math.cos(phi), H, R * Math.sin(phi))
    g.add(motor)
    brazos.push({ a, b, phi })
  }
  const mesa = box(500, 20, 500, new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 }))
  mesa.position.y = 10
  g.add(mesa)
  const colocarBarra = (m: THREE.Mesh, p: THREE.Vector3, q: THREE.Vector3) => {
    m.position.copy(p).add(q).multiplyScalar(0.5)
    m.lookAt(q)
    m.rotateY(Math.PI / 2)
  }
  return {
    g,
    poner: (v) => {
      // Plataforma en (x, y, z) con z hacia abajo desde los motores.
      const P = new THREE.Vector3(v[0], H + v[2], v[1])
      plataforma.position.copy(P)
      for (const br of brazos) {
        // Coordenadas locales del brazo: x radial, y vertical, z tangencial.
        const c = Math.cos(br.phi)
        const s = Math.sin(br.phi)
        const x = P.x * c + P.z * s + rp - R
        const t = -P.x * s + P.z * c
        const y = P.y - H
        const A = -2 * L1 * x
        const B = 2 * L1 * y
        const K = L2 * L2 - L1 * L1 - x * x - t * t - y * y
        const M = Math.hypot(A, B)
        let th = 0
        if (M > 1e-6 && Math.abs(K / M) <= 1) {
          // Dos soluciones: se elige la del codo hacia fuera.
          const t1 = Math.atan2(B, A) + Math.acos(K / M)
          const t2 = Math.atan2(B, A) - Math.acos(K / M)
          th = Math.cos(t1) > Math.cos(t2) ? t1 : t2
        }
        const hombro = new THREE.Vector3(R * c, H, R * s)
        const codoL = new THREE.Vector3(R + L1 * Math.cos(th), H - L1 * Math.sin(th), 0)
        const codo = new THREE.Vector3(codoL.x * c, codoL.y, codoL.x * s)
        const union = new THREE.Vector3(P.x + rp * c, P.y, P.z + rp * s)
        colocarBarra(br.a, hombro, codo)
        colocarBarra(br.b, codo, union)
      }
    },
  }
}

export default function TiposRobot() {
  const [tipo, setTipo] = useState<Tipo>('scara')
  const [valores, setValores] = useState<Record<Tipo, number[]>>(
    () => Object.fromEntries(TIPOS.map((t) => [t, INFO[t].juntas.map((j) => j.valor)])) as Record<Tipo, number[]>,
  )
  const [animar, setAnimar] = useState(true)
  const contRef = useRef<HTMLDivElement>(null)
  const estado = useRef({ tipo, valores, animar })
  estado.current = { tipo, valores, animar }
  const info = INFO[tipo]

  useEffect(() => {
    const cont = contRef.current
    if (!cont) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(cont.clientWidth, cont.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    cont.appendChild(renderer.domElement)
    renderer.domElement.dataset.tiposRobot = 'si'
    const escena = new THREE.Scene()
    const pm = new THREE.PMREMGenerator(renderer)
    escena.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
    escena.background = new THREE.Color(0xe7ebef)
    const piso = new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.MeshStandardMaterial({ color: 0xcfd4da, roughness: 0.95 }))
    piso.rotation.x = -Math.PI / 2
    piso.receiveShadow = true
    escena.add(piso)
    const sol = new THREE.DirectionalLight(0xffffff, 2)
    sol.position.set(-600, 1400, 900)
    sol.castShadow = true
    Object.assign(sol.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 10, far: 4000 })
    escena.add(sol, new THREE.HemisphereLight(0xffffff, 0x666666, 0.5))
    const cam = new THREE.PerspectiveCamera(38, cont.clientWidth / cont.clientHeight, 10, 10000)
    cam.position.set(1100, 900, 1300)
    const ctrl = new OrbitControls(cam, renderer.domElement)
    ctrl.target.set(0, 280, 0)
    ctrl.enableDamping = true
    ctrl.update()
    let actual: { tipo: Tipo; g: THREE.Group; poner: (v: number[]) => void } | null = null
    let vivo = true
    let t = 0
    const obs = new ResizeObserver(() => {
      renderer.setSize(cont.clientWidth, cont.clientHeight)
      cam.aspect = cont.clientWidth / Math.max(1, cont.clientHeight)
      cam.updateProjectionMatrix()
    })
    obs.observe(cont)
    const bucle = () => {
      if (!vivo) return
      requestAnimationFrame(bucle)
      const e = estado.current
      if (!actual || actual.tipo !== e.tipo) {
        if (actual) escena.remove(actual.g)
        const a = armar(e.tipo)
        escena.add(a.g)
        actual = { tipo: e.tipo, ...a }
      }
      t += 1 / 60
      const js = INFO[e.tipo].juntas
      const v = e.animar
        ? js.map((j, k) => {
            const mid = (j.min + j.max) / 2
            const amp = (j.max - j.min) * 0.3
            return mid + amp * Math.sin(t * (0.6 + 0.23 * k) + k)
          })
        : e.valores[e.tipo]
      actual.poner(v)
      ctrl.update()
      renderer.render(escena, cam)
    }
    requestAnimationFrame(bucle)
    return () => {
      vivo = false
      obs.disconnect()
      ctrl.dispose()
      renderer.dispose()
      pm.dispose()
      cont.removeChild(renderer.domElement)
    }
  }, [])

  const chips = useMemo(
    () =>
      TIPOS.map((t) => (
        <button
          key={t}
          onClick={() => setTipo(t)}
          aria-pressed={tipo === t}
          style={{
            border: `2px solid ${tipo === t ? '#33475c' : '#c6ced6'}`,
            background: tipo === t ? '#33475c' : '#fff',
            color: tipo === t ? '#fff' : '#33475c',
            borderRadius: 999,
            padding: '0.25rem 0.8rem',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          {INFO[t].nombre}
        </button>
      )),
    [tipo],
  )

  return (
    <div data-tipos-robot="si">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{chips}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14, alignItems: 'start' }}>
        <div ref={contRef} style={{ width: '100%', height: 360, borderRadius: 8, overflow: 'hidden' }} />
        <div>
          <h3 style={{ margin: '0 0 4px', color: '#33475c' }}>
            {info.nombre} · {info.gdl} grados de libertad
          </h3>
          <p style={{ margin: '0 0 6px', lineHeight: 1.5 }}>{info.texto}</p>
          <p style={{ margin: '0 0 8px', lineHeight: 1.5 }}>
            <strong>Usos:</strong> {info.usos}
          </p>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.86rem', marginBottom: 6 }}>
            <input type="checkbox" checked={animar} onChange={(e) => setAnimar(e.target.checked)} /> Mover solo (desmárcalo para mover cada articulación)
          </label>
          {info.juntas.map((j, k) => (
            <label key={j.nombre} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 70px', gap: 6, alignItems: 'center', fontSize: '0.85rem', opacity: animar ? 0.5 : 1 }}>
              <span>
                <span
                  title={j.clase === 'R' ? 'Rotacional: gira' : 'Prismática: se desliza'}
                  style={{ display: 'inline-block', width: 18, textAlign: 'center', borderRadius: 4, background: j.clase === 'R' ? '#1668c7' : '#0e7a43', color: '#fff', fontWeight: 700, marginRight: 5 }}
                >
                  {j.clase}
                </span>
                {j.nombre}
              </span>
              <input
                type="range"
                min={j.min}
                max={j.max}
                value={valores[tipo][k]}
                disabled={animar}
                onChange={(e) => setValores((v) => ({ ...v, [tipo]: v[tipo].map((x, i) => (i === k ? Number(e.target.value) : x)) }))}
              />
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {valores[tipo][k]} {j.unidad}
              </span>
            </label>
          ))}
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#5a6b7d' }}>
            <span style={{ background: '#1668c7', color: '#fff', borderRadius: 4, padding: '0 4px', fontWeight: 700 }}>R</span> rotacional (gira) ·{' '}
            <span style={{ background: '#0e7a43', color: '#fff', borderRadius: 4, padding: '0 4px', fontWeight: 700 }}>P</span> prismática (se desliza)
            {tipo === 'delta' ? ' · en el delta los deslizadores mueven la plataforma; los brazos se calculan solos.' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
