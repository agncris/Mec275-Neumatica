/**
 * Modelos 3D de la galería de tipos de robot (Estudiar). Son funciones puras sobre three.js,
 * sin React ni WebGL, para poder comprobarlas con un test: que nada atraviese la mesa o el piso,
 * que cada pieza esté unida a la base y que los ejes prismáticos no se salgan de sus guías.
 * Unidades en mm, Y arriba, piso en y = 0.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export type Tipo = 'scara' | 'cilindrico' | 'esferico' | 'cartesiano' | 'angular' | 'delta'

export interface Junta {
  nombre: string
  clase: 'R' | 'P'
  min: number
  max: number
  valor: number
  unidad: string
  /** Tramo del rango que recorre «Mover solo»; por defecto, el 60 % central. Los deslizadores usan todo el rango. */
  anim?: [number, number]
}

export interface Info {
  nombre: string
  gdl: number
  juntas: Junta[]
  texto: string
  usos: string
}

export const INFO: Record<Tipo, Info> = {
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
      { nombre: 'A2', clase: 'R', min: -150, max: 20, valor: -70, unidad: '°', anim: [-115, -40] },
      { nombre: 'A3', clase: 'R', min: -30, max: 156, valor: 100, unidad: '°', anim: [20, 110] },
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

export const TIPOS: Tipo[] = ['scara', 'cilindrico', 'esferico', 'cartesiano', 'angular', 'delta']

const NAR = new THREE.MeshPhysicalMaterial({ color: 0xf15a12, metalness: 0.16, roughness: 0.32, clearcoat: 0.62, clearcoatRoughness: 0.28 })
const OSC = new THREE.MeshPhysicalMaterial({ color: 0x1c2127, metalness: 0.28, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.4 })
const MET = new THREE.MeshPhysicalMaterial({ color: 0xd5dbe2, metalness: 0.92, roughness: 0.22, clearcoat: 0.2 })
const MADERA = new THREE.MeshStandardMaterial({ color: 0x8d6a45, roughness: 0.72, metalness: 0.04 })

const box = (w: number, h: number, d: number, m: THREE.Material) => {
  const x = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(6, w / 3, h / 3, d / 3)), m)
  x.castShadow = true
  x.receiveShadow = true
  return x
}
const cyl = (r: number, h: number, m: THREE.Material, r2 = r) => {
  const x = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, 40), m)
  x.castShadow = true
  x.receiveShadow = true
  return x
}

/** Una pieza que se desliza por otra (eje prismático): debe seguir metida en su guía en todo el recorrido. */
export interface Guia {
  nombre: string
  corredera: THREE.Mesh
  guia: THREE.Mesh
  /** Eje local de la corredera por el que se desliza (0 = x, 1 = y, 2 = z). */
  eje: 0 | 1 | 2
  /** Largo mínimo (mm) que la corredera debe seguir metida en la guía a lo largo de ese eje. */
  solape: number
}

export interface Modelo {
  g: THREE.Group
  poner: (v: number[]) => void
  guias: Guia[]
}

/** Pone nombre a una malla (sirve para los mensajes del test) y la devuelve. */
const nom = <T extends THREE.Mesh>(m: T, nombre: string): T => {
  m.name = nombre
  return m
}

/** Arma el robot y devuelve una función que lo pone en la posición de sus juntas (Y arriba). */
export function armar(tipo: Tipo): Modelo {
  const g = new THREE.Group()
  const r = (x: number) => (x * Math.PI) / 180
  if (tipo === 'scara') {
    const base = nom(cyl(60, 40, OSC), 'base')
    base.position.y = 20
    const col = nom(cyl(40, 300, NAR), 'columna')
    col.position.y = 190
    g.add(base, col)
    const j1 = new THREE.Group()
    j1.position.y = 340
    g.add(j1)
    const b1 = nom(box(300, 50, 80, NAR), 'brazo 1')
    b1.position.x = 150
    j1.add(b1)
    const j2 = new THREE.Group()
    j2.position.x = 300
    j1.add(j2)
    const b2 = nom(box(250, 45, 70, NAR), 'brazo 2')
    b2.position.set(125, -45, 0)
    const cab = nom(cyl(45, 60, OSC), 'cabezal')
    cab.position.set(250, -45, 0)
    j2.add(b2, cab)
    const quill = new THREE.Group()
    quill.position.set(250, -45, 0)
    j2.add(quill)
    // El eje vertical sube por dentro del cabezal: con la carrera completa (150 mm) sigue metido 40 mm.
    const vara = nom(cyl(12, 290, MET), 'eje vertical')
    quill.add(vara)
    const pinza = nom(box(50, 20, 20, OSC), 'pinza')
    const giro = new THREE.Group()
    giro.add(pinza)
    quill.add(giro)
    return {
      g,
      guias: [{ nombre: 'eje vertical en el cabezal', corredera: vara, guia: cab, eje: 1, solape: 40 }],
      poner: (v) => {
        j1.rotation.y = r(v[0])
        j2.rotation.y = r(v[1])
        vara.position.y = 15 - v[2]
        giro.position.y = -130 - v[2]
        giro.rotation.y = r(v[3])
      },
    }
  }
  if (tipo === 'cilindrico') {
    const base = nom(cyl(90, 40, OSC), 'base')
    base.position.y = 20
    g.add(base)
    const j1 = new THREE.Group()
    j1.position.y = 40
    g.add(j1)
    const col = nom(cyl(35, 520, NAR), 'columna')
    col.position.y = 260
    j1.add(col)
    const carro = new THREE.Group()
    j1.add(carro)
    const bloque = nom(box(110, 80, 110, NAR), 'carro')
    carro.add(bloque)
    // El brazo no puede pasar por la columna: corre por un manguito que sale del carro.
    const manguito = nom(box(300, 56, 56, OSC), 'manguito')
    manguito.position.x = 205
    carro.add(manguito)
    const brazo = nom(box(320, 36, 36, MET), 'brazo')
    carro.add(brazo)
    const mano = nom(box(30, 60, 60, OSC), 'mano')
    carro.add(mano)
    return {
      g,
      guias: [
        { nombre: 'carro en la columna', corredera: bloque, guia: col, eje: 1, solape: 80 },
        { nombre: 'brazo en el manguito', corredera: brazo, guia: manguito, eje: 0, solape: 40 },
      ],
      poner: (v) => {
        j1.rotation.y = r(v[0])
        carro.position.y = 60 + v[1]
        brazo.position.x = 220 + v[2]
        mano.position.x = 380 + v[2] + 15
      },
    }
  }
  if (tipo === 'esferico') {
    const base = nom(cyl(90, 40, OSC), 'base')
    base.position.y = 20
    const torre = nom(box(120, 280, 120, NAR), 'torre')
    g.add(base)
    const j1 = new THREE.Group()
    j1.position.y = 40
    g.add(j1)
    j1.add(torre)
    torre.position.y = 140
    const j2 = new THREE.Group()
    j2.position.y = 300
    j1.add(j2)
    const eje = nom(cyl(40, 150, OSC), 'eje de elevación')
    eje.rotation.x = Math.PI / 2
    const funda = nom(box(300, 70, 70, NAR), 'funda')
    funda.position.x = 130
    j2.add(eje, funda)
    const vara = nom(box(340, 40, 40, MET), 'vara')
    j2.add(vara)
    const mano = nom(box(30, 60, 60, OSC), 'mano')
    j2.add(mano)
    return {
      g,
      guias: [{ nombre: 'vara en la funda', corredera: vara, guia: funda, eje: 0, solape: 40 }],
      poner: (v) => {
        j1.rotation.y = r(v[0])
        j2.rotation.z = r(v[1])
        vara.position.x = 160 + v[2]
        mano.position.x = 330 + v[2] + 15
      },
    }
  }
  if (tipo === 'cartesiano') {
    const L = 800
    const W = 560
    const YR = 520 // eje de los rieles
    for (const [x, z] of [
      [0, 0],
      [L, 0],
      [0, W],
      [L, W],
    ]) {
      const p = nom(box(40, YR, 40, OSC), 'columna')
      p.position.set(x - L / 2, YR / 2, z - W / 2)
      g.add(p)
    }
    const r1 = nom(box(L + 40, 40, 40, NAR), 'riel 1')
    r1.position.set(0, YR, -W / 2)
    const r2 = nom(r1.clone(), 'riel 2')
    r2.position.z = W / 2
    g.add(r1, r2)
    // La viga apoya sobre los rieles (arriba de ellos), no hundida.
    const YV = YR + 20 + 20
    const puente = new THREE.Group()
    g.add(puente)
    const viga = nom(box(60, 50, W + 40, NAR), 'viga')
    viga.position.y = YV
    puente.add(viga)
    const carro = new THREE.Group()
    puente.add(carro)
    const bloque = nom(box(90, 140, 90, OSC), 'carro Z')
    bloque.position.y = YV
    carro.add(bloque)
    // Eje Z: un mástil que baja por el carro. Con la carrera completa (250 mm) sigue metido 40 mm
    // y la mano queda 5 mm sobre la mesa.
    const vara = nom(box(34, 505, 34, MET), 'mástil Z')
    carro.add(vara)
    const mano = nom(box(60, 20, 60, OSC), 'mano')
    carro.add(mano)
    const mesa = nom(box(L - 60, 20, W - 60, MADERA), 'mesa')
    mesa.position.y = 10
    g.add(mesa)
    return {
      g,
      guias: [
        { nombre: 'viga sobre los rieles', corredera: viga, guia: r1, eje: 0, solape: 60 },
        { nombre: 'carro en la viga', corredera: bloque, guia: viga, eje: 2, solape: 90 },
        { nombre: 'mástil en el carro', corredera: vara, guia: bloque, eje: 1, solape: 40 },
      ],
      poner: (v) => {
        puente.position.x = -L / 2 + 100 + v[0]
        carro.position.z = -W / 2 + 80 + v[1]
        // La mano baja v[2] desde 275 mm de altura; el mástil sube hasta 805 - v[2].
        mano.position.y = 275 - v[2] + 10
        vara.position.y = 275 - v[2] + 20 + 505 / 2
      },
    }
  }
  if (tipo === 'angular') {
    // Cadena como la del KUKA (Y arriba).
    const base = nom(cyl(90, 40, OSC), 'base')
    base.position.y = 20
    g.add(base)
    const j1 = new THREE.Group()
    j1.position.y = 40
    g.add(j1)
    const torre = nom(cyl(70, 300, NAR), 'torre')
    torre.position.y = 150
    j1.add(torre)
    const j2 = new THREE.Group()
    j2.position.set(30, 350, 0)
    j1.add(j2)
    const b = nom(box(60, 60, 80, NAR), 'base del brazo')
    b.position.x = 0
    const brazo = nom(box(455, 70, 60, NAR), 'brazo')
    brazo.position.x = 227
    const hombro = nom(cyl(55, 130, NAR), 'hombro')
    hombro.rotation.x = Math.PI / 2
    j2.add(b, brazo, hombro)
    const j3 = new THREE.Group()
    j3.position.x = 455
    j2.add(j3)
    const codo = nom(cyl(48, 120, NAR), 'codo')
    codo.rotation.x = Math.PI / 2
    j3.add(codo)
    const j4 = new THREE.Group()
    j4.position.y = 35
    j3.add(j4)
    const ante = nom(cyl(38, 430, NAR, 30), 'antebrazo')
    ante.rotation.z = -Math.PI / 2
    ante.position.x = 215
    j4.add(ante)
    const j5 = new THREE.Group()
    j5.position.x = 420
    j4.add(j5)
    const mun = nom(cyl(30, 90, NAR), 'muñeca')
    mun.rotation.x = Math.PI / 2
    j5.add(mun)
    const j6 = new THREE.Group()
    j5.add(j6)
    const flange = nom(cyl(24, 80, MET), 'brida')
    flange.rotation.z = -Math.PI / 2
    flange.position.x = 50
    const pinza = nom(box(20, 50, 50, OSC), 'pinza')
    pinza.position.x = 95
    j6.add(flange, pinza)
    return {
      g,
      guias: [],
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
  const marco = nom(box(460, 30, 460, OSC), 'marco')
  marco.position.y = H + 15
  g.add(marco)
  // Cuatro columnas sobre la mesa sostienen el marco (antes colgaba en el aire).
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = nom(box(36, H + 15 - 20, 36, OSC), 'columna')
      p.position.set(sx * 210, 20 + (H + 15 - 20) / 2, sz * 210)
      g.add(p)
    }
  }
  const plataforma = nom(cyl(rp + 10, 20, MET), 'plataforma')
  g.add(plataforma)
  const brazos: Array<{ a: THREE.Mesh; b: THREE.Mesh; phi: number }> = []
  for (let i = 0; i < 3; i++) {
    const phi = (i * 2 * Math.PI) / 3
    const a = nom(box(L1, 24, 24, NAR), `brazo ${i + 1}`)
    const b = nom(box(L2, 12, 12, MET), `barra ${i + 1}`)
    g.add(a, b)
    const motor = nom(cyl(26, 50, OSC), `motor ${i + 1}`)
    // El eje del motor es tangente al círculo de la base: es el eje sobre el que gira el brazo.
    motor.rotation.z = Math.PI / 2
    motor.rotation.y = Math.PI / 2 - phi
    motor.position.set(R * Math.cos(phi), H, R * Math.sin(phi))
    g.add(motor)
    brazos.push({ a, b, phi })
  }
  const mesa = nom(box(500, 20, 500, MADERA), 'mesa')
  mesa.position.y = 10
  g.add(mesa)
  const colocarBarra = (m: THREE.Mesh, p: THREE.Vector3, q: THREE.Vector3) => {
    m.position.copy(p).add(q).multiplyScalar(0.5)
    m.lookAt(q)
    m.rotateY(Math.PI / 2)
  }
  return {
    g,
    guias: [],
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

/** Valores de las juntas en el segundo `t` del modo «Mover solo» (cada una oscila en su tramo `anim` o, si no lo tiene, en el 60 % central de su rango). */
export function juntasEnTiempo(tipo: Tipo, t: number): number[] {
  return INFO[tipo].juntas.map((j, k) => {
    const [a, b] = j.anim ?? [j.min + (j.max - j.min) * 0.2, j.max - (j.max - j.min) * 0.2]
    const mid = (a + b) / 2
    const amp = (b - a) / 2
    return mid + amp * Math.sin(t * (0.6 + 0.23 * k) + k)
  })
}
