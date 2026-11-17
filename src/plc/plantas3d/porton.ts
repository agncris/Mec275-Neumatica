import * as THREE from 'three'
import { MAT, caja } from '../../vista3d/modelos'
import { PLANTAS, type PlantaPorton } from '../plantas'
import { placa, led, piloto, crearPLC, type Escena, montarMandos, clicsDeRele, ZERO, CARTON } from './comun'

export function escenaPorton(): Escena {
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
