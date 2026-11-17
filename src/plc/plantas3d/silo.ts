import * as THREE from 'three'
import { MAT, caja, cilindro } from '../../vista3d/modelos'
import { PLANTAS, X_SILO, type PlantaSilo } from '../plantas'
import { placa, led, piloto, crearPLC, type Escena, montarMandos, clicsDeRele, ZERO } from './comun'
import { CARTON } from './comun'

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

export function escenaSilo(): Escena {
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
