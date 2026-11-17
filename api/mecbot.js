import { ErrorBot, responder } from './responder.js'

export async function POST(request) {
  try {
    const cuerpo = await request.json().catch(() => null)
    const texto = await responder(cuerpo?.mensajes)
    return Response.json({ texto })
  } catch (e) {
    const codigo = e instanceof ErrorBot ? e.codigo : 'red'
    const status = e instanceof ErrorBot ? e.status : 502
    return Response.json({ error: codigo }, { status })
  }
}
