import { afterEach, describe, expect, it, vi } from 'vitest'
import { buscar, contextoDe, pideSolucion, respuestaDeApuntes } from '../../api/materia.js'
import { atender, responder } from '../../api/responder.js'

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
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({
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

  it('pide al modelo una guía y no corta con el muro', async () => {
    vi.stubEnv('MEC_BOT_API_KEY', 'clave-de-prueba')
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{ message: { content: 'El siguiente paso es Offset en el contorno. ¿Qué bloques tienes ya en el lienzo?' } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const texto = await responder([{ rol: 'alumno', texto: 'dime como resolver la tarea' }])
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(texto).not.toMatch(/No te armo la solución/)
    expect(texto).toMatch(/Offset/)
    const cuerpo = String(fetchMock.mock.calls[0][1]?.body)
    expect(cuerpo).toMatch(/siguiente paso/)
    expect(cuerpo).toMatch(/10 trazos/)
    expect(cuerpo).toMatch(/JSON/)
    expect(cuerpo).not.toMatch(/Instalar el software/)
  })

  it('no inventa una respuesta si la pregunta no está en los apuntes', () => {
    expect(respuestaDeApuntes('xyzzy foobar cuántico')).toBeNull()
    expect(buscar('xyzzy foobar cuántico')).toHaveLength(0)
  })

  it('deja pasar la pregunta de la tarea y no ofrece instalar software', () => {
    expect(pideSolucion('dame la solución de la tarea de robótica')).toBe(true)
    expect(respuestaDeApuntes('resuelve la tarea 4 y dame los nodos')).toBeNull()
    expect(pideSolucion('qué es una singularidad en el robot')).toBe(false)
    expect(pideSolucion('cómo hago la tarea')).toBe(false)
    const panorama = respuestaDeApuntes('explicame robotica')
    expect(panorama?.texto).not.toMatch(/Instalar el software/)
    expect(contextoDe('explicame robotica')).not.toMatch(/Instalar el software/)
    expect(contextoDe('explicame robotica')).toMatch(/Código KRL/)
  })
})

describe('atender: la respuesta HTTP de MecBot', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('una petición sin mensajes da 400', async () => {
    expect(await atender(null, 'ip-1')).toEqual({ status: 400, json: { error: 'mensaje' } })
    expect(await atender({ mensajes: [] }, 'ip-1')).toEqual({ status: 400, json: { error: 'mensaje' } })
  })

  it('sin clave del modelo da 503', async () => {
    vi.stubEnv('MEC_BOT_API_KEY', '')
    const r = await atender({ mensajes: [{ rol: 'alumno', texto: 'pregunta que nadie ha hecho antes 8271' }] }, 'ip-2')
    expect(r).toEqual({ status: 503, json: { error: 'sin-clave' } })
  })

  it('una respuesta del modelo sale como { texto } con 200', async () => {
    vi.stubEnv('MEC_BOT_API_KEY', 'clave-de-prueba')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Respuesta de prueba.' } }] }), { status: 200 })))
    const r = await atender({ mensajes: [{ rol: 'alumno', texto: 'otra pregunta distinta 5530' }] }, 'ip-3')
    expect(r).toEqual({ status: 200, json: { texto: 'Respuesta de prueba.' } })
  })

  it('un fallo inesperado da 502 con el código red', async () => {
    vi.stubEnv('MEC_BOT_API_KEY', 'clave-de-prueba')
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('sin red')
    }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await atender({ mensajes: [{ rol: 'alumno', texto: 'pregunta con la red caída 9904' }] }, 'ip-4')
    expect(r).toEqual({ status: 502, json: { error: 'red' } })
  })
})
