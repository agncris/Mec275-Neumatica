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
import { MAT, caja, cilindro, modeloCilindro, modeloValvula } from '../vista3d/modelos'
import { SonidoBanco } from '../vista3d/sonido'
import { ponerNotacionEscena, type SimPLC } from './plantas3d/comun'
import { type Notacion } from './notacion'
import {
  PLANTAS,
  X_SILO,
  type PlantaElevador,
  type PlantaPorton,
  type PlantaSemaforo,
  type PlantaSilo,
} from './plantas'
import { escenaTablero } from './plantas3d/tablero'
import { escenaEstanque } from './plantas3d/estanque'
import { placa, insignia, led, piloto, crearPLC, type Escena, montarMandos, clicsDeRele, ZERO } from './plantas3d/comun'

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
  // Rótulos grandes de los cilindros.
  const iz1 = insignia('Z1')
  iz1.position.set(0.075, 0.05, 0.06)
  const iz2 = insignia('Z2')
  iz2.position.set(z2.grupo.position.x + 0.03, alturaEmpuje - 0.04, 0.06)
  raiz.add(iz1, iz2)

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
    const r = placa(nombre, dir, 0.03, true)
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
    const r = placa(v.id, v.dir, 0.03, true)
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

// ---------------------------------------------------------------------------
// Silo, semáforo y portón
// ---------------------------------------------------------------------------
const CARTON = new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 0.85 })
const GRANO = new THREE.MeshStandardMaterial({ color: 0xe0a33a, roughness: 0.95 })

/** Una caja de cartón abierta por arriba, con su contenido. */
function crearCajaCarton() {
  const g = new THREE.Group()
  const a = 0.075
  const h = 0.06
  const e = 0.003
  const fondo = caja(a, e, a, CARTON, 0.001)
  fondo.position.y = e / 2
  g.add(fondo)
  for (const [x, z, w, d] of [
    [0, a / 2 - e / 2, a, e],
    [0, -a / 2 + e / 2, a, e],
    [a / 2 - e / 2, 0, e, a],
    [-a / 2 + e / 2, 0, e, a],
  ]) {
    const pared = caja(w, h, d, CARTON, 0.0008)
    pared.position.set(x, h / 2, z)
    g.add(pared)
  }
  const contenido = new THREE.Mesh(new THREE.BoxGeometry(a - 2 * e - 0.001, 1, a - 2 * e - 0.001), GRANO)
  contenido.geometry.translate(0, 0.5, 0)
  contenido.position.y = e
  contenido.scale.y = 0.0001
  g.add(contenido)
  return {
    grupo: g,
    llenar: (f: number) => {
      contenido.scale.y = Math.max(0.0001, Math.min(1.05, f) * (h - e))
      contenido.visible = f > 0.005
    },
  }
}

function escenaSilo(): Escena {
  const raiz = new THREE.Group()
  const pulsables: THREE.Object3D[] = []
  const plc = crearPLC()
  plc.grupo.position.set(-0.86, 0.22, 0)
  raiz.add(plc.grupo)

  // Cinta transportadora: de x0 a x0 + L.
  const x0 = -0.36
  const L = 0.8
  const yCinta = 0.08
  const zC = 0.1
  const aX = (u: number) => x0 + u * L
  const perfil = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, metalness: 0.8, roughness: 0.4 })
  const banda = caja(L + 0.06, 0.008, 0.11, new THREE.MeshStandardMaterial({ color: 0xa32a22, roughness: 0.7 }), 0.003)
  banda.position.set(aX(0.5), yCinta - 0.004, zC)
  raiz.add(banda)
  const bastidor = caja(L + 0.08, 0.03, 0.12, perfil, 0.003)
  bastidor.position.set(aX(0.5), yCinta - 0.024, zC)
  raiz.add(bastidor)
  for (const u of [0.05, 0.95]) {
    const pata = caja(0.02, 0.1, 0.1, perfil, 0.002)
    pata.position.set(aX(u), yCinta - 0.09, zC)
    raiz.add(pata)
  }
  const rodillos: THREE.Mesh[] = []
  for (let i = 0; i <= 10; i++) {
    const r = cilindro(0.009, 0.115, MAT.cromo, 14)
    r.rotation.x = Math.PI / 2
    r.position.set(aX(i / 10) - 0.0, yCinta - 0.018, zC)
    raiz.add(r)
    rodillos.push(r)
  }
  // Motor de la cinta.
  const motor = cilindro(0.028, 0.07, new THREE.MeshStandardMaterial({ color: 0x1f3fa8, metalness: 0.3, roughness: 0.4 }), 28)
  motor.rotation.x = Math.PI / 2
  motor.position.set(aX(1) + 0.03, yCinta - 0.04, zC + 0.1)
  raiz.add(motor)
  const ventilador = new THREE.Group()
  for (let i = 0; i < 4; i++) {
    const aspa = caja(0.03, 0.006, 0.002, MAT.grafito, 0.001)
    aspa.rotation.z = (i * Math.PI) / 2
    aspa.position.set(Math.cos((i * Math.PI) / 2) * 0.012, Math.sin((i * Math.PI) / 2) * 0.012, 0)
    ventilador.add(aspa)
  }
  ventilador.position.set(aX(1) + 0.03, yCinta - 0.04, zC + 0.137)
  raiz.add(ventilador)
  const rMotor = placa('MOTOR', 'Q0.0', 0.04, true)
  rMotor.position.set(aX(1) + 0.03, yCinta - 0.085, zC + 0.1)
  raiz.add(rMotor)

  // Silo.
  const xs = aX(X_SILO)
  const chapa = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.75, roughness: 0.35 })
  const cuerpo = cilindro(0.1, 0.16, chapa, 40)
  cuerpo.position.set(xs, 0.4, zC)
  const cono = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.016, 0.11, 40), chapa)
  cono.position.set(xs, 0.265, zC)
  cono.castShadow = true
  const boca = cilindro(0.016, 0.04, chapa, 20)
  boca.position.set(xs, 0.19, zC)
  raiz.add(cuerpo, cono, boca)
  for (const sx of [-1, 1]) {
    const pata = caja(0.012, 0.4, 0.012, perfil, 0.002)
    pata.position.set(xs + sx * 0.12, 0.22, zC - 0.06)
    raiz.add(pata)
  }
  const rSilo = placa('SILO', '', 0.06)
  rSilo.position.set(xs, 0.42, zC + 0.1005)
  raiz.add(rSilo)
  // Electroválvula de descarga.
  const valv = caja(0.03, 0.02, 0.03, MAT.laton, 0.003)
  valv.position.set(xs, 0.165, zC)
  const bobina = caja(0.026, 0.022, 0.02, MAT.negro, 0.003)
  bobina.position.set(xs - 0.03, 0.165, zC)
  const ledSol = led(0xffa726, 0.0028)
  ledSol.malla.position.set(xs - 0.03, 0.165, zC + 0.011)
  raiz.add(valv, bobina, ledSol.malla)
  const rSol = placa('SOLENOID', 'Q0.1', 0.05, true)
  rSol.position.set(xs - 0.075, 0.165, zC + 0.012)
  raiz.add(rSol)
  const chorro = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, 1, 14), GRANO)
  raiz.add(chorro)
  // Sensor de nivel, junto a la boca, mirando la caja.
  const nivel = cilindro(0.006, 0.03, MAT.grafito, 14)
  nivel.position.set(xs + 0.03, 0.155, zC + 0.02)
  const ledNivel = led(0x2ee06d, 0.0026)
  ledNivel.malla.position.set(xs + 0.03, 0.172, zC + 0.028)
  const rNivel = placa('LEVEL', 'I0.4', 0.04, true)
  rNivel.position.set(xs + 0.08, 0.16, zC + 0.02)
  raiz.add(nivel, ledNivel.malla, rNivel)
  // Sensor de proximidad, al costado de la cinta.
  const prox = cilindro(0.006, 0.03, MAT.grafito, 14)
  prox.rotation.x = Math.PI / 2
  prox.position.set(xs, yCinta + 0.02, zC + 0.075)
  const ledProx = led(0x2ee06d, 0.0026)
  ledProx.malla.position.set(xs, yCinta + 0.02, zC + 0.092)
  const rProx = placa('PROX', 'I0.3', 0.04, true)
  rProx.position.set(xs, yCinta - 0.01, zC + 0.092)
  raiz.add(prox, ledProx.malla, rProx)
  // Material derramado sobre la cinta.
  const derrame = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), GRANO)
  derrame.scale.set(1, 0.001, 1)
  derrame.position.set(xs, yCinta, zC)
  raiz.add(derrame)

  // Tablero de mando: pilotos RUN / FILL / FULL y START / STOP.
  const tablero = caja(0.13, 0.16, 0.04, new THREE.MeshStandardMaterial({ color: 0xe9ddd0, roughness: 0.5 }), 0.004)
  tablero.position.set(-0.52, 0.3, 0.02)
  raiz.add(tablero)
  const pilotos = ['Q0.2', 'Q0.3', 'Q0.4'].map((d, i) => {
    const pl = piloto(0xffd21f)
    pl.grupo.position.set(-0.55, 0.355 - i * 0.034, 0.041)
    raiz.add(pl.grupo)
    const r = placa(['RUN', 'FILL', 'FULL'][i], d, 0.04)
    r.position.set(-0.5, 0.355 - i * 0.034, 0.0405)
    raiz.add(r)
    return { d, pl }
  })
  const ponerMandos = montarMandos(raiz, pulsables, PLANTAS.silo.mandos, new THREE.Vector3(-0.55, 0.26, 0.041), 0.05)

  // Cajas: se crean y se quitan según las lleve la cinta.
  const cajas = new Map<number, ReturnType<typeof crearCajaCarton>>()
  let q = { ...ZERO }
  return {
    raiz,
    pulsables,
    actualizar: (sim, _dt, sonido, pan) => {
      const bits = sim.estado.bits
      plc.actualizar(bits, sim.corriendo)
      ponerMandos(sim.mandos)
      const p = sim.planta as PlantaSilo
      const vivas = new Set<number>()
      for (const c of p.cajas) {
        vivas.add(c.id)
        let m = cajas.get(c.id)
        if (!m) {
          m = crearCajaCarton()
          m.grupo.traverse((o) => ((o as THREE.Mesh).castShadow = true))
          cajas.set(c.id, m)
          raiz.add(m.grupo)
        }
        m.grupo.position.set(aX(c.x), yCinta, zC)
        m.grupo.visible = c.x > -0.08
        m.llenar(c.llenado)
      }
      for (const [id, m] of cajas) {
        if (vivas.has(id)) continue
        raiz.remove(m.grupo)
        cajas.delete(id)
      }
      for (const r of rodillos) r.rotation.y = -p.avance * 40
      ventilador.rotation.z = -p.avance * 120
      chorro.visible = p.cayendo
      if (p.cayendo) {
        const bajo = p.cajas.find((c) => Math.abs(c.x - X_SILO) < 0.035)
        const fin = bajo ? yCinta + 0.003 + Math.min(1, bajo.llenado) * 0.057 : yCinta
        const largo = 0.155 - fin
        chorro.scale.set(1, largo, 1)
        chorro.position.set(xs, fin + largo / 2, zC)
      }
      derrame.scale.set(0.3 + p.derrame, Math.max(0.001, p.derrame * 0.4), 0.3 + p.derrame * 0.6)
      derrame.visible = p.derrame > 0.001
      ledSol.poner(!!bits['Q0.1'])
      const sens = p.sensores()
      ledNivel.poner(!!sens['I0.4'])
      ledProx.poner(!!sens['I0.3'])
      for (const { d, pl } of pilotos) pl.poner(!!bits[d])
      sonido?.motor(p.cintaEnMarcha ? 0.25 : 0)
      sonido?.agua(p.cayendo ? 0.45 : 0)
      const antes = { ...q }
      q = clicsDeRele(q, bits, sonido, pan(plc.grupo.position))
      if (antes['Q0.1'] !== undefined && antes['Q0.1'] !== q['Q0.1']) sonido?.golpe('valvula', 0.8, pan(valv.position))
    },
  }
}

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
