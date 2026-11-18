/**
 * MecBot ofrece, cuando corresponde, el enlace a la sección de Estudiar que complementa la respuesta.
 */
import { describe, expect, it } from 'vitest'
import { enlacesDe, FICHAS, urlEstudiar } from '../../api/materia.js'
import fuenteNeumatica from '../components/estudio/EstudiarNeumatica.tsx?raw'
import { ANCLAS_ESTUDIAR_CNC } from '../cnc/anclasEstudiar'
import { ANCLAS_ESTUDIAR_PLC } from '../plc/anclasEstudiar'
import { ANCLAS_ESTUDIAR_ROBOT } from '../robot/anclasEstudiar'

const idsNeumatica = [...fuenteNeumatica.matchAll(/\{ id: '([^']+)'/g)].map((m) => m[1])
const ANCLAS: Record<string, string[]> = { Robótica: ANCLAS_ESTUDIAR_ROBOT, CNC: ANCLAS_ESTUDIAR_CNC, PLC: ANCLAS_ESTUDIAR_PLC, Neumática: idsNeumatica }

describe('enlaces de MecBot a Estudiar', () => {
  it('cada ficha apunta a una sección que existe en su unidad', () => {
    for (const f of FICHAS as unknown as Array<{ unidad: string; ancla: string; titulo: string }>) {
      if (/instalar el software/i.test(f.titulo)) continue
      expect(ANCLAS[f.unidad], `${f.unidad} no existe`).toBeTruthy()
      expect(ANCLAS[f.unidad], `${f.unidad} · ${f.titulo}: la sección «${f.ancla}» no existe en Estudiar`).toContain(f.ancla)
    }
  })

  it('una pregunta de la materia trae el enlace a su sección', () => {
    expect(enlacesDe('¿Qué es una singularidad?')[0].url).toBe('/?unidad=robotica&vista=estudiar#grados')
    expect(enlacesDe('cómo funciona el método cascada')[0].url).toBe('/?unidad=neumatica&vista=estudiar#cascada')
    expect(enlacesDe('qué es un scan en el PLC')[0].url).toBe('/?unidad=plc&vista=estudiar#scan')
    expect(enlacesDe('qué hace el bloque Offset')[0].url).toBe('/?unidad=robotica&vista=estudiar#parametrica')
  })

  it('«explícame robótica» lleva a Estudiar de la unidad', () => {
    expect(enlacesDe('explícame robótica')).toEqual([{ unidad: 'Robótica', titulo: 'Estudiar · Robótica', url: '/?unidad=robotica&vista=estudiar' }])
  })

  it('sin calce con la materia no hay enlace, y nunca más de dos', () => {
    expect(enlacesDe('hola')).toEqual([])
    expect(enlacesDe('')).toEqual([])
    expect(enlacesDe('¿qué es el código G02?').length).toBeLessThanOrEqual(2)
  })

  it('urlEstudiar solo conoce las cuatro unidades', () => {
    expect(urlEstudiar('Nada', 'x')).toBeNull()
  })
})
