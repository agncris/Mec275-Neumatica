/**
 * La guía de la Tarea 3 (CNC) y de la Tarea 2 (PLC): el paso se deduce del trabajo y
 * «Te falta esto» avisa lo que está a medias, sin dar la solución.
 */
import { describe, expect, it } from 'vitest'
import { EJEMPLO_GUIADO_TORNO, pasoCnc, pistaCnc } from '../cnc/PlanoTarea'
import { ejemploGuiadoSilo, pasoSilo, pistaSilo } from '../plc/procesoSilo'
import { tareaVacia } from '../plc/datosPLC'
import { escalonVacio } from '../plc/ladder'

describe('CNC: «Te falta esto»', () => {
  it('un programa vacío o sin nada a medias no trae pista', () => {
    expect(pistaCnc('')).toBeUndefined()
    expect(pistaCnc('%\nG21\n%')).toBeUndefined()
    expect(pasoCnc('').pista).toBeUndefined()
  })

  it('avisa G20 en pulgadas, M03 sin S, un corte sin F y M30 sin M05', () => {
    expect(pistaCnc('G20 G90')).toMatch(/pulgadas/)
    expect(pistaCnc('G21\nM03')).toMatch(/velocidad S/)
    expect(pistaCnc('G21\nM03 S800\nG00 X40 Z2\nG01 Z-5')).toMatch(/avance F/)
    expect(pistaCnc('G21\nM03 S800\nG00 X40\nG01 Z-5 F100\nM30')).toMatch(/M05/)
  })

  it('no cuenta lo que está en comentarios', () => {
    expect(pistaCnc('G21\n( M03 sin velocidad )\nG00 X10')).toBeUndefined()
  })

  it('con todo en orden desaparece, y el paso no cambia', () => {
    const ok = 'G21\nM03 S800\nG00 X40\nG01 Z-5 F100\nM05\nM30'
    expect(pistaCnc(ok)).toBeUndefined()
    expect(pasoCnc(ok).id).toBe('revisar')
    expect(pasoCnc('G21\nM03').id).toBe('acercar')
    expect(pasoCnc('G21\nM03').pista).toMatch(/velocidad S/)
  })

  it('el ejemplo guiado no tiene nada a medias', () => {
    expect(pistaCnc(EJEMPLO_GUIADO_TORNO)).toBeUndefined()
  })
})

describe('PLC: «Te falta esto»', () => {
  const con = (f: (p: ReturnType<typeof tareaVacia>) => void) => {
    const p = tareaVacia()
    f(p)
    return p
  }
  const contacto = (p: ReturnType<typeof tareaVacia>, col: number, dir: string) => {
    p.escalones[0].celdas[0][col] = { tipo: 'contacto', modo: 'NA', dir }
  }

  it('la tarea en blanco no trae pista', () => {
    expect(pasoSilo(tareaVacia()).id).toBe('nombrar')
    expect(pasoSilo(tareaVacia()).pista).toBeUndefined()
  })

  it('avisa qué entradas faltan por nombrar, solo si ya hay algunas', () => {
    const p = con((x) => {
      x.simbolos = [
        { dir: 'I0.0', nombre: 'START', descripcion: '' },
        { dir: 'I0.1', nombre: 'STOP', descripcion: '' },
      ]
    })
    expect(pistaSilo(p, 'nombrar')).toBe('Falta el nombre de I0.3 (PROX) y I0.4 (LEVEL).')
  })

  it('en la marcha avisa lo que falta de START y STOP', () => {
    const p = con((x) => contacto(x, 0, 'I0.0'))
    expect(pistaSilo(p, 'marcha')).toMatch(/falta STOP/)
    const q = con((x) => contacto(x, 0, 'I0.1'))
    expect(pistaSilo(q, 'marcha')).toMatch(/falta START/)
  })

  it('avisa la marca que ningún contacto lee y la válvula sin PROX ni LEVEL', () => {
    const ej = ejemploGuiadoSilo()
    expect(pistaSilo(ej, 'cinta')).toMatch(/marca M quedó sin usar/)
    const p = ejemploGuiadoSilo()
    const e = escalonVacio()
    e.celdas[0][0] = { tipo: 'contacto', modo: 'NA', dir: 'M0.0' }
    e.bobinas[0] = { tipo: 'normal', dir: 'Q0.1' }
    p.escalones = [p.escalones[0], e]
    expect(pistaSilo(p, 'llenar')).toMatch(/La válvula Q0.1 no depende de PROX ni de LEVEL/)
  })

  it('en la prueba lista los pilotos que faltan', () => {
    const p = ejemploGuiadoSilo()
    const e = escalonVacio()
    e.celdas[0][0] = { tipo: 'contacto', modo: 'NA', dir: 'M0.0' }
    e.bobinas[0] = { tipo: 'normal', dir: 'Q0.2' }
    p.escalones = [p.escalones[0], e]
    expect(pistaSilo(p, 'probar')).toBe('Faltan pilotos: Q0.3 (FILL), Q0.4 (FULL).')
  })

  it('el paso se deduce igual que antes y la pista viaja en el paso', () => {
    // El ejemplo nombra START y STOP pero no PROX ni LEVEL: sigue en «nombrar», con su pista.
    const paso = pasoSilo(ejemploGuiadoSilo())
    expect(paso.id).toBe('nombrar')
    expect(paso.pista).toBe('Falta el nombre de I0.3 (PROX) y I0.4 (LEVEL).')
  })

  it('las pistas no dan la solución: no traen un programa ni una receta', () => {
    const textos = [pistaCnc('G21\nM03'), pistaSilo(ejemploGuiadoSilo(), 'cinta'), pasoSilo(ejemploGuiadoSilo()).pista].filter(Boolean) as string[]
    for (const t of textos) expect(t.length).toBeLessThan(120)
  })
})
