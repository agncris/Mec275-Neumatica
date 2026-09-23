import { describe, expect, it } from 'vitest'
import { EJEMPLOS_CNC } from '../cnc/ejemplos'
import { analizarLinea, explicarBloque, interpretar } from '../cnc/gcode'
import { CONFIG_INICIAL, posicionCasa, type ConfigCNC } from '../cnc/maquinas'
import { PiezaFresa, PiezaTorno, SimuladorCNC } from '../cnc/simulador'

const TORNO: ConfigCNC = { ...CONFIG_INICIAL, maquina: 'torno' }
const FRESA: ConfigCNC = { ...CONFIG_INICIAL, maquina: 'fresadora' }

function correr(codigo: string, config: ConfigCNC) {
  const casa = posicionCasa(config)
  const r = interpretar(codigo, config.maquina, casa)
  const sim = new SimuladorCNC(r, config, casa)
  sim.terminar()
  return { r, sim }
}
const errores = (codigo: string, config = FRESA) =>
  interpretar(codigo, config.maquina, posicionCasa(config)).diagnosticos.filter((d) => d.nivel === 'error')

describe('ejemplos de CNC', () => {
  for (const ej of EJEMPLOS_CNC) {
    it(`${ej.titulo} corre sin errores ni alarmas`, () => {
      const config: ConfigCNC = { ...CONFIG_INICIAL, ...ej.config, maquina: ej.maquina }
      const { r, sim } = correr(ej.codigo, config)
      expect(r.diagnosticos.filter((d) => d.nivel !== 'info')).toEqual([])
      expect(sim.alarma).toBeNull()
      expect(sim.consejos).toEqual([])
      expect(sim.terminado).toBe(true)
      expect(r.sinComentario).toEqual([])
    })
  }
})

describe('lectura de bloques', () => {
  it('separa palabras y comentarios', () => {
    const a = analizarLinea('N10 G01 X-.5 Y+10 Z2. F150 ( cortar ) ; y más')
    expect(a.palabras.map((p) => p.texto)).toEqual(['N10', 'G01', 'X-.5', 'Y+10', 'Z2.', 'F150'])
    expect(a.palabras[2].valor).toBe(-0.5)
    expect(a.comentario).toBe('cortar · y más')
    expect(analizarLinea('%').vacia).toBe(true)
    expect(analizarLinea('$Millimeter').directiva).toBe('Millimeter')
  })
  it('explica lo que no entiende', () => {
    expect(errores('G21\nG01 X10 Y 1O F100')[0].texto).toMatch(/No entiendo «O»/)
  })
  it('explica cada palabra según el modo', () => {
    const r = interpretar('G21 G91\nG01 X10 F100', 'fresadora', posicionCasa(FRESA))
    const e = explicarBloque('G01 X10 F100', r.estados[1], 'fresadora')
    expect(e[0].texto).toMatch(/lineal/)
    expect(e[1].texto).toMatch(/Avanza \+10/)
    expect(e[2].texto).toMatch(/100 mm\/min/)
    const t = explicarBloque('G01 X30 Z-5', undefined, 'torno')
    expect(t[1].texto).toMatch(/Diámetro 30/)
  })
})

describe('intérprete de código G', () => {
  const casaF = posicionCasa(FRESA)
  it('coordenadas absolutas e incrementales', () => {
    const r = interpretar('G21 G90\nG00 X10 Y10 Z5\nG91\nG01 X5 Y-2 F100\nX5\nG90 X0\nU3 W-1\nM30', 'fresadora', casaF)
    expect(r.puntos.map((p) => [p.pos.x, p.pos.y, p.pos.z])).toEqual([
      [10, 10, 5],
      [15, 8, 5],
      [20, 8, 5],
      [0, 8, 5],
      [3, 8, 4],
    ])
  })
  it('pulgadas', () => {
    const r = interpretar('G20\nG00 X1 Y2\nM30', 'fresadora', casaF)
    expect(r.puntos[0].pos.x).toBeCloseTo(25.4)
    expect(r.puntos[0].pos.y).toBeCloseTo(50.8)
  })
  it('círculo completo con I/J y arco con R', () => {
    const r = interpretar('G21\nG00 X25 Y40 Z5\nG02 X25 Y40 I25 J0 F250\nG03 X60 Y40 R17.5\nM30', 'fresadora', casaF)
    const [circ, arco] = r.pasos.filter((p) => p.tipo === 'corte')
    expect(circ.largo).toBeCloseTo(2 * Math.PI * 25, 0)
    // G03 de 25,40 a 60,40 con R17.5: media vuelta por abajo (antihoraria).
    const medio = arco.puntos[Math.floor(arco.puntos.length / 2)]
    expect(medio.y).toBeCloseTo(40 - 17.5, 0)
    expect(arco.largo).toBeCloseTo(Math.PI * 17.5, 0)
    // En horario, el círculo pasa primero por arriba (Y mayor).
    expect(circ.puntos[Math.floor(circ.puntos.length / 4)].y).toBeGreaterThan(55)
  })
  it('arco que no cierra y radio imposible', () => {
    expect(errores('G21\nG00 X0 Y0\nG02 X10 Y0 I3 J0 F100')[0].texto).toMatch(/no cierra/)
    expect(errores('G21\nG00 X0 Y0\nG02 X10 Y0 R2 F100')[0].texto).toMatch(/muy chico/)
  })
  it('falta el avance, dos movimientos, letra repetida', () => {
    expect(errores('G21\nG01 X10')[0].texto).toMatch(/Falta el avance F/)
    expect(errores('G21\nG00 G01 X10 F10')[0].texto).toMatch(/dos movimientos/)
    expect(errores('G21\nG01 X10 X20 F10')[0].texto).toMatch(/dos veces/)
  })
  it('el torno no tiene eje Y y X es diámetro', () => {
    expect(errores('G21\nG00 Y5', TORNO)[0].texto).toMatch(/no tiene eje Y/)
    const r = interpretar('G21\nG00 X40 Z2\nG01 U-10 W-5 F100\nM30', 'torno', posicionCasa(TORNO))
    expect(r.puntos[1].pos).toMatchObject({ x: 30, z: -3 })
  })
  it('arco en el torno: G03 de la punta al diámetro (plano Z-X)', () => {
    const r = interpretar('G21\nG00 X0 Z0\nG03 X30 Z-15 R15 F100\nM30', 'torno', posicionCasa(TORNO))
    const arco = r.pasos.find((p) => p.codigo === 'G03')!
    const medio = arco.puntos[Math.floor(arco.puntos.length / 2)]
    // A mitad de la media esfera: radio 15·sen45 ≈ 10,6 (Ø21,2) y Z ≈ −4,4.
    expect(medio.x).toBeCloseTo(21.2, 0)
    expect(medio.z).toBeCloseTo(-4.4, 0)
  })
  it('avisos: unidades, fin de programa y líneas después del fin', () => {
    const r = interpretar('G00 X1\nM30\nG00 X2', 'fresadora', casaF)
    const textos = r.diagnosticos.map((d) => d.texto).join(' | ')
    expect(textos).toMatch(/No indicas las unidades/)
    expect(textos).toMatch(/después del fin de programa/)
    expect(interpretar('G21\nG00 X1', 'fresadora', casaF).diagnosticos.some((d) => /Falta el fin/.test(d.texto))).toBe(true)
  })
  it('con errores, corre sólo hasta la línea anterior', () => {
    const r = interpretar('G21\nG00 X1\nG00 X2\nG01 X3\nG00 X4', 'fresadora', casaF)
    expect(r.primerError).toBe(3)
    expect(r.pasos.every((p) => p.linea < 3)).toBe(true)
  })
  it('herramientas, G04, G28 y tiempos', () => {
    const r = interpretar('G21\nT2 M06\nM03 S1000\nG04 X2\nG00 X100 Y0 Z50\nG28\nM30', 'fresadora', casaF)
    expect(r.pasos.find((p) => p.codigo === 'T2')).toBeTruthy()
    expect(r.pasos.find((p) => p.codigo === 'G04')!.duracion).toBe(2)
    expect(r.puntos[r.puntos.length - 1].pos).toEqual(casaF)
    // Rápido de 100 mm a 5000 mm/min = 1,2 s.
    expect(r.pasos.find((p) => p.codigo === 'G00')!.duracion).toBeCloseTo(1.2)
    const t = interpretar('G21\nT0909\nM03 S800', 'torno', posicionCasa(TORNO))
    expect(t.pasos.find((p) => p.tipo === 'herramienta')!.herramienta).toBe(9)
  })
  it('ciclo G81 en varios agujeros', () => {
    const r = interpretar('G21\nT5 M06\nM03 S1000\nG00 X10 Y10 Z10\nG99 G81 X10 Y10 Z-5 R2 F80\nX30\nG80\nM30', 'fresadora', casaF)
    const bajadas = r.pasos.filter((p) => p.tipo === 'corte')
    expect(bajadas).toHaveLength(2)
    expect(bajadas[1].puntos[1]).toMatchObject({ x: 30, y: 10, z: -5 })
  })
})

describe('simulación de mecanizado', () => {
  it('cilindrado: el diámetro queda como se programó', () => {
    const { sim } = correr('G21\nT0101\nM03 S1500\nG00 X36 Z2\nG01 Z-20 F200\nG00 X42\nM30', TORNO)
    const pz = sim.pieza as PiezaTorno
    expect(pz.ext[pz.indice(-10)] * 2).toBeCloseTo(36, 1)
    expect(pz.ext[pz.indice(-25)] * 2).toBeCloseTo(40, 1)
    expect(sim.alarma).toBeNull()
  })
  it('alarma: entrar al material en rápido', () => {
    const { sim } = correr('G21\nT0101\nM03 S1500\nG00 X30 Z-10\nM30', TORNO)
    expect(sim.alarma?.texto).toMatch(/rápido/)
    expect(sim.alarma?.linea).toBe(3)
  })
  it('alarma: cortar con el husillo detenido', () => {
    const { sim } = correr('G21\nT0101\nG00 X36 Z2\nG01 Z-20 F200\nM30', TORNO)
    expect(sim.alarma?.texto).toMatch(/husillo detenido/)
  })
  it('alarma: chocar con las garras', () => {
    // Bruto de 90 mm con 25 en las garras: las garras llegan hasta Z-64.
    const { sim } = correr('G21\nT0101\nM03 S1500\nG00 X38 Z2\nG01 Z-70 F200\nM30', TORNO)
    expect(sim.alarma?.texto).toMatch(/garras/)
  })
  it('consejo: pasada de más de 5 mm en diámetro', () => {
    const { sim } = correr('G21\nT0101\nM03 S1500\nG00 X28 Z2\nG01 Z-10 F200\nG00 X42\nM30', TORNO)
    expect(sim.alarma).toBeNull()
    expect(sim.consejos[0].texto).toMatch(/12\.0 mm en diámetro/)
  })
  it('tronzado: la pieza se separa con el largo programado', () => {
    const { sim } = correr('G21\nT0909\nM03 S800\nG00 X42 Z-30\nG01 X0 F80\nG00 X44\nM30', TORNO)
    const pz = sim.pieza as PiezaTorno
    expect(pz.tronzada).not.toBeNull()
    expect(pz.tronzada!.z).toBeCloseTo(-30, 0)
  })
  it('fresadora: cajera a la profundidad programada', () => {
    const { sim } = correr('G21\nT1 M06\nM03 S1500\nG00 X20 Y20 Z2\nG01 Z-3 F100\nG01 X60 F300\nG00 Z5\nM30', FRESA)
    const pz = sim.pieza as PiezaFresa
    const h = (x: number, y: number) => pz.h[Math.round(y / pz.celda) * pz.nx + Math.round(x / pz.celda)]
    expect(h(40, 20)).toBeCloseTo(-3, 2)
    expect(h(40, 24)).toBeCloseTo(-3, 2)
    expect(h(40, 26)).toBe(0)
    expect(h(80, 20)).toBe(0)
  })
  it('fresadora: la broca no se mueve de lado y no se corta la mesa', () => {
    expect(correr('G21\nT5 M06\nM03 S1000\nG00 X20 Y20 Z2\nG01 Z-5 F80\nG01 X30\nM30', FRESA).sim.alarma?.texto).toMatch(/broca/)
    expect(correr('G21\nT1 M06\nM03 S1000\nG00 X20 Y20 Z2\nG01 Z-25 F80\nM30', FRESA).sim.alarma?.texto).toMatch(/mesa/)
  })
  it('M00 detiene hasta continuar', () => {
    const casa = posicionCasa(FRESA)
    const r = interpretar('G21\nG00 X10\nM00\nG00 X20\nM30', 'fresadora', casa)
    const sim = new SimuladorCNC(r, FRESA, casa)
    expect(sim.avanzar(100)).toBe('parada')
    expect(sim.pos.x).toBe(10)
    sim.continuar()
    expect(sim.avanzar(100)).toBe('fin')
    expect(sim.pos.x).toBe(20)
  })
  it('bloque a bloque se detiene al cambiar de línea', () => {
    const casa = posicionCasa(FRESA)
    const r = interpretar('G21\nG00 X10\nG00 X20\nG00 X30\nM30', 'fresadora', casa)
    const sim = new SimuladorCNC(r, FRESA, casa)
    expect(sim.avanzar(100, true)).toBe('fin-bloque')
    expect(sim.pos.x).toBe(10)
    // Aunque el bloque dure muchos fotogramas, se detiene al terminarlo.
    let res = sim.avanzar(0.01, true)
    let n = 0
    while (res === 'sigue' && n++ < 1000) res = sim.avanzar(0.01, true)
    expect(res).toBe('fin-bloque')
    expect(sim.pos.x).toBe(20)
  })
})
