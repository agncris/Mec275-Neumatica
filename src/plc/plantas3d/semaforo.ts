import * as THREE from 'three'
import { MAT, caja, cilindro } from '../../vista3d/modelos'
import { PLANTAS, type PlantaSemaforo } from '../plantas'
import { placa, piloto, crearPLC, type Escena, montarMandos, clicsDeRele, ZERO } from './comun'

export function escenaSemaforo(): Escena {
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
