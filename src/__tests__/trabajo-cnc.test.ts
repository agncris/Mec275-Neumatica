import { describe, expect, it } from 'vitest'
import { programaNuevo } from '../cnc/ejemplos'
import { CONFIG_INICIAL, torretaDe, HERRAMIENTAS_TORNO, type ConfigCNC } from '../cnc/maquinas'
import { crearTrabajo, leerTrabajo, revisarTrabajo, TAREA_3 } from '../cnc/trabajo'

const config: ConfigCNC = { ...CONFIG_INICIAL, maquina: 'torno', material: 'laton', torno: { diametro: 82, largo: 170, agarre: 25, sobremetal: 1 } }

describe('trabajo de CNC (.json)', () => {
  it('guarda programa, preparación, torreta, alumno y tarea, y se vuelve a leer igual', () => {
    const codigo = programaNuevo('torno')
    const texto = JSON.stringify(crearTrabajo({ nombre: 'Tarea 3', config, codigo, tarea: TAREA_3, alumno: { nombre: 'Ana Pérez', companero: 'Luis Soto' } }))
    const d = leerTrabajo(texto)
    expect(d.tarea).toBe(TAREA_3)
    expect(d.alumno).toEqual({ nombre: 'Ana Pérez', companero: 'Luis Soto' })
    expect(d.codigo).toBe(codigo)
    expect(d.config.torno).toEqual(config.torno)
    expect(d.config.material).toBe('laton')
    expect(d.torreta?.length).toBe(HERRAMIENTAS_TORNO.length)
    expect(torretaDe(d.config)).toEqual(HERRAMIENTAS_TORNO)
  })

  it('sin nombre de alumno no escribe «alumno», y los .json antiguos se siguen abriendo', () => {
    const nuevo = crearTrabajo({ config, codigo: 'G21', alumno: { nombre: '  ', companero: '' } })
    expect(nuevo.alumno).toBeUndefined()
    const viejo = JSON.stringify({ tipo: 'trabajo-cnc', version: 1, nombre: 'x', config, codigo: 'G21' })
    const d = leerTrabajo(viejo)
    expect(d.version).toBe(1)
    expect(d.codigo).toBe('G21')
  })

  it('usa la torreta guardada del alumno al reabrir', () => {
    const propia = HERRAMIENTAS_TORNO.map((h) => (h.t === 1 ? { ...h, nombre: 'Mi desbaste' } : h))
    const texto = JSON.stringify(crearTrabajo({ config: { ...config, herramientasTorno: propia }, codigo: 'G21' }))
    expect(torretaDe(leerTrabajo(texto).config).find((h) => h.t === 1)?.nombre).toBe('Mi desbaste')
  })

  it('rechaza lo que no es un trabajo de CNC', () => {
    expect(() => leerTrabajo('no es json')).toThrow(/json/i)
    expect(() => leerTrabajo(JSON.stringify({ tipo: 'programa-plc' }))).toThrow(/trabajo de CNC/)
    expect(() => leerTrabajo(JSON.stringify({ tipo: 'trabajo-cnc', config: {}, codigo: 'x' }))).toThrow(/trabajo de CNC/)
  })
})

describe('revisión del trabajo', () => {
  it('un programa vacío avisa que no mueve la herramienta', () => {
    const r = revisarTrabajo(config, programaNuevo('torno'))
    expect(r.puntos[0].ok).toBe(false)
    expect(r.datos.find(([k]) => k === 'Bruto')?.[1]).toMatch(/Ø82 × 170/)
  })

  it('un programa sano pasa la revisión y lista sus herramientas', () => {
    const codigo = `%
( prueba )
N10 G21 G90 G94          ( milímetros )
N20 T0101                ( desbaste )
N30 M03 S1500            ( husillo )
N40 G00 X84 Z2           ( acercar )
N50 G00 X78              ( pasada 1 )
N60 G01 Z-30 F200        ( cilindrar )
N70 G00 X84 Z2           ( retirar )
N900 G28                 ( referencia )
N910 M05                 ( parar )
N920 M30                 ( fin )
%
`
    const r = revisarTrabajo(config, codigo)
    expect(r.puntos.every((p) => p.ok)).toBe(true)
    expect(r.datos.find(([k]) => k === 'Herramientas usadas')?.[1]).toMatch(/^T1 /)
  })

  it('avisa de líneas sin comentario y de una alarma', () => {
    const r = revisarTrabajo(config, `%\nG21 G90\nT0101\nM03 S1500\nG00 X84 Z2\nG01 X20 F200\nM30\n%\n`)
    expect(r.puntos.find((p) => /sin comentario/.test(p.texto))?.ok).toBe(false)
  })
})
