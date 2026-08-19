/**
 * Guardado y carga de circuitos: copia de trabajo en localStorage, exportación
 * e importación de archivo .json, y enlace para compartir con el circuito
 * codificado en el fragmento de la URL (sin servidor).
 */
import type { Manguera } from './engine'
import type { Pieza } from './store'

export interface CircuitoGuardado {
  version: 1
  nombre?: string
  piezas: Pieza[]
  mangueras: Manguera[]
}

const CLAVE = 'neumalab.circuito'

/** Base64 seguro para UTF-8 y para viajar dentro de una URL. */
function aBase64(texto: string): string {
  const bytes = new TextEncoder().encode(texto)
  let binario = ''
  bytes.forEach((b) => {
    binario += String.fromCharCode(b)
  })
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function desdeBase64(codigo: string): string {
  const normal = codigo.replace(/-/g, '+').replace(/_/g, '/')
  const relleno = normal + '='.repeat((4 - (normal.length % 4)) % 4)
  const binario = atob(relleno)
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Comprueba que lo cargado tenga la forma esperada antes de meterlo al editor. */
export function esCircuitoValido(dato: unknown): dato is CircuitoGuardado {
  if (typeof dato !== 'object' || dato === null) return false
  const d = dato as Partial<CircuitoGuardado>
  if (!Array.isArray(d.piezas) || !Array.isArray(d.mangueras)) return false
  const piezasOk = d.piezas.every(
    (p) =>
      typeof p?.id === 'string' &&
      typeof p?.tipo === 'string' &&
      Number.isFinite(p?.x) &&
      Number.isFinite(p?.y),
  )
  const manguerasOk = d.mangueras.every(
    (m) =>
      typeof m?.id === 'string' &&
      typeof m?.a?.componente === 'string' &&
      typeof m?.a?.puerto === 'string' &&
      typeof m?.b?.componente === 'string' &&
      typeof m?.b?.puerto === 'string',
  )
  return piezasOk && manguerasOk
}

export function guardarLocal(circuito: CircuitoGuardado): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(circuito))
  } catch {
    // Modo incógnito o almacenamiento lleno: no es motivo para romper la app.
  }
}

export function leerLocal(): CircuitoGuardado | null {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const dato = JSON.parse(crudo)
    return esCircuitoValido(dato) ? dato : null
  } catch {
    return null
  }
}

/** Circuito codificado en el fragmento de la URL (#c=...), si lo hay. */
export function leerDeUrl(hash = window.location.hash): CircuitoGuardado | null {
  const coincidencia = /[#&]c=([A-Za-z0-9\-_]+)/.exec(hash)
  if (!coincidencia) return null
  try {
    const dato = JSON.parse(desdeBase64(coincidencia[1]))
    return esCircuitoValido(dato) ? dato : null
  } catch {
    return null
  }
}

export function enlaceCompartir(circuito: CircuitoGuardado, base = window.location.href): string {
  const url = new URL(base)
  url.hash = `c=${aBase64(JSON.stringify(circuito))}`
  return url.toString()
}

export function descargarJson(circuito: CircuitoGuardado, nombre = 'circuito-neumalab.json'): void {
  const blob = new Blob([JSON.stringify(circuito, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export async function leerArchivo(archivo: File): Promise<CircuitoGuardado> {
  const texto = await archivo.text()
  const dato = JSON.parse(texto)
  if (!esCircuitoValido(dato)) throw new Error('El archivo no contiene un circuito de NeumaLab válido.')
  return dato
}
