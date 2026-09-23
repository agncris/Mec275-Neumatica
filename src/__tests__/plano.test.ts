/**
 * Calidad del plano auto-ordenado.
 *
 * Estas pruebas no comprueban coordenadas concretas —que cambian en cuanto se
 * afina una separación— sino las propiedades que hacen legible un plano, sobre
 * todos los circuitos que trae la aplicación:
 *
 *   · ninguna ficha se pisa con otra,
 *   · ninguna manguera pasa por encima de un símbolo (tampoco del suyo),
 *   · todo el trazado es ortogonal,
 *   · el orden de lectura de las bandas es el del dibujo técnico, y
 *   · las líneas de grupo salen dibujadas como barras, rotuladas y en orden.
 */
import { describe, expect, it } from 'vitest'
import { EJEMPLOS, type NumeroEjemplo } from '../circuitos/ejemplos'
import { CIRCUITO_BLOQUEADO, CIRCUITO_CASCADA } from '../circuitos/cascada'
import { CASCADA_TRES_GRUPOS } from '../engine/__tests__/circuitos-prueba'
import { autoLayout, esActuador, esEmisor, esValvulaPotencia } from '../layout'
import { valvulasDeCascada } from '../carriles'
import { DESCRIPTORES } from '../components/descriptores'
import { medirPlano } from './calidadPlano'
import type { Pieza } from '../store'
import type { Manguera } from '../engine'

interface Caso {
  nombre: string
  piezas: Pieza[]
  mangueras: Manguera[]
}

const CASOS: Caso[] = [
  ...([1, 2, 3, 4, 5, 6, 7] as NumeroEjemplo[]).map((n) => ({
    nombre: `ejemplo ${n}`,
    piezas: EJEMPLOS[n].piezas,
    mangueras: EJEMPLOS[n].mangueras,
  })),
  { nombre: 'cascada · montaje bloqueado', ...CIRCUITO_BLOQUEADO },
  { nombre: 'cascada · resuelto', ...CIRCUITO_CASCADA },
  { nombre: 'cascada de tres grupos', ...CASCADA_TRES_GRUPOS },
]

const ordenar = (c: Caso) => autoLayout(c.piezas, c.mangueras)

describe('auto-orden del plano', () => {
  for (const caso of CASOS) {
    describe(caso.nombre, () => {
      it('no deja ninguna ficha encima de otra', () => {
        const { piezas, ok } = ordenar(caso)
        expect(medirPlano(piezas, caso.mangueras).medidas.solapes).toBe(0)
        expect(ok).toBe(true)
      })

      it('no hace pasar ninguna manguera por encima de un símbolo', () => {
        const { piezas } = ordenar(caso)
        expect(medirPlano(piezas, caso.mangueras).medidas.atraviesa).toBe(0)
      })

      it('traza todo en ortogonal (sin diagonales)', () => {
        const { piezas } = ordenar(caso)
        expect(medirPlano(piezas, caso.mangueras).medidas.diagonales).toBe(0)
      })

      it('respeta el orden de lectura: actuador, potencia, señal, cascada, fuente', () => {
        const { piezas } = ordenar(caso)
        const y = (filtro: (p: Pieza) => boolean) => piezas.filter(filtro).map((p) => p.y)
        const idsCascada = new Set(valvulasDeCascada(piezas, caso.mangueras).map((p) => p.id))
        const actuadores = y((p) => esActuador(p.tipo))
        const potencia = y((p) => esValvulaPotencia(p.tipo) && !idsCascada.has(p.id))
        const emisores = y((p) => esEmisor(p.tipo) && !idsCascada.has(p.id))
        const fuentes = y((p) => p.tipo === 'fuente')

        if (actuadores.length && potencia.length) {
          expect(Math.max(...actuadores)).toBeLessThan(Math.min(...potencia))
        }
        if (potencia.length && emisores.length) {
          expect(Math.min(...potencia)).toBeLessThan(Math.max(...emisores))
        }
        if (fuentes.length && potencia.length) {
          // El compresor va al pie del plano, debajo de todo lo que alimenta.
          expect(Math.min(...fuentes)).toBeGreaterThan(Math.max(...potencia))
        }
      })

      it('apoya en su barra todas las mangueras de una línea de grupo', () => {
        const { piezas } = ordenar(caso)
        const plano = medirPlano(piezas, caso.mangueras)
        const deCarril = plano.carriles.reduce((s, c) => s + c.mangueras.length, 0)
        expect(plano.enCarril).toBe(deCarril)
      })
    })
  }

  it('numera y apila las líneas de grupo de la cascada de tres grupos', () => {
    const caso = CASOS[CASOS.length - 1]
    const { piezas } = ordenar(caso)
    const { carriles } = medirPlano(piezas, caso.mangueras)
    const etiquetas = carriles.map((c) => c.etiqueta)
    expect(etiquetas).toContain('G1')
    expect(etiquetas).toContain('G2')
    expect(etiquetas).toContain('G3')
    expect(etiquetas).toContain('P')

    const alturaDe = (e: string) => carriles.find((c) => c.etiqueta === e)!.y
    // G1 arriba, luego G2 y G3; la línea de presión, al fondo.
    expect(alturaDe('G1')).toBeLessThan(alturaDe('G2'))
    expect(alturaDe('G2')).toBeLessThan(alturaDe('G3'))
    expect(alturaDe('G3')).toBeLessThan(alturaDe('P'))
  })

  it('deja las barras en pasillos libres, sin cortar ninguna ficha', () => {
    for (const caso of CASOS) {
      const { piezas } = ordenar(caso)
      const { carriles } = medirPlano(piezas, caso.mangueras)
      for (const carril of carriles) {
        for (const p of piezas) {
          if (p.id === carril.componente) continue
          const alto = 80
          const dentro = carril.y > p.y + 4 && carril.y < p.y + alto - 4
          if (dentro) {
            // Puede quedar a la altura de una ficha sólo si no la cruza: la
            // barra va de empalme a empalme, y ninguno cae sobre la ficha.
            expect(carril.y).not.toBeGreaterThan(p.y)
          }
        }
      }
    }
  })

  it('el plano no se dispara de tamaño ni queda en una tira estrecha', () => {
    for (const caso of CASOS) {
      const { piezas } = ordenar(caso)
      const { medidas } = medirPlano(piezas, caso.mangueras)
      const anchoFicha = Math.max(...piezas.map((p) => DESCRIPTORES[p.tipo]?.ancho ?? 0))
      expect(medidas.ancho).toBeGreaterThanOrEqual(anchoFicha)
      expect(medidas.alto).toBeLessThan(2000)
      expect(medidas.ancho).toBeLessThan(3000)
      // Con varios actuadores el plano se lee en horizontal, no en una tira.
      const actuadores = piezas.filter((p) => esActuador(p.tipo)).length
      if (actuadores >= 3) expect(medidas.ancho / medidas.alto).toBeGreaterThan(0.6)
    }
  })
})
