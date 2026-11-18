/// <reference types="vitest" />
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { atenderPeticion } from './api/responder.js'

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
        const texto = await cuerpoDe(req).catch(() => '')
        const ip = (req.socket?.remoteAddress || 'local').replace(/^::ffff:/, '')
        const { status, json } = await atenderPeticion({ cabeceras: req.headers as Record<string, string>, texto, ip })
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(json))
      })
    },
  }
}

/**
 * Pone la versión del build en `dist/sw.js` (reemplaza `__VERSION__`). La versión es
 * la huella de `dist/index.html`, que cambia cada vez que cambia un archivo de /assets.
 * Con otro nombre de caché, el service worker nuevo borra la caja vieja al activarse.
 */
function versionDelServiceWorker(): Plugin {
  return {
    name: 'sw-version',
    apply: 'build',
    closeBundle() {
      const sw = resolve('dist/sw.js')
      const indice = resolve('dist/index.html')
      if (!existsSync(sw) || !existsSync(indice)) return
      const version = createHash('sha1').update(readFileSync(indice)).digest('hex').slice(0, 8)
      writeFileSync(sw, readFileSync(sw, 'utf8').replaceAll('__VERSION__', version))
    },
  }
}

export default defineConfig(({ mode }) => {
  // En los tests no se cargan las claves ni el registro del .env: si no, cada `npm test`
  // escribía respuestas de prueba en el registro real de MecBot.
  const env = mode === 'test' ? {} as Record<string, string> : loadEnv(mode, process.cwd(), '')
  for (const clave of ['MEC_BOT_API_KEY', 'MEC_BOT_URL', 'MEC_BOT_MODELO', 'MEC_BOT_CLAUDE_API_KEY', 'MEC_BOT_CLAUDE_MODELO', 'MEC_BOT_TOPE_HORA', 'MEC_BOT_TOPE_DIA', 'MEC_BOT_REGISTRO', 'MEC_BOT_SUPABASE_URL', 'MEC_BOT_SUPABASE_KEY']) {
    if (env[clave]) process.env[clave] = env[clave]
  }
  return {
    plugins: [react(), mecbotEnDev(), versionDelServiceWorker()],
    build: {
      rollupOptions: {
        output: {
          // three.js en su propio trozo: lo comparten todas las escenas 3D y no entra en la carga inicial.
          manualChunks(id: string) {
            if (id.includes('node_modules/three-viewport-gizmo')) return 'gizmo'
            if (id.includes('node_modules/three/')) return 'three'
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      // btoa/atob y TextEncoder existen en Node 18+, no hace falta jsdom
    },
  }
})
