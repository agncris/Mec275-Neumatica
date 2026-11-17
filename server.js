/**
 * Servidor mínimo para producción: sirve la SPA compilada (carpeta dist).
 * Railway, Render y similares inyectan el puerto en process.env.PORT.
 */
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PUERTO = process.env.PORT || 3000
const DIST = path.join(__dirname, 'dist')

// Los assets llevan hash en el nombre: se pueden cachear de forma agresiva.
app.use(
  express.static(DIST, {
    maxAge: '1y',
    setHeaders: (res, ruta) => {
      if (ruta.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache')
    },
  }),
)

app.get('/salud', (_req, res) => res.json({ ok: true }))

// El cuerpo llega crudo: tipo, tamaño y origen los revisa `atenderPeticion`, igual que en Vercel y en desarrollo.
app.post('/api/mecbot', express.raw({ type: () => true, limit: '64kb' }), async (req, res) => {
  const { atenderPeticion } = await import('./api/responder.js')
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim()
  const texto = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''
  const { status, json } = await atenderPeticion({ cabeceras: req.headers, texto, ip })
  res.status(status).json(json)
})

// Un cuerpo de más de 64 kB lo corta express antes de llegar aquí: se contesta igual que el resto.
app.use((err, _req, res, next) => {
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'grande' })
  next(err)
})

// SPA: cualquier otra ruta devuelve el index para que el enrutado sea del cliente.
app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))

app.listen(PUERTO, () => {
  console.log(`NeumaLab (MEC275) escuchando en el puerto ${PUERTO}`)
})
