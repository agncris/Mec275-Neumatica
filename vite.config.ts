/// <reference types="vitest" />
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { ErrorBot, responder } from './api/responder.js'

function cuerpoDe(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const trozos: Buffer[] = []
    req.on('data', (c) => trozos.push(Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')))
    req.on('error', reject)
  })
}

/** En `npm run dev`, /api/mecbot usa la misma función que en Vercel. */
function mecbotEnDev(): Plugin {
  return {
    name: 'mecbot-dev',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const ruta = (req.url || '').split('?')[0]
        if (ruta !== '/api/mecbot' || req.method !== 'POST') return next()
        try {
          const cuerpo = JSON.parse((await cuerpoDe(req)) || '{}') as { mensajes?: unknown }
          const ip = (req.socket?.remoteAddress || 'local').replace(/^::ffff:/, '')
          const texto = await responder(cuerpo.mensajes, ip)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ texto }))
        } catch (e) {
          const codigo = e instanceof ErrorBot ? e.codigo : 'red'
          const status = e instanceof ErrorBot ? e.status : 502
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: codigo }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const clave of ['MEC_BOT_API_KEY', 'MEC_BOT_URL', 'MEC_BOT_MODELO']) {
    if (env[clave]) process.env[clave] = env[clave]
  }
  return {
    plugins: [react(), mecbotEnDev()],
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      // btoa/atob y TextEncoder existen en Node 18+, no hace falta jsdom
    },
  }
})
