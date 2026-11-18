import { afterEach, describe, expect, it, vi } from 'vitest'
import { atender } from '../../api/responder.js'

const mensaje = (texto: string) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-sonnet-5-5',
  content: [{ type: 'text', text: texto }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
})

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } })

const pedir = (texto: string, ip: string) => atender({ mensajes: [{ rol: 'alumno', texto }] }, ip)

describe('MecBot con Claude', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('con clave de Claude pregunta a Claude Sonnet 5.5 con esfuerzo bajo', async () => {
    vi.stubEnv('MEC_BOT_CLAUDE_API_KEY', 'sk-ant-prueba')
    vi.stubEnv('MEC_BOT_CLAUDE_MODELO', '')
    vi.stubEnv('MEC_BOT_API_KEY', '')
    const fetchMock = vi.fn(async (..._args: unknown[]) => respuesta(mensaje('Soy MecBot con Claude.')))
    vi.stubGlobal('fetch', fetchMock)
    const r = await pedir('¿qué es una válvula 3/2? (claude 1)', '10.0.0.1')
    expect(r).toEqual({ status: 200, json: { texto: 'Soy MecBot con Claude.' } })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain('api.anthropic.com/v1/messages')
    const cuerpo = JSON.parse(String(init.body))
    expect(cuerpo.model).toBe('claude-sonnet-5-5')
    expect(cuerpo.output_config).toEqual({ effort: 'low' })
    expect(cuerpo.fallbacks).toBe('default')
    expect(cuerpo.messages[0]).toEqual({ role: 'user', content: '¿qué es una válvula 3/2? (claude 1)' })
  })

  it('si Claude falla y hay clave de Groq, responde Groq', async () => {
    vi.stubEnv('MEC_BOT_CLAUDE_API_KEY', 'sk-ant-prueba')
    vi.stubEnv('MEC_BOT_API_KEY', 'gsk-prueba')
    vi.stubEnv('MEC_BOT_URL', '')
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url).includes('anthropic')
        ? respuesta({ type: 'error', error: { type: 'invalid_request_error', message: 'x' } }, 400)
        : respuesta({ choices: [{ message: { content: 'Respaldo de Groq.' } }] }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const r = await pedir('¿qué es un cilindro de doble efecto? (claude 2)', '10.0.0.2')
    expect(r).toEqual({ status: 200, json: { texto: 'Respaldo de Groq.' } })
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('groq'))).toBe(true)
  })

  it('con solo clave de Claude, una clave inválida se informa como tal', async () => {
    vi.stubEnv('MEC_BOT_CLAUDE_API_KEY', 'sk-ant-mala')
    vi.stubEnv('MEC_BOT_API_KEY', '')
    vi.stubGlobal('fetch', vi.fn(async () => respuesta({ type: 'error', error: { type: 'authentication_error', message: 'x' } }, 401)))
    const r = await pedir('¿qué es un PLC? (claude 3)', '10.0.0.3')
    expect(r).toEqual({ status: 502, json: { error: 'clave-invalida' } })
  })
})
