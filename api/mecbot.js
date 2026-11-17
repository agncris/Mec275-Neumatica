import { atenderPeticion } from './responder.js'

export async function POST(request) {
  const ip = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim()
  const texto = await request.text().catch(() => '')
  const { status, json } = await atenderPeticion({ cabeceras: Object.fromEntries(request.headers), texto, ip })
  return Response.json(json, { status })
}
