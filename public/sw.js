/*
 * MecLab sin conexión. Después de la primera visita, la app funciona sin
 * internet (en el laboratorio o en la micro):
 *   · la página: primero la red (para tener siempre la última versión) y, sin
 *     red, la copia guardada;
 *   · los archivos de /assets (llevan su huella en el nombre, no cambian):
 *     primero la copia guardada;
 *   · lo demás del mismo sitio: la copia guardada, y se actualiza por detrás.
 *
 * El nombre de la caché lleva la versión del build (el build reemplaza
 * __VERSION__): cada versión nueva usa una caja nueva y al activarse borra las
 * viejas, así no quedan archivos de /assets de versiones anteriores.
 */
const CACHE = 'neumalab-__VERSION__'
// Las copias precargadas no llevan el encabezado Origin que sí llevan los módulos: se ignora Vary al buscarlas.
const SIN_VARY = { ignoreVary: true }
const BASICOS = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest', '/icono-192.png', '/icono-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll(BASICOS).then(() =>
          // Todo lo que la app puede cargar: la entrada y los trozos de cada unidad (cada archivo nombra
          // los que carga después). Así abre sin red, en cualquier unidad, desde la primera visita.
          fetch('/index.html')
            .then((r) => r.text())
            .then(async (html) => {
              const cola = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
              const vistos = new Set(cola)
              while (cola.length) {
                const a = cola.shift()
                try {
                  await c.add(a)
                  if (!a.endsWith('.js')) continue
                  const texto = await (await c.match(a)).text()
                  // Aparecen como assets/X.js (lista de dependencias) o como ./X.js (import dinámico).
                  for (const m of texto.matchAll(/(?:assets\/|\.\/)([A-Za-z0-9_-]+-[A-Za-z0-9_-]+\.(?:js|css))/g)) {
                    const ruta = '/assets/' + m[1]
                    if (!vistos.has(ruta)) {
                      vistos.add(ruta)
                      cola.push(ruta)
                    }
                  }
                } catch {
                  /* un archivo que falla no debe impedir instalar el resto */
                }
              }
            })
            .catch(() => {}),
        ),
      )
      .then(() => self.skipWaiting()),
  )
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
    e.respondWith(caches.match(req, SIN_VARY).then((r) => r || fetch(req).then((res) => guardar(req, res))))
    return
  }
  e.respondWith(
    caches.match(req, SIN_VARY).then((r) => {
      const red = fetch(req)
        .then((res) => guardar(req, res))
        .catch(() => r)
      return r || red
    }),
  )
})
