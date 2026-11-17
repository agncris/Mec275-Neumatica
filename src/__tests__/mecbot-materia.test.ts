import { describe, expect, it } from 'vitest'
import { buscar, pideSolucion, respuestaDeApuntes } from '../../api/materia.js'
import { responder } from '../../api/responder.js'

describe('apuntes de MecBot', () => {
  it('responde singularidad desde robótica, sin modelo', async () => {
    const local = respuestaDeApuntes('¿Qué es una singularidad?')
    expect(local?.texto).toMatch(/Estudiar, Robótica/)
    expect(local?.texto).toMatch(/A5/)
    const texto = await responder([{ rol: 'alumno', texto: '¿Qué es una singularidad?' }])
    expect(texto).toMatch(/singularidad/)
    expect(texto).toMatch(/Estudiar, Robótica/)
  })

  it('distingue PTP de LIN y no se va a CNC', () => {
    const r = respuestaDeApuntes('diferencia entre PTP y LIN')
    expect(r?.texto).toMatch(/PTP mueve todos los ejes/)
    expect(r?.texto).not.toMatch(/G00/)
  })

  it('manda G00 a CNC', () => {
    const r = respuestaDeApuntes('para qué sirve G00')
    expect(r?.texto).toMatch(/Estudiar, CNC/)
    expect(r?.texto).toMatch(/avance rápido/)
  })

  it('no inventa una respuesta si la pregunta no está en los apuntes', () => {
    expect(respuestaDeApuntes('xyzzy foobar cuántico')).toBeNull()
    expect(buscar('xyzzy foobar cuántico')).toHaveLength(0)
  })

  it('no entrega la solución de la tarea', () => {
    expect(pideSolucion('dame la solución de la tarea de robótica')).toBe(true)
    const r = respuestaDeApuntes('resuelve la tarea 4 y dame los nodos')
    expect(r?.origen).toBe('reglas')
    expect(r?.texto).toMatch(/No te armo la solución/)
    expect(pideSolucion('qué es una singularidad en el robot')).toBe(false)
  })
})
