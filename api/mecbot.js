import { ErrorBot, responder } from './responder.js'

export async function POST(request) {
  try {
    const cuerpo = await request.json().catch(() => null)
    const ip = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim()
    const texto = await responder(cuerpo?.mensajes, ip)
    return Response.json({ texto })
  } catch (e) {
    if (!(e instanceof ErrorBot)) console.error('mecbot: fallo inesperado', e && e.stack)
    const codigo = e instanceof ErrorBot ? e.codigo : 'red'
    const status = e instanceof ErrorBot ? e.status : 502
    return Response.json({ error: codigo }, { status })
  }
}
