import { afterEach, describe, expect, it, vi } from 'vitest'
import { atenderPeticion, MAX_CUERPO, revisarPeticion } from '../../api/responder.js'

const JSON_OK = { 'content-type': 'application/json', host: 'mec275.vercel.app' }
const CUERPO = JSON.stringify({ mensajes: [{ rol: 'alumno', texto: 'hola' }] })

describe('MecBot: revisión de la petición', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('acepta una petición normal del propio sitio', () => {
    expect(revisarPeticion({ ...JSON_OK, origin: 'https://mec275.vercel.app' }, CUERPO)).toBeNull()
  })

  it('acepta localhost con cualquier puerto', () => {
    expect(revisarPeticion({ 'content-type': 'application/json', host: 'localhost:5173', origin: 'http://localhost:5173' }, CUERPO)).toBeNull()
    expect(revisarPeticion({ ...JSON_OK, origin: 'http://127.0.0.1:3000' }, CUERPO)).toBeNull()
    expect(revisarPeticion({ ...JSON_OK, origin: 'http://[::1]:4173' }, CUERPO)).toBeNull()
  })

  it('acepta Content-Type con charset', () => {
    expect(revisarPeticion({ ...JSON_OK, 'content-type': 'application/json; charset=utf-8' }, CUERPO)).toBeNull()
  })

  it('rechaza con 415 lo que no es application/json', () => {
    expect(revisarPeticion({ host: 'mec275.vercel.app' }, CUERPO)?.status).toBe(415)
    expect(revisarPeticion({ ...JSON_OK, 'content-type': 'text/plain' }, CUERPO)?.status).toBe(415)
    expect(revisarPeticion({ ...JSON_OK, 'content-type': 'application/x-www-form-urlencoded' }, CUERPO)?.status).toBe(415)
  })

  it('rechaza con 413 un cuerpo de más de 32 kB', () => {
    const grande = 'a'.repeat(MAX_CUERPO + 1)
    expect(revisarPeticion(JSON_OK, grande)?.status).toBe(413)
    expect(revisarPeticion({ ...JSON_OK, 'content-length': String(MAX_CUERPO + 1) }, '')?.status).toBe(413)
    expect(revisarPeticion(JSON_OK, 'a'.repeat(MAX_CUERPO))).toBeNull()
  })

  it('cuenta bytes y no letras para el tamaño', () => {
    const acentos = 'ñ'.repeat(MAX_CUERPO / 2 + 1)
    expect(revisarPeticion(JSON_OK, acentos)?.status).toBe(413)
  })

  it('rechaza con 403 un Origin de otro sitio', () => {
    expect(revisarPeticion({ ...JSON_OK, origin: 'https://otro.example.com' }, CUERPO)?.status).toBe(403)
    expect(revisarPeticion({ ...JSON_OK, origin: 'null' }, CUERPO)?.status).toBe(403)
    expect(revisarPeticion({ ...JSON_OK, origin: 'https://mec275.vercel.app.malo.com' }, CUERPO)?.status).toBe(403)
  })

  it('sin Origin: pasa si viene del mismo sitio o no dice de dónde viene', () => {
    expect(revisarPeticion({ ...JSON_OK, 'sec-fetch-site': 'same-origin' }, CUERPO)).toBeNull()
    expect(revisarPeticion({ ...JSON_OK, referer: 'https://mec275.vercel.app/?unidad=plc' }, CUERPO)).toBeNull()
    expect(revisarPeticion(JSON_OK, CUERPO)).toBeNull()
  })

  it('sin Origin: rechaza lo que dice venir de otro sitio', () => {
    expect(revisarPeticion({ ...JSON_OK, 'sec-fetch-site': 'cross-site' }, CUERPO)?.status).toBe(403)
    expect(revisarPeticion({ ...JSON_OK, referer: 'https://otro.example.com/pagina' }, CUERPO)?.status).toBe(403)
  })

  it('detrás de un proxy usa x-forwarded-host', () => {
    expect(revisarPeticion({ 'content-type': 'application/json', host: 'interno:3000', 'x-forwarded-host': 'mec275.vercel.app', origin: 'https://mec275.vercel.app' }, CUERPO)).toBeNull()
  })

  it('un cuerpo ilegible da 400 (igual que en Vercel antes)', async () => {
    const r = await atenderPeticion({ cabeceras: JSON_OK, texto: '{no es json', ip: 'x' })
    expect(r.status).toBe(400)
  })

  it('una petición buena llega al modelo y devuelve el texto', async () => {
    vi.stubEnv('MEC_BOT_API_KEY', 'clave-de-prueba')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Hola, soy MecBot.' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await atenderPeticion({ cabeceras: { ...JSON_OK, origin: 'https://mec275.vercel.app' }, texto: JSON.stringify({ mensajes: [{ rol: 'alumno', texto: 'pregunta única de prueba 5.3' }] }), ip: 'prueba-5-3' })
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ texto: 'Hola, soy MecBot.' })
  })

  it('un rechazo no llega nunca al modelo', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const r = await atenderPeticion({ cabeceras: { ...JSON_OK, origin: 'https://otro.example.com' }, texto: CUERPO, ip: 'x' })
    expect(r.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
