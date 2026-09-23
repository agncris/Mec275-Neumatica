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
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MAT, caja, cilindro, modeloCilindro, modeloValvula } from '../vista3d/modelos'
import { SonidoBanco } from '../vista3d/sonido'
import type { EstadoPLC } from './ladder'
import { ENTRADAS, SALIDAS } from './ladder'
import { NIVEL_S1, NIVEL_S2, PLANTAS, type Planta, type PlantaElevador, type PlantaEstanque, type PlantaTablero } from './plantas'

export interface SimPLC {
  planta: Planta
  estado: EstadoPLC
  mandos: Record<string, boolean>
  corriendo: boolean
  pulsar: (dir: string, valor: boolean) => void
}

interface Props {
  sim: MutableRefObject<SimPLC>
  /** Cambia cuando se cambia de planta: hay que montar otra escena. */
  version: number
  acciones: Array<{ id: string; etiqueta: string; titulo: string }>
  onAccion: (id: string) => void
}

const CLAVE_SONIDO = 'neumalab.plc.sonido'

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------
function lienzo(ancho: number, alto: number, dibujar: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
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
function placa(linea1: string, linea2 = '', ancho = 0.05) {
  const alto = linea2 ? ancho * 0.42 : ancho * 0.3
  return lienzo(ancho, alto, (c, w, h) => {
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
}

interface Led {
  malla: THREE.Mesh
  poner: (on: boolean) => void
}

function led(color: number, radio = 0.0028): Led {
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
function piloto(color: number) {
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
function pulsadorTablero(color: THREE.Material) {
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
function selector() {
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
function crearPLC() {
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
      dirs.forEach((d, i) => c.fillText(d, 6, ((i + 0.5) / 8) * h))
    })
    rot.position.set(x0 + 0.034, 0.022 - 3.5 * 0.0088, fondo + 0.0085)
    g.add(rot)
  }
  const xi = modulo(0.055, gris, 'ENTRADAS', 'I0.0 … I0.7')
  columnaLeds(xi, ENTRADAS, 0x2ee06d)
  const xs = modulo(0.055, gris, 'SALIDAS', 'Q0.0 … Q0.7 · relé')
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
interface Escena {
  raiz: THREE.Group
  pulsables: THREE.Object3D[]
  /** Pone la escena al día; `dt` en segundos. Devuelve la posición del sonido, si hubo. */
  actualizar: (sim: SimPLC, dt: number, sonido: SonidoBanco | null, pan: (v: THREE.Vector3) => number) => void
}

/** Pulsadores y selectores con su placa, según la descripción de la planta. */
function montarMandos(
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

function escenaTablero(): Escena {
  const raiz = new THREE.Group()
  const pulsables: THREE.Object3D[] = []
  const plc = crearPLC()
  plc.grupo.position.set(-0.36, 0.1, 0)
  raiz.add(plc.grupo)
  // Caja de mando de acero pintado.
  const cuerpo = caja(0.34, 0.27, 0.07, new THREE.MeshStandardMaterial({ color: 0xe9e6de, roughness: 0.5, metalness: 0.2 }), 0.006)
  cuerpo.position.set(0.12, 0.1, 0.035)
  raiz.add(cuerpo)
  const titulo = placa('TABLERO DE PRUEBAS', 'cableado al PLC', 0.16)
  titulo.position.set(0.12, 0.213, 0.0705)
  raiz.add(titulo)
  const fila1 = TABLERO_MANDOS.slice(0, 4)
  const fila2 = TABLERO_MANDOS.slice(4)
  const ponerMandos1 = montarMandos(raiz, pulsables, fila1, new THREE.Vector3(0.012, 0.15, 0.071), 0.072)
  const ponerMandos2 = montarMandos(raiz, pulsables, fila2, new THREE.Vector3(0.012, 0.075, 0.071), 0.072)
  const colores = [0x2ee06d, 0xff3b30, 0xffc107, 0x2f7bff, 0xf5f5f5, 0xf5f5f5]
  const pilotos = colores.map((c, i) => {
    const p = piloto(c)
    p.grupo.position.set(-0.014 + i * 0.045, 0.0, 0.071)
    raiz.add(p.grupo)
    const r = placa(`H${i + 1}`, `Q0.${i}`, 0.03)
    r.position.set(-0.014 + i * 0.045, -0.024, 0.0705)
    raiz.add(r)
    return p
  })
  // Zumbador.
  const zumb = cilindro(0.012, 0.012, MAT.negro, 24)
  zumb.rotation.x = Math.PI / 2
  zumb.position.set(0.255, 0.0, 0.076)
  raiz.add(zumb)
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.003 + i * 0.003, 0.0006, 6, 20), MAT.grafito)
    r.position.set(0.255, 0, 0.0825)
    raiz.add(r)
  }
  const rz = placa('ZUMB', 'Q0.6', 0.03)
  rz.position.set(0.255, -0.024, 0.0705)
  raiz.add(rz)
  // Ventilador en el costado.
  const carcasa = caja(0.08, 0.08, 0.03, MAT.grafito, 0.006)
  carcasa.position.set(0.345, 0.1, 0.02)
  raiz.add(carcasa)
  const rejilla = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.0015, 8, 40), MAT.cromo)
  rejilla.position.set(0.345, 0.1, 0.037)
  raiz.add(rejilla)
  const aspas = new THREE.Group()
  for (let i = 0; i < 5; i++) {
    const aspa = caja(0.028, 0.012, 0.002, MAT.azul, 0.001)
    aspa.position.x = 0.016
    aspa.rotation.x = 0.4
    const brazo = new THREE.Group()
    brazo.rotation.z = (i / 5) * Math.PI * 2
    brazo.add(aspa)
    aspas.add(brazo)
  }
  aspas.position.set(0.345, 0.1, 0.034)
  raiz.add(aspas)
  const rv = placa('VENT', 'Q0.7', 0.034)
  rv.position.set(0.345, 0.045, 0.0355)
  raiz.add(rv)

  let q = { ...ZERO }
  return {
    raiz,
    pulsables,
    actualizar: (sim, _dt, sonido, pan) => {
      const bits = sim.estado.bits
      plc.actualizar(bits, sim.corriendo)
      ponerMandos1(sim.mandos)
      ponerMandos2(sim.mandos)
      pilotos.forEach((p, i) => p.poner(!!bits[`Q0.${i}`]))
      const planta = sim.planta as PlantaTablero
      aspas.rotation.z = -planta.giro * Math.PI * 2
      sonido?.zumbador(!!bits['Q0.6'])
      sonido?.motor(planta.velocidad * 0.25)
      q = clicsDeRele(q, bits, sonido, pan(plc.grupo.position))
    },
  }
}

const ZERO: Record<string, boolean> = {}
const TABLERO_MANDOS = PLANTAS.tablero.mandos

/** El clic del relé de salida del PLC cada vez que una salida cambia. */
function clicsDeRele(antes: Record<string, boolean>, bits: Record<string, boolean>, sonido: SonidoBanco | null, pan: number) {
  const ahora: Record<string, boolean> = {}
  let cambios = 0
  for (const d of SALIDAS) {
    ahora[d] = !!bits[d]
    if (antes[d] !== undefined && antes[d] !== ahora[d]) cambios++
  }
  if (cambios) sonido?.golpe('rodillo', Math.min(1, 0.5 + cambios * 0.15), pan)
  return ahora
}

function escenaEstanque(): Escena {
  const raiz = new THREE.Group()
  const pulsables: THREE.Object3D[] = []
  const plc = crearPLC()
  plc.grupo.position.set(-0.44, 0.2, 0)
  raiz.add(plc.grupo)

  const R = 0.085
  const ALTO = 0.28
  const Y0 = 0.07
  const xT = 0.02
  // Soporte.
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, 0.1], [1, 0.1]]) {
    const pata = cilindro(0.005, Y0, MAT.aluminioOscuro, 12)
    pata.position.set(xT + sx * R * 0.7, Y0 / 2 - 0.04, 0.09 * sz)
    raiz.add(pata)
  }
  const aro = new THREE.Mesh(new THREE.TorusGeometry(R + 0.004, 0.004, 10, 48), MAT.aluminio)
  aro.rotation.x = Math.PI / 2
  aro.position.set(xT, Y0 - 0.002, 0.1)
  raiz.add(aro)
  // Fondo y tapa metálicos, pared transparente.
  const fondo = cilindro(R + 0.003, 0.01, MAT.aluminio, 48)
  fondo.position.set(xT, Y0, 0.1)
  const tapa = cilindro(R + 0.003, 0.008, MAT.aluminio, 48)
  tapa.position.set(xT, Y0 + ALTO, 0.1)
  raiz.add(fondo, tapa)
  const pared = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, ALTO, 48, 1, true),
    // Vidrio sin «transmission»: con ella, three.js no deja ver el agua
    // (transparente) que hay detrás de la pared.
    new THREE.MeshPhysicalMaterial({ color: 0xeef6ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
  )
  pared.position.set(xT, Y0 + ALTO / 2, 0.1)
  pared.renderOrder = 2
  raiz.add(pared)
  // Agua.
  const agua = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 0.002, R - 0.002, 1, 48),
    new THREE.MeshPhysicalMaterial({ color: 0x3f8fe0, roughness: 0.1, transparent: true, opacity: 0.62, clearcoat: 1 }),
  )
  agua.position.set(xT, Y0, 0.1)
  raiz.add(agua)
  // Escala de nivel.
  const escala = lienzo(0.02, ALTO * 0.95, (c, w, h) => {
    c.fillStyle = 'rgba(255,255,255,0.85)'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = '#1a1d22'
    c.fillStyle = '#1a1d22'
    c.font = `bold ${w * 0.22}px system-ui`
    for (let i = 0; i <= 10; i++) {
      const y = h - (i / 10) * h
      c.lineWidth = 4
      c.beginPath()
      c.moveTo(0, y)
      c.lineTo(i % 5 === 0 ? w * 0.55 : w * 0.3, y)
      c.stroke()
      if (i % 5 === 0) c.fillText(`${i * 10}%`, w * 0.58, Math.min(h - 4, Math.max(20, y + 8)))
    }
  })
  escala.position.set(xT + R * 0.5, Y0 + ALTO / 2, 0.1 + R * 0.87)
  escala.rotation.y = 0.52
  raiz.add(escala)

  // Flotadores S1 y S2 dentro del estanque.
  const flotadores = [
    { nivel: NIVEL_S1, dir: 'I0.3', nombre: 'S1' },
    { nivel: NIVEL_S2, dir: 'I0.4', nombre: 'S2' },
  ].map((f, i) => {
    const xF = xT - R * 0.55 + i * 0.02
    const vastago = cilindro(0.0018, ALTO, MAT.cromo, 10)
    vastago.position.set(xF, Y0 + ALTO / 2, 0.1 + R * 0.35)
    raiz.add(vastago)
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.011, 24, 16), MAT.cromo)
    raiz.add(bola)
    const cabeza = caja(0.02, 0.014, 0.02, MAT.grafito, 0.002)
    cabeza.position.set(xF, Y0 + ALTO + 0.012, 0.1 + R * 0.35)
    raiz.add(cabeza)
    const l = led(0x2ee06d)
    l.malla.position.set(xF, Y0 + ALTO + 0.012, 0.1 + R * 0.35 + 0.011)
    raiz.add(l.malla)
    const r = placa(f.nombre, f.dir, 0.03)
    r.position.set(xF - 0.052 + i * 0.012, Y0 + f.nivel * ALTO, 0.1 + R + 0.004)
    raiz.add(r)
    // Línea de nivel donde conmuta.
    const marca = caja(0.018, 0.0015, 0.001, MAT.rojo, 0.0003)
    marca.position.set(xF - 0.03 + i * 0.012, Y0 + f.nivel * ALTO, 0.1 + R + 0.003)
    raiz.add(marca)
    return { ...f, bola, l, xF }
  })

  // Tubería de entrada con V1 y de salida con V2.
  const tubo = (a: THREE.Vector3, b: THREE.Vector3) => {
    const d = b.clone().sub(a)
    const t = cilindro(0.0065, d.length(), MAT.aluminio, 16)
    t.position.copy(a).add(b).multiplyScalar(0.5)
    t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
    raiz.add(t)
  }
  const yIn = Y0 + ALTO + 0.05
  tubo(new THREE.Vector3(-0.2, yIn, 0.1), new THREE.Vector3(xT - 0.03, yIn, 0.1))
  tubo(new THREE.Vector3(xT - 0.03, yIn, 0.1), new THREE.Vector3(xT - 0.03, Y0 + ALTO + 0.004, 0.1))
  const valvulaSolenoide = (nombre: string, dir: string, pos: THREE.Vector3) => {
    const cuerpo = caja(0.034, 0.024, 0.024, MAT.laton, 0.003)
    cuerpo.position.copy(pos)
    const bobina = caja(0.022, 0.03, 0.022, MAT.negro, 0.003)
    bobina.position.copy(pos).add(new THREE.Vector3(0, 0.027, 0))
    const l = led(0xffa726, 0.0026)
    l.malla.position.copy(pos).add(new THREE.Vector3(0, 0.03, 0.012))
    const r = placa(nombre, dir, 0.034)
    r.position.copy(pos).add(new THREE.Vector3(0, 0.058, 0))
    raiz.add(cuerpo, bobina, l.malla, r)
    return l
  }
  const ledV1 = valvulaSolenoide('V1', 'Q0.1', new THREE.Vector3(-0.11, yIn, 0.1))
  const yOut = Y0 + 0.018
  tubo(new THREE.Vector3(xT + R - 0.01, yOut, 0.1), new THREE.Vector3(xT + R + 0.12, yOut, 0.1))
  tubo(new THREE.Vector3(xT + R + 0.12, yOut, 0.1), new THREE.Vector3(xT + R + 0.12, yOut - 0.03, 0.1))
  const ledV2 = valvulaSolenoide('V2', 'Q0.2', new THREE.Vector3(xT + R + 0.06, yOut, 0.1))
  // Bandeja de desagüe.
  const bandeja = caja(0.1, 0.02, 0.09, MAT.aluminioOscuro, 0.004)
  bandeja.position.set(xT + R + 0.12, -0.03, 0.1)
  raiz.add(bandeja)
  const aguaBandeja = caja(0.09, 0.004, 0.08, new THREE.MeshPhysicalMaterial({ color: 0x3f8fe0, transparent: true, opacity: 0.5 }), 0.002)
  aguaBandeja.position.set(xT + R + 0.12, -0.019, 0.1)
  raiz.add(aguaBandeja)
  // Chorros.
  const matChorro = new THREE.MeshPhysicalMaterial({ color: 0x6fb0f0, transparent: true, opacity: 0.55, roughness: 0.1 })
  const chorroIn = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.0065, 1, 16), matChorro)
  const chorroOut = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.006, 1, 16), matChorro)
  raiz.add(chorroIn, chorroOut)

  // Botonera START / STOP.
  const botonera = caja(0.1, 0.05, 0.05, new THREE.MeshStandardMaterial({ color: 0xe9e6de, roughness: 0.5 }), 0.005)
  botonera.position.set(-0.2, 0.0, 0.14)
  raiz.add(botonera)
  const ponerMandos = montarMandos(raiz, pulsables, PLANTAS.estanque.mandos, new THREE.Vector3(-0.225, 0.008, 0.1655), 0.05)

  let q = { ...ZERO }
  let t = 0
  return {
    raiz,
    pulsables,
    actualizar: (sim, dt, sonido, pan) => {
      t += dt
      const bits = sim.estado.bits
      plc.actualizar(bits, sim.corriendo)
      ponerMandos(sim.mandos)
      const p = sim.planta as PlantaEstanque
      const h = Math.max(0.0005, p.nivel * (ALTO - 0.01))
      agua.scale.y = h
      agua.position.y = Y0 + 0.005 + h / 2
      agua.visible = p.nivel > 0.001
      const superficie = Y0 + 0.005 + h
      for (const f of flotadores) {
        const yConmuta = Y0 + f.nivel * ALTO
        // El flotador sigue al agua dentro de su pequeño recorrido.
        const y = THREE.MathUtils.clamp(superficie, yConmuta - 0.012, yConmuta + 0.01)
        f.bola.position.set(f.xF, y, 0.1 + R * 0.35)
        f.l.poner(!!sim.planta.sensores()[f.dir])
      }
      ledV1.poner(!!bits['Q0.1'])
      ledV2.poner(!!bits['Q0.2'])
      // Chorro de entrada: de la boca al agua.
      chorroIn.visible = p.entrando
      if (p.entrando) {
        const arriba = Y0 + ALTO
        const largo = Math.max(0.01, arriba - superficie)
        chorroIn.scale.set(1 + Math.sin(t * 40) * 0.08, largo, 1)
        chorroIn.position.set(xT - 0.03, superficie + largo / 2, 0.1)
      }
      chorroOut.visible = p.saliendo
      if (p.saliendo) {
        const largo = yOut - 0.03 - -0.02
        chorroOut.scale.set(1 + Math.sin(t * 37) * 0.08, largo, 1)
        chorroOut.position.set(xT + R + 0.12, yOut - 0.03 - largo / 2, 0.1)
      }
      aguaBandeja.visible = p.saliendo || aguaBandeja.visible
      sonido?.agua((p.entrando ? 0.8 : 0) + (p.saliendo ? 0.5 : 0))
      const antesV = [q['Q0.1'], q['Q0.2']]
      q = clicsDeRele(q, bits, sonido, pan(plc.grupo.position))
      if (antesV[0] !== undefined && antesV[0] !== q['Q0.1']) sonido?.golpe('valvula', 0.8, pan(new THREE.Vector3(-0.11, yIn, 0.1)))
      if (antesV[1] !== undefined && antesV[1] !== q['Q0.2']) sonido?.golpe('valvula', 0.8, pan(new THREE.Vector3(xT + R + 0.06, yOut, 0.1)))
    },
  }
}

function escenaElevador(): Escena {
  const raiz = new THREE.Group()
  const pulsables: THREE.Object3D[] = []
  const plc = crearPLC()
  plc.grupo.position.set(-0.74, 0.22, 0)
  raiz.add(plc.grupo)
  const E = 1.5 // los cilindros se montan algo mayores para que se lean bien

  // Bastidor.
  const perfil = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, metalness: 0.8, roughness: 0.4 })
  const columna = caja(0.02, 0.5, 0.02, perfil, 0.002)
  columna.position.set(-0.34, 0.19, 0.01)
  const columna2 = columna.clone()
  columna2.position.x = 0.4
  const viga = caja(0.76, 0.02, 0.02, perfil, 0.002)
  viga.position.set(0.03, 0.45, 0.01)
  raiz.add(columna, columna2, viga)

  // Z1: cilindro vertical que sube la plataforma.
  const z1 = modeloCilindro('cilindroDobleEfecto', 'Z1')
  z1.grupo.scale.setScalar(E)
  z1.grupo.rotation.z = Math.PI / 2
  z1.grupo.position.set(0.0, -0.02, 0.02)
  raiz.add(z1.grupo)
  const punta = (pos: number) => z1.grupo.position.y + z1.puntaVastago(pos) * E
  const plataforma = caja(0.1, 0.008, 0.08, perfil, 0.002)
  raiz.add(plataforma)
  const yPlataforma = (pos: number) => punta(pos) + 0.006
  // Guía de la plataforma.
  const guia = cilindro(0.004, 0.2, MAT.cromo, 12)
  guia.position.set(0.045, yPlataforma(0.5), 0.07)
  raiz.add(guia)

  // Z2: cilindro horizontal arriba, empuja hacia la banda.
  const yArriba = yPlataforma(1)
  const z2 = modeloCilindro('cilindroDobleEfecto', 'Z2')
  z2.grupo.scale.setScalar(E)
  const alturaEmpuje = yArriba + 0.004 + 0.025
  // Con Z2 recogido, su placa queda justo antes de la pieza; extendido, la
  // deja entera sobre la banda.
  z2.grupo.position.set(-0.058 - z2.puntaVastago(0) * E, alturaEmpuje, 0.02)
  raiz.add(z2.grupo)
  const puntaZ2 = (pos: number) => z2.grupo.position.x + z2.puntaVastago(pos) * E
  // Una placa de empuje en la punta del vástago.
  const empujador = caja(0.006, 0.04, 0.05, MAT.aluminioOscuro, 0.001)
  raiz.add(empujador)

  // Banda de salida, a la altura de la plataforma arriba.
  const xBanda0 = 0.055
  const largoBanda = 0.34
  const banda = caja(largoBanda, 0.01, 0.08, MAT.negro, 0.003)
  banda.position.set(xBanda0 + largoBanda / 2, yArriba - 0.001, 0.058)
  raiz.add(banda)
  const bastidorBanda = caja(largoBanda + 0.01, 0.03, 0.09, perfil, 0.003)
  bastidorBanda.position.set(xBanda0 + largoBanda / 2, yArriba - 0.022, 0.058)
  raiz.add(bastidorBanda)
  const rodillos: THREE.Mesh[] = []
  for (let i = 0; i < 2; i++) {
    const r = cilindro(0.008, 0.085, MAT.cromo, 16)
    r.rotation.x = Math.PI / 2
    r.position.set(xBanda0 + (i ? largoBanda : 0), yArriba - 0.004, 0.058)
    raiz.add(r)
    rodillos.push(r)
  }
  const placaBanda = placa('Segunda banda', 'la pieza sale por aquí', 0.08)
  placaBanda.position.set(xBanda0 + largoBanda * 0.6, yArriba - 0.022, 0.1035)
  raiz.add(placaBanda)

  // La pieza.
  const pieza = caja(0.05, 0.05, 0.05, new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: 0.6 }), 0.004)
  raiz.add(pieza)

  // Sensores de posición en los cilindros (S1…S4) y S0 fotoeléctrico.
  const sensor = (nombre: string, dir: string, pos: THREE.Vector3, placaEn: THREE.Vector3) => {
    const cuerpo = cilindro(0.005, 0.02, MAT.grafito, 14)
    cuerpo.rotation.x = Math.PI / 2
    cuerpo.position.copy(pos)
    const l = led(0x2ee06d, 0.0026)
    l.malla.position.copy(pos).add(new THREE.Vector3(0, 0, 0.011))
    const r = placa(nombre, dir, 0.03)
    r.position.copy(placaEn)
    raiz.add(cuerpo, l.malla, r)
    return { dir, l }
  }
  const zSens = 0.02 + 0.034 * E + 0.006
  const sensores = [
    sensor('S1', 'I0.1', new THREE.Vector3(-0.03, 0.01, zSens), new THREE.Vector3(-0.1, 0.01, zSens)),
    sensor('S2', 'I0.2', new THREE.Vector3(-0.03, 0.18, zSens), new THREE.Vector3(-0.1, 0.18, zSens)),
    sensor('S3', 'I0.3', new THREE.Vector3(z2.grupo.position.x - 0.08, alturaEmpuje + 0.035, zSens), new THREE.Vector3(z2.grupo.position.x - 0.08, alturaEmpuje + 0.065, zSens)),
    sensor('S4', 'I0.4', new THREE.Vector3(z2.grupo.position.x + 0.08, alturaEmpuje + 0.035, zSens), new THREE.Vector3(z2.grupo.position.x + 0.08, alturaEmpuje + 0.065, zSens)),
  ]
  // S0: barrera fotoeléctrica a la altura de la pieza en la plataforma abajo.
  const yS0 = yPlataforma(0) + 0.028
  const poste = caja(0.012, 0.05, 0.012, perfil, 0.002)
  poste.position.set(0.1, yS0 - 0.01, 0.06)
  raiz.add(poste)
  const s0 = sensor('S0', 'I0.0', new THREE.Vector3(0.1, yS0 + 0.02, 0.06), new THREE.Vector3(0.14, yS0 + 0.02, 0.07))
  sensores.push(s0)
  const haz = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0009, 0.0009, 0.1, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.7 }),
  )
  haz.rotation.z = Math.PI / 2
  haz.position.set(0.05, yS0 + 0.02, 0.06)
  raiz.add(haz)

  // Electroválvulas Y1 e Y2 con su LED de bobina.
  const valvulas = [
    { id: 'Y1', dir: 'Q0.0', pos: new THREE.Vector3(-0.4, 0.03, 0.02) },
    { id: 'Y2', dir: 'Q0.1', pos: new THREE.Vector3(-0.4, 0.13, 0.02) },
  ].map((v) => {
    const m = modeloValvula('valvula52', v.id, { modo: 'monoestable', accionamiento: 'pilotaje' })
    m.grupo.scale.setScalar(E * 0.8)
    m.grupo.position.copy(v.pos)
    raiz.add(m.grupo)
    const l = led(0xffa726, 0.003)
    l.malla.position.copy(v.pos).add(new THREE.Vector3(-0.06 * E * 0.8 - 0.006, 0.0, 0.03 * E * 0.8))
    raiz.add(l.malla)
    const r = placa(v.id, v.dir, 0.03)
    r.position.copy(v.pos).add(new THREE.Vector3(-0.1, 0, 0.03))
    raiz.add(r)
    return { ...v, m, l }
  })
  // Mangueras válvula → cilindro.
  const matTubo = new THREE.MeshPhysicalMaterial({ color: 0x2a76d2, roughness: 0.3, clearcoat: 1 })
  const manguera = (modA: { grupo: THREE.Group; racores: Record<string, { punto: THREE.Vector3; dir: THREE.Vector3 }> }, pa: string, modB: typeof modA, pb: string) => {
    modA.grupo.updateMatrixWorld(true)
    modB.grupo.updateMatrixWorld(true)
    const ra = modA.racores[pa]
    const rb = modB.racores[pb]
    if (!ra || !rb) return
    const a = modA.grupo.localToWorld(ra.punto.clone())
    const b = modB.grupo.localToWorld(rb.punto.clone())
    const da = ra.dir.clone().applyQuaternion(modA.grupo.quaternion)
    const db = rb.dir.clone().applyQuaternion(modB.grupo.quaternion)
    const p1 = a.clone().addScaledVector(da, 0.03).add(new THREE.Vector3(0, 0, 0.02))
    const p3 = b.clone().addScaledVector(db, 0.03).add(new THREE.Vector3(0, 0, 0.02))
    const medio = p1.clone().lerp(p3, 0.5).add(new THREE.Vector3(0, -0.02, 0.04))
    const curva = new THREE.CatmullRomCurve3([a, p1, medio, p3, b], false, 'centripetal')
    const t = new THREE.Mesh(new THREE.TubeGeometry(curva, 60, 0.0035, 10, false), matTubo)
    t.castShadow = true
    raiz.add(t)
  }
  manguera(valvulas[0].m, '4', z1, 'A')
  manguera(valvulas[0].m, '2', z1, 'B')
  manguera(valvulas[1].m, '4', z2, 'A')
  manguera(valvulas[1].m, '2', z2, 'B')

  let q = { ...ZERO }
  let fases: { z1: number; z2: number } | null = null
  return {
    raiz,
    pulsables,
    actualizar: (sim, _dt, sonido, pan) => {
      const bits = sim.estado.bits
      plc.actualizar(bits, sim.corriendo)
      const p = sim.planta as PlantaElevador
      z1.actualizar({ posicion: p.z1 }, 0)
      z2.actualizar({ posicion: p.z2 }, 0)
      plataforma.position.set(0.0, yPlataforma(p.z1) - 0.004, 0.058)
      empujador.position.set(puntaZ2(p.z2) + 0.003, alturaEmpuje, 0.058)
      // La pieza: en la plataforma, empujada por Z2 o camino por la banda.
      pieza.visible = p.pieza !== 'ninguna'
      if (p.pieza === 'plataforma') {
        const x = p.z1 >= 0.98 ? Math.max(0, puntaZ2(p.z2) + 0.006 + 0.025) : 0
        pieza.position.set(x, yPlataforma(p.z1) + 0.025, 0.058)
      } else if (p.pieza === 'fuera') {
        const x0 = puntaZ2(1) + 0.031
        pieza.position.set(x0 + p.enBanda * (xBanda0 + largoBanda - x0 - 0.02), yArriba + 0.029, 0.058)
      }
      for (const s of sensores) s.l.poner(!!sim.planta.sensores()[s.dir])
      haz.material.opacity = p.pieza === 'plataforma' && p.z1 < 0.1 ? 0.25 : 0.7
      for (const v of valvulas) {
        v.l.poner(!!bits[v.dir])
        v.m.actualizar({ accionada: !!bits[v.dir] }, 0)
      }
      for (const r of rodillos) r.rotation.y += p.pieza === 'fuera' ? 0.2 : 0
      // Sonido: relés, válvulas, escapes y topes.
      const antes = { ...q }
      q = clicsDeRele(q, bits, sonido, pan(plc.grupo.position))
      for (const v of valvulas) {
        if (antes[v.dir] !== undefined && antes[v.dir] !== q[v.dir]) {
          sonido?.golpe('valvula', 0.85, pan(v.pos))
          sonido?.rafaga(0.6, pan(v.pos))
        }
      }
      const fin = (x: number) => (x >= 0.999 ? 1 : x <= 0.001 ? -1 : 0)
      const nuevas = { z1: fin(p.z1), z2: fin(p.z2) }
      // El golpe suena al llegar a un extremo después de haberse movido.
      if (fases && nuevas.z1 !== 0 && fases.z1 === 0) sonido?.golpe('tope', 0.8, pan(z1.grupo.position))
      if (fases && nuevas.z2 !== 0 && fases.z2 === 0) sonido?.golpe('tope', 0.8, pan(z2.grupo.position))
      fases = nuevas
      const moviendo = (p.z1 > 0.001 && p.z1 < 0.999) || (p.z2 > 0.001 && p.z2 < 0.999)
      sonido?.continuo(moviendo ? 0.35 : 0, 0)
    },
  }
}

function crearEscena(id: string): Escena {
  if (id === 'estanque') return escenaEstanque()
  if (id === 'elevador') return escenaElevador()
  return escenaTablero()
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export default function Planta3D({ sim, version, acciones, onAccion }: Props) {
  const contRef = useRef<HTMLDivElement>(null)
  const [sinWebGL, setSinWebGL] = useState(false)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
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
    renderer.domElement.dataset.planta3d = 'si'
    cont.appendChild(renderer.domElement)

    const escena = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    escena.environment = entorno
    escena.environmentIntensity = 1.1
    escena.background = new THREE.Color(0xdde2e7)

    const planta = crearEscena(sim.current.planta.id)
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

    const camara = new THREE.PerspectiveCamera(32, cont.clientWidth / Math.max(1, cont.clientHeight), 0.01, 20)
    const controles = new OrbitControls(camara, renderer.domElement)
    controles.enableDamping = true
    controles.dampingFactor = 0.08
    controles.minDistance = 0.12
    controles.maxDistance = 4
    controles.maxPolarAngle = Math.PI * 0.62
    controles.zoomToCursor = true
    const encuadrar = () => {
      const aspecto = cont.clientWidth / Math.max(1, cont.clientHeight)
      const vfov = THREE.MathUtils.degToRad(camara.fov)
      const distV = ((tam.y + 0.06) * 0.52) / Math.tan(vfov / 2)
      const distH = ((tam.x + 0.06) * 0.52) / Math.tan(vfov / 2) / aspecto
      const dist = Math.max(distV, distH, 0.3)
      camara.position.set(centro.x + dist * 0.12, centro.y + dist * 0.14, dist + 0.05)
      controles.target.set(centro.x, centro.y, 0.04)
      controles.update()
    }
    encuadrar()
    encuadrarRef.current = encuadrar

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

    const observador = new ResizeObserver(() => {
      const w = cont.clientWidth
      const h = cont.clientHeight
      renderer.setSize(w, h)
      camara.aspect = w / Math.max(1, h)
      camara.updateProjectionMatrix()
    })
    observador.observe(cont)

    const proyectada = new THREE.Vector3()
    const pan = (v: THREE.Vector3) => THREE.MathUtils.clamp(proyectada.copy(v).project(camara).x * 0.85, -1, 1)
    let vivo = true
    let antes = performance.now()
    const bucle = () => {
      if (!vivo) return
      requestAnimationFrame(bucle)
      const ahora = performance.now()
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      controles.update()
      planta.actualizar(sim.current, dt, conSonidoRef.current ? sonidoRef.current : null, pan)
      renderer.render(escena, camara)
    }
    requestAnimationFrame(bucle)
    cont.dataset.planta = sim.current.planta.id

    return () => {
      vivo = false
      observador.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      controles.dispose()
      escena.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      entorno.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      sonidoRef.current?.callar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

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
        height: pantallaCompleta ? '100%' : 440,
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
        <button style={boton} onClick={() => encuadrarRef.current()} title="Volver a ver la planta entera">
          Encuadrar
        </button>
        <button
          style={{ ...boton, background: conSonido ? '#1668c7' : '#fff', color: conSonido ? '#fff' : '#33475c' }}
          onClick={() => {
            if (!conSonido) sonido().activar()
            setConSonido((v) => !v)
          }}
          aria-pressed={conSonido}
          title="Relés, válvulas, agua, cilindros y zumbador"
        >
          {conSonido ? '🔊 Sonido' : '🔇 Sonido'}
        </button>
        {typeof document !== 'undefined' && document.fullscreenEnabled && (
          <button
            style={boton}
            onClick={() => {
              const c = contRef.current
              if (!c) return
              if (document.fullscreenElement === c) void document.exitFullscreen()
              else void c.requestFullscreen?.()
            }}
          >
            {pantallaCompleta ? '⤡ Salir' : '⤢ Pantalla completa'}
          </button>
        )}
      </div>
      {acciones.length > 0 && (
        <div style={{ ...barra, left: 8, right: 'auto' }}>
          {acciones.map((a) => (
            <button key={a.id} style={boton} title={a.titulo} onClick={() => onAccion(a.id)}>
              {a.etiqueta}
            </button>
          ))}
        </div>
      )}
      <p style={pista}>Arrastra para girar · rueda para acercarte · pulsa los botones de la máquina</p>
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
