/**
 * Nomenclatura ISO 1219-1 de los símbolos.
 *
 * Un símbolo mal dibujado enseña mal, así que lo que se comprueba aquí no es
 * la estética sino la norma:
 *
 *   · toda posición de una válvula representa TODOS sus puertos —los que
 *     comunican, con su vía; los que no, con el trazo de bloqueo—,
 *   · el pilotaje neumático se dibuja con el triángulo que lo identifica,
 *   · el pulsador y el muelle son los de la norma, y
 *   · los puertos de los actuadores no se rotulan (eso es de ISO 1219-2 y se
 *     presta a confundir el puerto A con el actuador A).
 *
 * Los símbolos se renderizan a SVG estático y se cuentan sus marcas `data-iso`.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SimboloPieza } from '../symbols/Simbolos'
import type { Params } from '../engine'

const dibujar = (tipo: string, params: Params = {}) =>
  renderToStaticMarkup(<SimboloPieza tipo={tipo} params={params} vivo={null} />)

const contar = (svg: string, marca: string) =>
  svg.split(`data-iso="${marca}"`).length - 1

/** Los rótulos de puerto que lleva dibujado un símbolo. */
const rotulos = (svg: string) =>
  [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1])

describe('nomenclatura de las válvulas distribuidoras', () => {
  it('la 3/2 dibuja una vía y un puerto bloqueado en cada posición', () => {
    for (const reposo of ['NC', 'NA']) {
      const svg = dibujar('valvula32', { reposo, accionamiento: 'pulsador' })
      expect(contar(svg, 'via')).toBe(2)
      expect(contar(svg, 'bloqueo')).toBe(2)
    }
  })

  it('la 5/2 dibuja dos vías y el escape bloqueado en cada posición', () => {
    const svg = dibujar('valvula52', { modo: 'biestable' })
    // 2 posiciones × 2 vías; en cada una queda un escape sin usar (5 y 3).
    expect(contar(svg, 'via')).toBe(4)
    expect(contar(svg, 'bloqueo')).toBe(2)
  })

  it('la 4/2 dibuja dos vías por posición y no bloquea ninguna: usa sus cuatro puertos', () => {
    const svg = dibujar('valvula42', { modo: 'biestable' })
    expect(contar(svg, 'via')).toBe(4)
    expect(contar(svg, 'bloqueo')).toBe(0)
  })

  it('rotula los puertos con la numeración ISO', () => {
    expect(rotulos(dibujar('valvula32', { reposo: 'NC' }))).toEqual(
      expect.arrayContaining(['1', '2', '3']),
    )
    const cinco = rotulos(dibujar('valvula52', { modo: 'biestable' }))
    expect(cinco).toEqual(expect.arrayContaining(['1', '2', '3', '4', '5', '12', '14']))
  })
})

describe('nomenclatura de los accionamientos', () => {
  it('el pilotaje neumático es un triángulo, no un rectángulo con diagonal', () => {
    const svg = dibujar('valvula52', { modo: 'biestable' })
    expect(contar(svg, 'pilotaje')).toBe(2) // 14 y 12
    // El triángulo es lo que identifica que la señal es de aire.
    const trozo = svg.slice(svg.indexOf('data-iso="pilotaje"'))
    expect(trozo).toContain('<polygon')
  })

  it('una monoestable lleva pilotaje o pulsador a un lado y muelle al otro', () => {
    const pilotada = dibujar('valvula52', { modo: 'monoestable', accionamiento: 'pilotaje' })
    expect(contar(pilotada, 'pilotaje')).toBe(1)
    expect(contar(pilotada, 'muelle')).toBe(1)

    const pulsador = dibujar('valvula52', { modo: 'monoestable', accionamiento: 'pulsador' })
    expect(contar(pulsador, 'pulsador')).toBe(1)
    expect(contar(pulsador, 'muelle')).toBe(1)
    expect(contar(pulsador, 'pilotaje')).toBe(0)
  })

  it('el final de carrera se acciona por rodillo y vuelve por muelle', () => {
    const svg = dibujar('finalCarrera', { reposo: 'NC' })
    expect(contar(svg, 'rodillo')).toBe(1)
    expect(contar(svg, 'muelle')).toBe(1)
    expect(contar(svg, 'pulsador')).toBe(0)
  })

  it('la 3/2 de mando manual lleva pulsador, no rodillo', () => {
    const svg = dibujar('valvula32', { reposo: 'NC', accionamiento: 'pulsador' })
    expect(contar(svg, 'pulsador')).toBe(1)
    expect(contar(svg, 'rodillo')).toBe(0)
  })
})

describe('nomenclatura de los actuadores', () => {
  it('no rotula los puertos del cilindro (la vía la da su válvula)', () => {
    for (const tipo of ['cilindroDobleEfecto', 'cilindroSimpleEfecto', 'actuadorGiratorio']) {
      const textos = rotulos(dibujar(tipo, {}))
      expect(textos).not.toContain('A')
      expect(textos).not.toContain('B')
      expect(textos).not.toContain('1')
    }
  })

  it('el actuador giratorio se dibuja con su cúpula y su eje, no como un manómetro', () => {
    const svg = dibujar('actuadorGiratorio', { angulo: 180 })
    // Cúpula: un arco cerrado sobre una base plana.
    expect(svg).toMatch(/<path[^>]*d="M33,82 A32,32 0 0 1 97,82 Z"/)
    // Y sin la lectura numérica, que no es parte del símbolo.
    expect(rotulos(svg).join(' ')).not.toContain('°')
  })
})
