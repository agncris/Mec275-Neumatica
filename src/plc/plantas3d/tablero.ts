import * as THREE from 'three'
import { MAT, caja, cilindro } from '../../vista3d/modelos'
import { PLANTAS, type PlantaTablero } from '../plantas'
import { placa, piloto, crearPLC, type Escena, montarMandos, clicsDeRele, ZERO } from './comun'

export function escenaTablero(): Escena {
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

const TABLERO_MANDOS = PLANTAS.tablero.mandos
