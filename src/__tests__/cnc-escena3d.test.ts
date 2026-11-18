/**
 * La escena 3D del torno y de la fresadora, armada en Node (three.js sin WebGL) y recorrida paso
 * a paso con el simulador. Comprueba tres cosas, para los ejemplos de la app y para cada
 * herramienta:
 *  1. La herramienta (sin el filo) y su portaherramientas no atraviesan la pieza, el plato, las
 *     garras, el contrapunto, la bancada ni nada que esté quieto. Tolerancia: 0,3 mm.
 *  2. Toda malla visible está unida a la base de la máquina por una cadena de contactos
 *     (holgura de 1 mm): nada flota en el aire.
 *  3. Un taladrado deja el agujero en el perfil interior de la pieza y en la malla que se dibuja.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { EJEMPLOS_CNC } from '../cnc/ejemplos'
import { interpretar } from '../cnc/gcode'
import { almacenDe, CONFIG_INICIAL, HERRAMIENTAS_FRESA, HERRAMIENTAS_TORNO, origenPrograma, posicionCasa, type ConfigCNC } from '../cnc/maquinas'
import { escenaFresa, escenaTorno, perfilTorno, type EscenaMaquina } from '../cnc/Maquina3D'
import { PiezaFresa, PiezaTorno, SimuladorCNC } from '../cnc/simulador'
import { cuerpoDe, enElAire, mallasDe, seCruzan, puntosDe, type Cuerpo } from './colisiones3d'

const DEPURAR = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DEBUG3D
/** Las escenas se arman y se recorren cuadro a cuadro: cada caso tarda unos segundos. */
const LARGO = 120_000
const TOLERANCIA = 0.3
const HOLGURA = 1

beforeAll(() => {
  // three.js pide un canvas 2D para las texturas; en Node basta con uno que no dibuja.
  const ctx = new Proxy(
    {},
    {
      get: (_o, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => undefined),
      set: () => true,
    },
  )
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) })
})

function armar(codigo: string, config: ConfigCNC) {
  const casa = posicionCasa(config)
  const radio = (t: number) => {
    const h = almacenDe(config).find((x) => x.t === t)
    return h ? h.diametro / 2 : undefined
  }
  const r = interpretar(codigo, config.maquina, casa, { origen: origenPrograma(config, codigo).origen, radio })
  const sim = new SimuladorCNC(r, config, casa)
  const esc = config.maquina === 'torno' ? escenaTorno(sim) : escenaFresa(sim)
  return { sim, esc }
}

const ancestro = (o: THREE.Object3D, nombre: string) => {
  for (let a: THREE.Object3D | null = o; a; a = a.parent) if (a.name === nombre) return true
  return false
}

/** ¿El punto del mundo está dentro de la pieza de torno (con `margen` mm de colchón)? */
function dentroDePieza(pz: PiezaTorno, inv: THREE.Matrix4, p: THREE.Vector3, margen: number): boolean {
  const v = p.clone().applyMatrix4(inv)
  const r = Math.hypot(v.y, v.z)
  const i = pz.indice(v.x)
  const k = Math.ceil(margen / 0.1)
  for (let j = i - k; j <= i + k; j++) {
    if (j < 0 || j >= pz.n) return false
    if (!(r > pz.int[j] + margen && r < pz.ext[j] - margen)) return false
  }
  return true
}

interface Hallazgos {
  choques: Set<string>
  aire: Set<string>
  cuadros: number
  herramientas: Set<number>
}

function recorrer(sim: SimuladorCNC, esc: EscenaMaquina, maquina: 'torno' | 'fresadora', muestras = 160): Hallazgos {
  const h: Hallazgos = { choques: new Set(), aire: new Set(), cuadros: 0, herramientas: new Set() }
  const total = sim.programa.pasos.reduce((s, p) => s + p.duracion, 0)
  const dt = Math.max(total / muestras, 0.02)
  let ultimaHerr = -1
  const revisar = (conectividad: boolean) => {
    const raiz = esc.raiz
    raiz.updateMatrixWorld(true)
    const herr = raiz.getObjectByName('herramienta')
    const tn = sim.pasoActual?.herramienta ?? 0
    h.cuadros++
    h.herramientas.add(tn)
    const todas = mallasDe(raiz, (m) => m.name === 'tronzada' && !conectividad)
    const cuerpos = todas.map((m) => cuerpoDe(m))
    const deHerr = cuerpos.filter((c) => herr && ancestro(c.malla, 'herramienta') && c.nombre !== 'inserto')
    const quietos = cuerpos.filter((c) => !ancestro(c.malla, 'herramienta') && !ancestro(c.malla, 'carro') && c.nombre !== 'tronzada')
    const deCarro = cuerpos.filter((c) => ancestro(c.malla, 'carro') && !ancestro(c.malla, 'herramienta'))
    const pieza = cuerpos.find((c) => c.nombre === 'pieza')
    const etiqueta = (c: Cuerpo) => `${c.nombre || 'sin-nombre'}`
    const ctx = DEPURAR ? `T${tn} (z${sim.pos.z.toFixed(0)}, x${sim.pos.x.toFixed(0)}, línea ${sim.linea})` : `T${tn}`
    const cruzaPieza = (a: Cuerpo) => {
      if (!pieza) return false
      if (maquina === 'torno') {
        const pz = sim.pieza as PiezaTorno
        return puntosDe(a).some((p) => dentroDePieza(pz, pieza.inv, p, TOLERANCIA))
      }
      // Fresadora: la pieza es un mapa de alturas. Los filos sí entran; el vástago, el porta y el resto, no.
      if (a.nombre.startsWith('filo')) return false
      const pz = sim.pieza as PiezaFresa
      return puntosDe(a).some((p) => {
        const i = Math.round(p.x / pz.celda)
        const j = Math.round(-p.z / pz.celda)
        if (i < 1 || j < 1 || i > pz.nx - 2 || j > pz.ny - 2) return false
        const sup = pz.h[j * pz.nx + i]
        return p.y < sup - TOLERANCIA && p.y > -pz.bruto.alto + TOLERANCIA
      })
    }
    for (const a of deHerr) {
      for (const b of quietos) {
        if (b.nombre === 'pieza') continue
        if (seCruzan(a, b, TOLERANCIA)) h.choques.add(`${ctx}: herramienta/${etiqueta(a)} atraviesa ${etiqueta(b)}`)
      }
      for (const b of deCarro) {
        if (['disco', 'tapa', 'soporte', 'ram', 'nariz'].includes(b.nombre)) continue
        if (seCruzan(a, b, TOLERANCIA)) h.choques.add(`${ctx}: herramienta/${etiqueta(a)} atraviesa ${etiqueta(b)}`)
      }
      if (cruzaPieza(a)) h.choques.add(`${ctx}: herramienta/${etiqueta(a)} atraviesa la pieza`)
    }
    // Lo que cuelga del carro tampoco puede cruzar lo que está quieto (salvo su apoyo en el fondo).
    for (const a of deCarro) {
      for (const b of quietos) {
        if (b.nombre === 'pieza') continue
        if (a.nombre === 'ram' && (b.nombre === 'fondo' || b.nombre === 'columna')) continue
        if (seCruzan(a, b, TOLERANCIA)) h.choques.add(`${ctx}: ${etiqueta(a)} atraviesa ${etiqueta(b)}`)
      }
      if (cruzaPieza(a)) h.choques.add(`${ctx}: ${etiqueta(a)} atraviesa la pieza`)
    }
    if (conectividad) {
      for (const c of enElAire(cuerpos, (c) => c.nombre === 'bancada' || c.nombre === 'mesa', HOLGURA)) h.aire.add(`${ctx}: ${etiqueta(c)} queda en el aire`)
    }
  }
  esc.actualizar(sim, 1, false)
  revisar(true)
  let guarda = 0
  while (!sim.terminado && !sim.alarma && guarda++ < 5000) {
    sim.avanzar(dt)
    if (sim.parado) sim.continuar()
    esc.actualizar(sim, 1, false)
    const herrActual = sim.pasoActual?.herramienta ?? 0
    revisar(herrActual !== ultimaHerr || sim.terminado)
    ultimaHerr = herrActual
  }
  return h
}

const ejemplosTorno = EJEMPLOS_CNC.filter((e) => e.maquina === 'torno')

function configDe(ej: (typeof EJEMPLOS_CNC)[number]): ConfigCNC {
  return { ...CONFIG_INICIAL, ...ej.config, torno: { ...CONFIG_INICIAL.torno, ...ej.config.torno }, maquina: ej.maquina }
}

function avisos(h: Hallazgos) {
  return [...h.choques, ...h.aire].sort()
}

describe('escena del torno: ejemplos de la app', () => {
  for (const ej of ejemplosTorno) {
    it(`${ej.titulo}: nada se atraviesa ni flota`, () => {
      const { sim, esc } = armar(ej.codigo, configDe(ej))
      const h = recorrer(sim, esc, 'torno')
      expect(sim.alarma).toBeNull()
      expect(h.cuadros).toBeGreaterThan(20)
      expect(avisos(h)).toEqual([])
    }, LARGO)
  }
})

/** Programa corto que usa la herramienta `t` con un movimiento propio de su tipo. */
function programaDe(t: number, D: number): string {
  const R = D / 2
  const f = HERRAMIENTAS_TORNO.find((x) => x.t === t)!
  const tt = `T${String(t).padStart(2, '0')}${String(t).padStart(2, '0')}`
  const cab = `G21 G90 G94\n${tt}\nM03 S1000\n`
  switch (f.forma) {
    case 'izquierda':
      return `${cab}G00 X${D + 6} Z2\nG00 X${Math.max(1, D - 2)}\nG01 Z-15 F150\nG01 X${D + 6}\nG00 Z2\nG28\nM05\nM30\n`
    case 'derecha':
      return `${cab}G00 X${D + 6} Z-15\nG01 X${Math.max(1, D - 2)} F50\nG01 Z0 F150\nG01 X${D + 6}\nG28\nM05\nM30\n`
    case 'ranurado':
      return `${cab}G00 X${D + 6} Z-10\nG01 X${Math.max(1, R)} F40\nG00 X${D + 6}\nG28\nM05\nM30\n`
    case 'roscado':
      return `${cab}G00 X${D + 6} Z2\nG00 X${Math.max(1, D - 2)}\nG01 Z-12 F150\nG00 X${D + 6}\nG28\nM05\nM30\n`
    case 'broca':
      return `${cab}G00 X0 Z2\nG01 Z-30 F60\nG00 Z2\nG28\nM05\nM30\n`
  }
}

const BRUTOS = [
  { diametro: 16, largo: 60, agarre: 20, sobremetal: 1 },
  { diametro: 40, largo: 90, agarre: 25, sobremetal: 1 },
  { diametro: 120, largo: 200, agarre: 40, sobremetal: 1 },
]

describe('escena del torno: cada herramienta, en brutos chicos y grandes', () => {
  for (const torno of BRUTOS) {
    for (const f of HERRAMIENTAS_TORNO) {
      it(`T${f.t} ${f.nombre} con bruto Ø${torno.diametro} × ${torno.largo}`, () => {
        const config: ConfigCNC = { ...CONFIG_INICIAL, maquina: 'torno', torno }
        const { sim, esc } = armar(programaDe(f.t, torno.diametro), config)
        const h = recorrer(sim, esc, 'torno', 80)
        expect(sim.alarma).toBeNull()
        expect(h.herramientas.has(f.t)).toBe(true)
        expect(h.cuadros).toBeGreaterThan(10)
        expect(avisos(h)).toEqual([])
      }, LARGO)
    }
  }
})

/** Corre el programa hasta que entra la herramienta `t` (o hasta el final si nunca entra). */
function correrHasta(sim: SimuladorCNC, t: number) {
  let guarda = 0
  while (!sim.terminado && !sim.alarma && sim.herramienta !== t && guarda++ < 100000) {
    if (sim.parado) sim.continuar()
    sim.avanzar(0.05)
  }
}

describe('escena del torno: el agujero del taladro', () => {
  const casos = [
    { id: 'torno-buje', siguiente: 9, desde: 0, hasta: 24, radio: 5 },
    { id: 'torno-simulator', siguiente: 6, desde: 0, hasta: 14, radio: 5 },
  ]
  for (const c of casos) {
    it(`${c.id}: queda en el perfil interior y en la malla de la pieza, y sale en el corte`, () => {
      const ej = ejemplosTorno.find((e) => e.id === c.id)!
      const { sim, esc } = armar(ej.codigo, configDe(ej))
      correrHasta(sim, c.siguiente)
      esc.actualizar(sim, 1, false)
      const pz = sim.pieza as PiezaTorno
      expect(sim.alarma).toBeNull()
      // El agujero de Ø10 empieza en la cara y llega hasta el fondo de la primera entrada.
      let iCara = pz.n - 1
      while (iCara > 0 && pz.ext[iCara] < 0.01) iCara--
      const zCara = pz.zDe(iCara)
      for (const d of [1, c.hasta / 2, c.hasta - 1]) expect(pz.int[pz.indice(zCara - d)]).toBeCloseTo(c.radio, 1)
      const perfil = perfilTorno(pz.ext, pz.int, pz.z0, 0.1)
      expect(perfil.some(([r]) => Math.abs(r - c.radio) < 1e-3)).toBe(true)
      // La malla que se dibuja tiene vértices sobre la pared del agujero y normales que miran al eje.
      const malla = esc.raiz.getObjectByName('pieza') as THREE.Mesh
      const pos = malla.geometry.getAttribute('position')
      const nor = malla.geometry.getAttribute('normal')
      let pared = 0
      let haciaElEje = 0
      for (let k = 0; k < pos.count; k++) {
        const r = Math.hypot(pos.getY(k), pos.getZ(k))
        if (Math.abs(r - c.radio) < 1e-3 && pos.getX(k) > zCara - c.hasta && pos.getX(k) < zCara + 0.01) {
          pared++
          // Una normal que va contra el vector radial mira al eje, como corresponde a la pared de un agujero.
          if (pos.getY(k) * nor.getY(k) + pos.getZ(k) * nor.getZ(k) < -0.5 * r) haciaElEje++
        }
      }
      expect(pared).toBeGreaterThan(10)
      expect(haciaElEje).toBeGreaterThan(0)
      // La cara tiene su corona: un vértice a la altura de la cara con radio entre el agujero y el exterior.
      let corona = false
      for (let k = 0; k < pos.count; k++) {
        const r = Math.hypot(pos.getY(k), pos.getZ(k))
        if (Math.abs(pos.getX(k) - zCara) < 0.06 && r >= c.radio - 1e-3 && r <= pz.bruto.diametro / 2 + 1e-3) corona = true
      }
      expect(corona).toBe(true)
      // Y nada la tapa: ningún vértice pasa de la cara ni cierra con un disco la boca del agujero.
      for (let k = 0; k < pos.count; k++) {
        const r = Math.hypot(pos.getY(k), pos.getZ(k))
        expect(pos.getX(k)).toBeLessThanOrEqual(zCara + 1e-3)
        if (pos.getX(k) > zCara - 0.06) expect(r).toBeGreaterThanOrEqual(c.radio - 1e-3)
      }
    }, LARGO)
  }
  it('al tronzar el buje, la parte que cae conserva el agujero', () => {
    const ej = ejemplosTorno.find((e) => e.id === 'torno-buje')!
    const { sim, esc } = armar(ej.codigo, configDe(ej))
    sim.terminar()
    esc.actualizar(sim, 1, false)
    const t = (sim.pieza as PiezaTorno).tronzada
    expect(t).not.toBeNull()
    expect(t!.int[Math.round(10 / 0.1)]).toBeCloseTo(5, 1)
    const caida = esc.raiz.getObjectByName('tronzada') as THREE.Mesh
    expect(caida).toBeDefined()
    const pos = caida.geometry.getAttribute('position')
    let pared = 0
    for (let k = 0; k < pos.count; k++) if (Math.abs(Math.hypot(pos.getY(k), pos.getZ(k)) - 5) < 1e-3) pared++
    expect(pared).toBeGreaterThan(10)
    // En las dos tapas del buje la boca del agujero queda abierta (nada cierra el centro).
    let xMin = Infinity
    let xMax = -Infinity
    for (let k = 0; k < pos.count; k++) {
      xMin = Math.min(xMin, pos.getX(k))
      xMax = Math.max(xMax, pos.getX(k))
    }
    for (let k = 0; k < pos.count; k++) {
      const r = Math.hypot(pos.getY(k), pos.getZ(k))
      if (pos.getX(k) < xMin + 0.06 || pos.getX(k) > xMax - 0.06) expect(r).toBeGreaterThanOrEqual(5 - 1e-3)
    }
    // El buje mide 30 mm de largo: de la cara al tronzado.
    expect(xMax - xMin).toBeGreaterThan(29)
    expect(xMax - xMin).toBeLessThan(31)
  }, LARGO)
  it('si la cara se refrentó antes de taladrar, el agujero queda abierto en la cara nueva', () => {
    const config: ConfigCNC = { ...CONFIG_INICIAL, maquina: 'torno', torno: { diametro: 30, largo: 40, agarre: 15, sobremetal: 1 } }
    const codigo = 'G21 G90 G94\nT0101\nM03 S1500\nG00 X34 Z0\nG01 X0 F120\nG00 X34 Z2\nG28\nT0808\nM03 S1000\nG00 X0 Z2\nG01 Z-10 F60\nG00 Z2\nG00 Z-9\nG01 Z-20 F60\nG00 Z2\nG28\nM05\nM30\n'
    const { sim, esc } = armar(codigo, config)
    sim.terminar()
    esc.actualizar(sim, 1, false)
    expect(sim.alarma).toBeNull()
    const pz = sim.pieza as PiezaTorno
    const perfil = perfilTorno(pz.ext, pz.int, pz.z0, 0.1)
    // El último punto con material es la cara refrentada y su agujero es de Ø10.
    const ultimo = Math.max(...perfil.map(([, z]) => z))
    expect(ultimo).toBeLessThanOrEqual(0.001)
    expect(perfil.filter(([, z]) => Math.abs(z - ultimo) < 1e-6).map(([r]) => r).sort((a, b) => a - b)[0]).toBeCloseTo(5, 3)
  }, LARGO)
})

describe('escena de la fresadora', () => {
  const ejemplos = EJEMPLOS_CNC.filter((e) => e.maquina === 'fresadora')
  for (const ej of ejemplos) {
    it(`${ej.titulo}: nada se atraviesa ni flota`, () => {
      const { sim, esc } = armar(ej.codigo, configDe(ej))
      const h = recorrer(sim, esc, 'fresadora', 80)
      expect(h.cuadros).toBeGreaterThan(10)
      expect(avisos(h)).toEqual([])
    }, LARGO)
  }
})

/** Programa corto con la herramienta `t`: baja en el centro y, si no es broca, recorre un rectángulo. */
function programaFresa(t: number, b: { largo: number; ancho: number; alto: number }): string {
  const f = HERRAMIENTAS_FRESA.find((x) => x.t === t)!
  const prof = Math.min(4, b.alto - 1)
  const cab = `G21 G90 G94\nT${t} M06\nM03 S1200\nG00 X${b.largo / 2} Y${b.ancho / 2} Z5\nG01 Z-${prof} F100\n`
  const lado = f.forma === 'broca' ? '' : `G01 X${b.largo * 0.8} F200\nG01 Y${b.ancho * 0.8}\nG01 X${b.largo * 0.2}\n`
  return `${cab}${lado}G00 Z10\nM05\nM30\n`
}

const BRUTOS_FRESA = [
  { largo: 50, ancho: 40, alto: 10 },
  { largo: 100, ancho: 80, alto: 20 },
  { largo: 200, ancho: 150, alto: 60 },
]

describe('escena de la fresadora: cada herramienta, en brutos chicos y grandes', () => {
  for (const fresa of BRUTOS_FRESA) {
    for (const f of HERRAMIENTAS_FRESA) {
      it(`T${f.t} ${f.nombre} con bruto ${fresa.largo} × ${fresa.ancho} × ${fresa.alto}`, () => {
        const config: ConfigCNC = { ...CONFIG_INICIAL, maquina: 'fresadora', fresa }
        const { sim, esc } = armar(programaFresa(f.t, fresa), config)
        const h = recorrer(sim, esc, 'fresadora', 40)
        expect(sim.alarma).toBeNull()
        expect(h.herramientas.has(f.t)).toBe(true)
        expect(h.cuadros).toBeGreaterThan(10)
        expect(avisos(h)).toEqual([])
      }, LARGO)
    }
  }
})
