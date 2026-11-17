import * as THREE from 'three'
import { MAT, caja, cilindro } from '../../vista3d/modelos'
import { NIVEL_S1, NIVEL_S2, PLANTAS, type PlantaEstanque } from '../plantas'
import { lienzo, placa, led, crearPLC, type Escena, montarMandos, clicsDeRele, ZERO } from './comun'

export function escenaEstanque(): Escena {
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
    const r = placa(f.nombre, f.dir, 0.03, true)
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
    const r = placa(nombre, dir, 0.034, true)
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
