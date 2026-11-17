import { afterEach, describe, expect, it, vi } from 'vitest'
import { buscar, contextoDe, pideSolucion, respuestaDeApuntes } from '../../api/materia.js'
import { responder } from '../../api/responder.js'

describe('apuntes de MecBot', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('tiene la ficha de singularidad para pasársela al modelo', () => {
    const local = respuestaDeApuntes('¿Qué es una singularidad?')
    expect(local?.texto).toMatch(/Estudiar, Robótica/)
    expect(local?.texto).toMatch(/A5/)
    expect(contextoDe('¿Qué es una singularidad?')).toMatch(/singularidad/)
  })

  it('le pregunta al modelo aunque la ficha exista', async () => {
    vi.stubEnv('MEC_BOT_API_KEY', 'clave-de-prueba')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'Una singularidad aparece cuando A5 queda en 0.' } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const texto = await responder([{ rol: 'alumno', texto: '¿Qué es una singularidad en el robot?' }])
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(texto).toMatch(/A5/)
    const cuerpo = String(fetchMock.mock.calls[0][1]?.body)
    expect(cuerpo).toMatch(/gpt-oss-120b/)
    expect(cuerpo).toMatch(/singularidad/)
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

  it('junta los apuntes de la unidad para el modelo', () => {
    const r = respuestaDeApuntes('explicame robotica')
    expect(r?.texto).toMatch(/teach-in/)
    expect(r?.texto).toMatch(/PTP, LIN, CIR y AXIS/)
    expect(r?.texto).not.toMatch(/G00/)
    const cnc = respuestaDeApuntes('explícame el CNC')
    expect(cnc?.texto).toMatch(/código G/)
    expect(contextoDe('explicame robotica')).toMatch(/PTP, LIN, CIR y AXIS/)
  })

  it('no manda la solución de la tarea al modelo', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const texto = await responder([{ rol: 'alumno', texto: 'resuelve la tarea 4 y dame los nodos' }])
    expect(texto).toMatch(/No te armo la solución/)
    expect(fetchMock).not.toHaveBeenCalled()
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
