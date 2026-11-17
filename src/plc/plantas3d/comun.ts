import * as THREE from 'three'
import { MAT, caja, cilindro } from '../../vista3d/modelos'
import { SonidoBanco } from '../../vista3d/sonido'
import { ENTRADAS, SALIDAS, type EstadoPLC } from '../ladder'
import { formatear, type Notacion } from '../notacion'
import { type Planta } from '../plantas'

export interface SimPLC {
  planta: Planta
  estado: EstadoPLC
  mandos: Record<string, boolean>
  corriendo: boolean
  pulsar: (dir: string, valor: boolean) => void
}


/** Notación con la que se rotulan las placas de la escena que se está montando. */
let notacionEscena: Notacion = 'siemens'
/** La escena que se monta rotula sus placas con esta notación. */
export function ponerNotacionEscena(n: Notacion) {
  notacionEscena = n
}
/** Rotula una dirección (o texto con direcciones) en la notación elegida. */
export const rotular = (t: string) => t.replace(/\b([IQ]0\.[0-7]|M[01]\.[0-7])\b/g, (d) => formatear(d, notacionEscena))

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------
export function lienzo(ancho: number, alto: number, dibujar: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const px = 512
  const w = px
  const h = Math.max(16, Math.round((px * alto) / ancho))
  const plano = new THREE.PlaneGeometry(ancho, alto)
  if (typeof document === 'undefined') return new THREE.Mesh(plano, MAT.esfera)
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  dibujar(cv.getContext('2d')!, w, h)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return new THREE.Mesh(plano, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, transparent: true }))
}

/** Placa de rótulo blanca con una o dos líneas. */
/** Con `grande`, además lleva una etiqueta que siempre se lee (sensores y actuadores). */
export function placa(linea1: string, linea2 = '', ancho = 0.05, grande = false) {
  linea2 = rotular(linea2)
  const alto = linea2 ? ancho * 0.42 : ancho * 0.3
  const m = lienzo(ancho, alto, (c, w, h) => {
    c.fillStyle = '#f7f7f2'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = '#9aa3ad'
    c.lineWidth = 8
    c.strokeRect(4, 4, w - 8, h - 8)
    c.fillStyle = '#15191e'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    const ajustar = (t: string, tam: number, y: number, peso = 'bold') => {
      let s = tam
      do {
        c.font = `${peso} ${s}px system-ui, sans-serif`
        s -= 4
      } while (c.measureText(t).width > w - 30 && s > 12)
      c.fillText(t, w / 2, y)
    }
    if (linea2) {
      ajustar(linea1, h * 0.42, h * 0.36)
      c.fillStyle = '#4b5a6a'
      ajustar(linea2, h * 0.28, h * 0.74, '600')
    } else ajustar(linea1, h * 0.6, h * 0.54)
  })
  // Sensores y actuadores (S0, Y1, V2, MOTOR…) llevan además una etiqueta grande que
  // siempre se lee. Los pulsadores y pilotos no: ya están juntos en su panel.
  if (grande) {
    m.add(insignia(linea1, linea2))
    m.userData.sello = linea1
  }
  return m
}

/**
 * Etiqueta que mira siempre a la cámara, del mismo tamaño en pantalla esté
 * cerca o lejos, y que se ve aunque quede detrás de una pieza: el nombre
 * grande (S0, Y1, Z1…) y la dirección debajo. Azul para entradas, naranja para
 * salidas, gris para actuadores sin dirección.
 */
export function insignia(nombre: string, dir = ''): THREE.Object3D {
  const tipo = dir.startsWith('I') ? 'entrada' : dir.startsWith('Q') || dir.startsWith('O:') ? 'salida' : 'actuador'
  const fondo = { entrada: '#1668c7', salida: '#b35a00', actuador: '#33475c' }[tipo]
  const W = 256
  const H = dir ? 150 : 110
  if (typeof document === 'undefined') return new THREE.Group()
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')!
  const r = 26
  c.fillStyle = fondo
  c.beginPath()
  c.roundRect(6, 6, W - 12, H - 12, r)
  c.fill()
  c.lineWidth = 6
  c.strokeStyle = '#ffffff'
  c.stroke()
  c.fillStyle = '#ffffff'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  let s = 78
  do {
    c.font = `800 ${s}px system-ui, sans-serif`
    s -= 4
  } while (c.measureText(nombre).width > W - 40 && s > 20)
  c.fillText(nombre, W / 2, dir ? 62 : H / 2 + 2)
  if (dir) {
    let t = 36
    do {
      c.font = `600 ${t}px ui-monospace, monospace`
      t -= 2
    } while (c.measureText(dir).width > W - 36 && t > 14)
    c.fillText(dir, W / 2, 116)
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true }))
  // Sin atenuación y con la cámara de 32°, 1 unidad ≈ 1,75 veces el alto de la
  // vista: 0,04 son unos 30 px en una vista de 450 px.
  const alto = dir ? 0.04 : 0.032
  sprite.scale.set((alto * W) / H, alto, 1)
  sprite.renderOrder = 10
  sprite.userData.insignia = nombre
  sprite.name = `insignia-${nombre}`
  return sprite
}

export interface Led {
  malla: THREE.Mesh
  poner: (on: boolean) => void
}

export function led(color: number, radio = 0.0028): Led {
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, emissive: color, emissiveIntensity: 0, roughness: 0.3 })
  const malla = new THREE.Mesh(new THREE.SphereGeometry(radio, 16, 10), mat)
  const base = new THREE.Color(color)
  let estado: boolean | null = null
  return {
    malla,
    poner: (on) => {
      if (on === estado) return
      estado = on
      mat.emissiveIntensity = on ? 2.4 : 0
      mat.color.copy(on ? base : new THREE.Color(0x2a2f36))
    },
  }
}

/** Piloto luminoso de tablero: cúpula de color que se enciende. */
export function piloto(color: number) {
  const g = new THREE.Group()
  const aro = cilindro(0.013, 0.006, MAT.cromo, 28)
  aro.rotation.x = Math.PI / 2
  const mat = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0, roughness: 0.25, clearcoat: 1, transparent: true, opacity: 0.92 })
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(0.011, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat)
  cupula.rotation.x = Math.PI / 2
  cupula.position.z = 0.003
  g.add(aro, cupula)
  const luz = new THREE.PointLight(color, 0, 0.12)
  luz.position.z = 0.02
  g.add(luz)
  const base = new THREE.Color(color)
  const apagado = base.clone().multiplyScalar(0.35)
  mat.color.copy(apagado)
  let on: boolean | null = null
  return {
    grupo: g,
    poner: (v: boolean) => {
      if (v === on) return
      on = v
      mat.emissiveIntensity = v ? 1.8 : 0
      mat.color.copy(v ? base : apagado)
      luz.intensity = v ? 0.06 : 0
    },
  }
}

/** Pulsador de tablero: cabeza de color que se hunde al pulsarlo. */
export function pulsadorTablero(color: THREE.Material) {
  const g = new THREE.Group()
  const aro = cilindro(0.014, 0.006, MAT.cromo, 28)
  aro.rotation.x = Math.PI / 2
  const cabeza = cilindro(0.011, 0.01, color, 28)
  cabeza.rotation.x = Math.PI / 2
  cabeza.position.z = 0.007
  g.add(aro, cabeza)
  return {
    grupo: g,
    cabeza,
    poner: (pulsado: boolean) => {
      cabeza.position.z = pulsado ? 0.003 : 0.007
    },
  }
}

/** Selector de dos posiciones: la maneta gira 90°. */
export function selector() {
  const g = new THREE.Group()
  const base = cilindro(0.014, 0.006, MAT.negro, 28)
  base.rotation.x = Math.PI / 2
  const maneta = caja(0.022, 0.006, 0.01, MAT.negro, 0.002)
  maneta.position.z = 0.008
  const raya = caja(0.009, 0.0015, 0.001, MAT.esfera, 0.0004)
  raya.position.set(0.005, 0, 0.0135)
  const mango = new THREE.Group()
  mango.add(maneta, raya)
  g.add(base, mango)
  return {
    grupo: g,
    poner: (on: boolean) => {
      mango.rotation.z = on ? -Math.PI / 4 : Math.PI / 4
    },
  }
}

/**
 * El PLC montado en su riel DIN: fuente, CPU (con memoria y puerto de
 * comunicación) y los módulos de entradas y salidas con un LED por borne.
 */
export function crearPLC() {
  const g = new THREE.Group()
  const riel = caja(0.3, 0.035, 0.008, MAT.aluminio, 0.001)
  riel.position.set(0.12, 0, 0.004)
  g.add(riel)
  const alto = 0.11
  const fondo = 0.07
  const gris = new THREE.MeshStandardMaterial({ color: 0xd7dade, roughness: 0.55, metalness: 0.05 })
  const oscuro = new THREE.MeshStandardMaterial({ color: 0x3b4149, roughness: 0.5, metalness: 0.1 })
  const leds: Record<string, Led> = {}
  let x = 0
  const modulo = (ancho: number, mat: THREE.Material, titulo: string, sub: string) => {
    const m = caja(ancho - 0.002, alto, fondo, mat, 0.004)
    m.position.set(x + ancho / 2, 0, fondo / 2 + 0.008)
    g.add(m)
    const r = placa(titulo, sub, ancho * 0.84)
    r.position.set(x + ancho / 2, alto / 2 - 0.016, fondo + 0.0085)
    g.add(r)
    // Bornes arriba y abajo.
    for (const s of [-1, 1]) {
      const borne = caja(ancho - 0.008, 0.012, 0.014, MAT.grafito, 0.002)
      borne.position.set(x + ancho / 2, s * (alto / 2 + 0.004), fondo * 0.6)
      g.add(borne)
      for (let i = 0; i < Math.floor((ancho - 0.01) / 0.007); i++) {
        const tornillo = cilindro(0.0018, 0.002, MAT.cromo, 10)
        tornillo.rotation.x = Math.PI / 2
        tornillo.position.set(x + 0.008 + i * 0.007, s * (alto / 2 + 0.004), fondo * 0.6 + 0.008)
        g.add(tornillo)
      }
    }
    const x0 = x
    x += ancho
    return x0
  }
  // Fuente de poder.
  const xf = modulo(0.05, gris, 'FUENTE', '24 V DC')
  const ledFuente = led(0x2ee06d)
  ledFuente.malla.position.set(xf + 0.025, 0.012, fondo + 0.009)
  ledFuente.poner(true)
  g.add(ledFuente.malla)
  // CPU con memoria y comunicación.
  const xc = modulo(0.075, oscuro, 'CPU', 'memoria · comunicación')
  const ledRun = led(0x2ee06d)
  ledRun.malla.position.set(xc + 0.015, 0.018, fondo + 0.009)
  const ledStop = led(0xffa726)
  ledStop.malla.position.set(xc + 0.015, 0.006, fondo + 0.009)
  g.add(ledRun.malla, ledStop.malla)
  const rotRun = lienzo(0.03, 0.022, (c, _w, h) => {
    c.fillStyle = '#ffffff'
    c.font = `bold ${h * 0.38}px system-ui`
    c.textBaseline = 'middle'
    c.fillText('RUN', 10, h * 0.27)
    c.fillText('STOP', 10, h * 0.8)
  })
  rotRun.position.set(xc + 0.034, 0.012, fondo + 0.0085)
  g.add(rotRun)
  const puerto = caja(0.014, 0.012, 0.004, MAT.negro, 0.001)
  puerto.position.set(xc + 0.055, -0.025, fondo + 0.009)
  const tarjeta = caja(0.02, 0.004, 0.003, MAT.azul, 0.0008)
  tarjeta.position.set(xc + 0.022, -0.03, fondo + 0.009)
  g.add(puerto, tarjeta)
  const rotCom = lienzo(0.06, 0.01, (c, w, h) => {
    c.fillStyle = '#d7dade'
    c.font = `600 ${h * 0.7}px system-ui`
    c.textBaseline = 'middle'
    c.fillText('MEM', 8, h / 2)
    c.fillText('COM', w * 0.62, h / 2)
  })
  rotCom.position.set(xc + 0.037, -0.041, fondo + 0.0085)
  g.add(rotCom)
  // Entradas y salidas.
  const columnaLeds = (x0: number, dirs: string[], color: number) => {
    dirs.forEach((d, i) => {
      const l = led(color, 0.0024)
      l.malla.position.set(x0 + 0.012, 0.022 - i * 0.0088, fondo + 0.009)
      g.add(l.malla)
      leds[d] = l
    })
    const rot = lienzo(0.03, 0.075, (c, _w, h) => {
      c.fillStyle = '#15191e'
      c.font = `bold ${h * 0.085}px ui-monospace, monospace`
      c.textBaseline = 'middle'
      dirs.forEach((d, i) => c.fillText(rotular(d), 6, ((i + 0.5) / 8) * h))
    })
    rot.position.set(x0 + 0.034, 0.022 - 3.5 * 0.0088, fondo + 0.0085)
    g.add(rot)
  }
  const xi = modulo(0.055, gris, 'ENTRADAS', notacionEscena === 'ab' ? 'I:1 · 00…07' : 'I0.0 … I0.7')
  columnaLeds(xi, ENTRADAS, 0x2ee06d)
  const xs = modulo(0.055, gris, 'SALIDAS', notacionEscena === 'ab' ? 'O:2 · 00…07 · relé' : 'Q0.0 … Q0.7 · relé')
  columnaLeds(xs, SALIDAS, 0xffa726)
  // Canaleta con cables hacia la máquina.
  const canaleta = caja(x + 0.02, 0.03, 0.04, MAT.grafito, 0.002)
  canaleta.position.set(x / 2, -alto / 2 - 0.05, 0.02)
  g.add(canaleta)
  const colores = [0x1d5ea8, 0xc62828, 0x1d5ea8, 0xd4a017]
  for (let i = 0; i < 12; i++) {
    const xx = 0.01 + i * ((x - 0.02) / 11)
    const mat = new THREE.MeshStandardMaterial({ color: colores[i % colores.length], roughness: 0.5 })
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.035, 6), mat)
    cable.position.set(xx, -alto / 2 - 0.024, fondo * 0.55)
    g.add(cable)
  }
  return {
    grupo: g,
    ancho: x,
    actualizar: (bits: Record<string, boolean>, corriendo: boolean) => {
      for (const [d, l] of Object.entries(leds)) l.poner(!!bits[d])
      ledRun.poner(corriendo)
      ledStop.poner(!corriendo)
    },
  }
}


// ---------------------------------------------------------------------------
// Escenas de cada planta
// ---------------------------------------------------------------------------
export interface Escena {
  raiz: THREE.Group
  pulsables: THREE.Object3D[]
  /** Pone la escena al día; `dt` en segundos. Devuelve la posición del sonido, si hubo. */
  actualizar: (sim: SimPLC, dt: number, sonido: SonidoBanco | null, pan: (v: THREE.Vector3) => number) => void
  /** La maqueta está en horizontal (un cruce): la cámara la mira desde arriba. */
  vistaAlta?: boolean
}

/** Pulsadores y selectores con su placa, según la descripción de la planta. */
export function montarMandos(
  raiz: THREE.Group,
  pulsables: THREE.Object3D[],
  mandos: Array<{ dir: string; nombre: string; tipo: 'pulsador' | 'interruptor'; color: string }>,
  origen: THREE.Vector3,
  paso: number,
) {
  const materiales: Record<string, THREE.Material> = {
    verde: MAT.verde,
    rojo: MAT.rojo,
    negro: new THREE.MeshPhysicalMaterial({ color: 0x1e2226, roughness: 0.35, clearcoat: 0.6 }),
    amarillo: new THREE.MeshPhysicalMaterial({ color: 0xf2c200, roughness: 0.3, clearcoat: 0.7 }),
  }
  const estados: Array<(m: Record<string, boolean>) => void> = []
  mandos.forEach((m, i) => {
    const pos = origen.clone().add(new THREE.Vector3(i * paso, 0, 0))
    const obj = m.tipo === 'pulsador' ? pulsadorTablero(materiales[m.color]) : selector()
    obj.grupo.position.copy(pos)
    obj.grupo.traverse((o) => {
      o.userData.mando = m.dir
      o.userData.tipoMando = m.tipo
    })
    raiz.add(obj.grupo)
    pulsables.push(obj.grupo)
    const rotulo = placa(m.nombre, m.dir, 0.036)
    rotulo.position.copy(pos).add(new THREE.Vector3(0, -0.026, 0.0005))
    raiz.add(rotulo)
    estados.push((mm) => obj.poner(!!mm[m.dir]))
  })
  return (mm: Record<string, boolean>) => estados.forEach((f) => f(mm))
}


export const ZERO: Record<string, boolean> = {}

/** El clic del relé de salida del PLC cada vez que una salida cambia. */
export function clicsDeRele(antes: Record<string, boolean>, bits: Record<string, boolean>, sonido: SonidoBanco | null, pan: number) {
  const ahora: Record<string, boolean> = {}
  let cambios = 0
  for (const d of SALIDAS) {
    ahora[d] = !!bits[d]
    if (antes[d] !== undefined && antes[d] !== ahora[d]) cambios++
  }
  if (cambios) sonido?.golpe('rodillo', Math.min(1, 0.5 + cambios * 0.15), pan)
  return ahora
}

/** El cartón de las cajas del silo y del obstáculo del portón. */
export const CARTON = new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 0.85 })
