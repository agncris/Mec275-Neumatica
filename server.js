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

// SPA: cualquier otra ruta devuelve el index para que el enrutado sea del cliente.
app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))

app.listen(PUERTO, () => {
  console.log(`NeumaLab (MEC275) escuchando en el puerto ${PUERTO}`)
})
