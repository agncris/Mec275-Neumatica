/**
 * Prueba de humo de punta a punta: un recorrido corto por cada unidad en un Chrome real,
 * contra el sitio ya compilado (`npm run build`) servido con `vite preview`.
 *
 *   npm run build && npm run e2e
 *
 * Usa el Chrome del sistema (no baja ningún navegador). Si no hay WebGL, las comprobaciones
 * del lienzo 3D se cambian por la del aviso «sin WebGL», que es el camino que usa la app.
 * Variable opcional: E2E_URL para probar otro sitio (por ejemplo producción) sin levantar nada.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const PUERTO = 4199
const EXTERNA = process.env.E2E_URL
const BASE = EXTERNA || `http://localhost:${PUERTO}`

if (!EXTERNA && !existsSync('dist/index.html')) {
  console.error('Falta la carpeta dist: corre `npm run build` antes de `npm run e2e`.')
  process.exit(2)
}

let servidor = null
async function levantar() {
  if (EXTERNA) return
  servidor = spawn('npx', ['vite', 'preview', '--port', String(PUERTO), '--strictPort'], { stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return
    } catch {
      // El servidor todavía no responde: se reintenta.
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('vite preview no arrancó a tiempo')
}

const resultados = []
async function prueba(nombre, fn, navegador) {
  const ctx = await navegador.newContext({ viewport: { width: 1400, height: 900 } })
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`))
  p.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(`consola: ${m.text()}`)
  })
  let falla = null
  try {
    await fn(p)
    if (errores.length) falla = errores.join(' | ')
  } catch (e) {
    falla = e instanceof Error ? e.message.split('\n')[0] : String(e)
  }
  await ctx.close()
  resultados.push({ nombre, falla })
  console.log(`${falla ? 'FALLA' : 'ok   '} ${nombre}${falla ? `: ${falla}` : ''}`)
}

const esperar = (cond, texto, ms = 15000) => cond.waitFor({ timeout: ms }).catch(() => {
  throw new Error(texto)
})
const igual = (a, b, texto) => {
  if (a !== b) throw new Error(`${texto} (esperaba ${b}, salió ${a})`)
}

async function abrir(p, unidad, extra = '') {
  await p.goto(`${BASE}/?unidad=${unidad}${extra}`)
  await p.getByText('Saltar la guía').click({ timeout: 4000 }).catch(() => {
    // La guía de inicio solo sale la primera vez.
  })
}
const hayWebGL = (p) => p.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))
/** El lienzo WebGL tiene algo dibujado (la imagen exportada no es un cuadro vacío). */
async function lienzoConDibujo(p) {
  if (!(await hayWebGL(p))) {
    await esperar(p.getByText(/no tiene WebGL|sin WebGL|WebGL/).first(), 'sin WebGL y sin el aviso de la app')
    return
  }
  await p.waitForFunction(() => document.querySelector('canvas') !== null, null, { timeout: 15000 })
  await p.waitForTimeout(1500)
  const largo = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/png').length)
  if (largo < 5000) throw new Error(`el lienzo 3D está vacío (${largo} caracteres)`)
}

async function main() {
  await levantar()
  const navegador = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] })

  await prueba('Neumática: abrir, cargar un ejemplo y simular', async (p) => {
    await abrir(p, 'neumatica')
    const simular = p.getByRole('button', { name: /Simular/ })
    await esperar(simular, 'no aparece ▶ Simular')
    await p.locator('[data-selector-ejemplos="si"]').selectOption({ index: 1 })
    await simular.click()
    await esperar(p.getByRole('button', { name: /Detener/ }), 'la simulación no arrancó')
    await esperar(p.locator('svg#pizarra-svg'), 'no hay pizarra')
  }, navegador)

  await prueba('PLC: abrir, RUN y dibujar la planta 3D', async (p) => {
    await abrir(p, 'plc')
    await esperar(p.getByRole('button', { name: /RUN/ }).first(), 'no aparece ▶ RUN')
    await p.getByRole('button', { name: /RUN/ }).first().click()
    await lienzoConDibujo(p)
  }, navegador)

  await prueba('CNC: abrir, correr el ciclo y dibujar la máquina 3D', async (p) => {
    await abrir(p, 'cnc')
    await esperar(p.getByRole('button', { name: /Ciclo/ }).first(), 'no aparece ▶ Ciclo')
    await p.getByRole('button', { name: /Ciclo/ }).first().click()
    await lienzoConDibujo(p)
  }, navegador)

  await prueba('Robótica: la guía de la Tarea 4 avanza al agregar un bloque', async (p) => {
    await abrir(p, 'robotica', '&vista=tarea')
    const guia = p.locator('[data-guia-paso]')
    await esperar(guia, 'no aparece la guía de la tarea')
    igual(await guia.getAttribute('data-guia-paso'), 'c-curve', 'el primer paso de la guía')
    await p.locator('.bloque-nodo[data-siguiente="si"]').first().click()
    await p.waitForFunction(() => document.querySelector('[data-guia-paso]')?.getAttribute('data-guia-paso') !== 'c-curve', null, { timeout: 10000 })
    await lienzoConDibujo(p)
  }, navegador)

  await prueba('Neumática: Entregar y Revisar muestran el checklist', async (p) => {
    await abrir(p, 'neumatica')
    await p.getByRole('button', { name: 'Entregar', exact: true }).click()
    await p.locator('[data-revisar="si"]').click()
    await esperar(p.locator('[data-revision="si"] li').first(), 'la revisión no muestra el checklist')
  }, navegador)

  await navegador.close()
}

let codigo = 0
try {
  await main()
  if (resultados.some((r) => r.falla)) codigo = 1
} catch (e) {
  console.error(e)
  codigo = 1
} finally {
  servidor?.kill()
}
process.exit(codigo)
