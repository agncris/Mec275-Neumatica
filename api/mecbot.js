import { atender } from './responder.js'

export async function POST(request) {
  const cuerpo = await request.json().catch(() => null)
  const ip = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim()
  const { status, json } = await atender(cuerpo, ip)
  return Response.json(json, { status })
}
