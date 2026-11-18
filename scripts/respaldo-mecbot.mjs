/**
 * Respaldo del registro de MecBot: baja de Supabase todas las conversaciones y las deja en
 * una carpeta local, en JSON Lines (para analizar) y en CSV (para abrir en Excel).
 *
 * Uso: npm run respaldo-mecbot
 * Lee del .env: MEC_BOT_SUPABASE_URL, MEC_BOT_SUPABASE_KEY, MEC_BOT_RESPALDO_CLAVE y,
 * opcional, MEC_BOT_RESPALDO_CARPETA (por defecto respaldos-mecbot/, que no se sube).
 *
 * Cada respaldo es completo y lleva la fecha en el nombre: si uno se pierde, el siguiente
 * trae todo de nuevo. Además deja un registro-local con lo de `npm run dev`, si existe.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const url = process.env.MEC_BOT_SUPABASE_URL
const clave = process.env.MEC_BOT_SUPABASE_KEY
const claveRespaldo = process.env.MEC_BOT_RESPALDO_CLAVE
const carpeta = resolve(process.env.MEC_BOT_RESPALDO_CARPETA || 'respaldos-mecbot')

if (!url || !clave || !claveRespaldo) {
  console.error('Faltan MEC_BOT_SUPABASE_URL, MEC_BOT_SUPABASE_KEY o MEC_BOT_RESPALDO_CLAVE en el .env.')
  process.exit(1)
}

const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/mecbot_respaldo`, {
  method: 'POST',
  headers: { apikey: clave, Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ clave: claveRespaldo }),
})
if (!res.ok) {
  console.error('Supabase no entregó el respaldo:', res.status, (await res.text()).slice(0, 300))
  process.exit(1)
}
const filas = await res.json()

const csv = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
const columnas = ['id', 'fecha', 'unidad', 'conversacion', 'pregunta', 'respuesta']
const hoy = new Date().toISOString().slice(0, 10)

await mkdir(carpeta, { recursive: true })
await writeFile(join(carpeta, `mecbot-${hoy}.jsonl`), filas.map((f) => JSON.stringify(f)).join('\n') + (filas.length ? '\n' : ''), 'utf8')
// Con BOM: así Excel abre bien los tildes.
await writeFile(join(carpeta, `mecbot-${hoy}.csv`), '﻿' + [columnas.join(','), ...filas.map((f) => columnas.map((c) => csv(f[c])).join(','))].join('\n') + '\n', 'utf8')
if (existsSync('registro-mecbot.jsonl')) await copyFile('registro-mecbot.jsonl', join(carpeta, `registro-local-${hoy}.jsonl`))

const porUnidad = {}
for (const f of filas) porUnidad[f.unidad ?? 'sin unidad'] = (porUnidad[f.unidad ?? 'sin unidad'] ?? 0) + 1
console.log(`Respaldo listo: ${filas.length} consultas en ${carpeta}`)
console.log(Object.entries(porUnidad).map(([u, n]) => `  ${u}: ${n}`).join('\n'))
