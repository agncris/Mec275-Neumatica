import { afterEach, describe, expect, it, vi } from 'vitest'
import { anonimizar, datosDeRegistro, filaDeRegistro, registrar } from '../../api/registro.js'

describe('registro de MecBot', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('borra correos, RUT y teléfonos antes de guardar', () => {
    const t = anonimizar('soy juan.perez@usm.cl, rut 12.345.678-9, fono +56 9 8765 4321. ¿Qué es PTP?')
    expect(t).not.toMatch(/juan|12\.345|8765/)
    expect(t).toContain('[correo]')
    expect(t).toContain('[rut]')
    expect(t).toContain('[teléfono]')
    expect(t).toContain('¿Qué es PTP?')
  })

  it('no toca números de la materia', () => {
    expect(anonimizar('La plancha mide 5 mm y el robot llega a 901 mm, 50.000 envases')).toBe('La plancha mide 5 mm y el robot llega a 901 mm, 50.000 envases')
  })

  it('valida lo que manda el navegador', () => {
    expect(datosDeRegistro({ unidad: 'robotica', conversacion: 'abc123def4', guardar: true })).toEqual({ unidad: 'robotica', conversacion: 'abc123def4', guardar: true })
    expect(datosDeRegistro({ unidad: 'otra', conversacion: '<script>', guardar: 'no' })).toEqual({ unidad: null, conversacion: null, guardar: true })
    expect(datosDeRegistro({ guardar: false }).guardar).toBe(false)
    expect(datosDeRegistro(null).guardar).toBe(true)
  })

  it('la fila no lleva IP ni datos del alumno', () => {
    const fila = filaDeRegistro('¿Qué es LIN?', 'Línea recta.', { unidad: 'robotica', conversacion: 'abc123def4', guardar: true })
    expect(Object.keys(fila).sort()).toEqual(['conversacion', 'fecha', 'pregunta', 'respuesta', 'unidad'])
  })

  it('manda la fila a Supabase y respeta «No guardar»', async () => {
    vi.stubEnv('MEC_BOT_REGISTRO', '')
    vi.stubEnv('MEC_BOT_SUPABASE_URL', 'https://ejemplo.supabase.co')
    vi.stubEnv('MEC_BOT_SUPABASE_KEY', 'clave-de-prueba')
    const llamado = vi.fn(async () => new Response(null, { status: 201 }))
    vi.stubGlobal('fetch', llamado)

    await registrar('¿Qué es CIR?', 'Un arco.', { unidad: 'robotica', conversacion: null, guardar: false })
    expect(llamado).not.toHaveBeenCalled()

    await registrar('¿Qué es CIR?', 'Un arco.', { unidad: 'robotica', conversacion: null, guardar: true })
    expect(llamado).toHaveBeenCalledTimes(1)
    const [url, opciones] = llamado.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://ejemplo.supabase.co/rest/v1/mecbot_registro')
    expect(JSON.parse(String(opciones.body))).toMatchObject({ pregunta: '¿Qué es CIR?', respuesta: 'Un arco.', unidad: 'robotica' })
  })

  it('si Supabase falla, no lanza', async () => {
    vi.stubEnv('MEC_BOT_SUPABASE_URL', 'https://ejemplo.supabase.co')
    vi.stubEnv('MEC_BOT_SUPABASE_KEY', 'clave-de-prueba')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sin red') }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(registrar('a', 'b', {})).resolves.toBeUndefined()
  })
})
