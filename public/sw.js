/*
 * NeumaLab sin conexión. Después de la primera visita, la app funciona sin
 * internet (en el laboratorio o en la micro):
 *   · la página: primero la red (para tener siempre la última versión) y, sin
 *     red, la copia guardada;
 *   · los archivos de /assets (llevan su huella en el nombre, no cambian):
 *     primero la copia guardada;
 *   · lo demás del mismo sitio: la copia guardada, y se actualiza por detrás.
 */
const CACHE = 'neumalab-v1'
const BASICOS = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest', '/icono-192.png', '/icono-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const guardar = (req, res) => {
  if (res && res.ok && res.type === 'basic') {
    const copia = res.clone()
    caches.open(CACHE).then((c) => c.put(req, copia))
  }
  return res
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => guardar('/index.html', res))
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => guardar(req, res))))
    return
  }
  e.respondWith(
    caches.match(req).then((r) => {
      const red = fetch(req)
        .then((res) => guardar(req, res))
        .catch(() => r)
      return r || red
    }),
  )
})
