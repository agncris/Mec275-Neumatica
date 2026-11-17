import * as THREE from 'three'
import { MAT, caja, cilindro, modeloCilindro, modeloValvula } from '../../vista3d/modelos'
import { type PlantaElevador } from '../plantas'
import { placa, insignia, led, crearPLC, type Escena, clicsDeRele, ZERO } from './comun'

export function escenaElevador(): Escena {
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
