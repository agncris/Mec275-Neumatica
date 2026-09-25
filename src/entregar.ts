/**
 * Utilidades para entregar una tarea: nombre de los archivos como lo piden
 * los enunciados («Nombre_Apellido_Trabajo-2»), descargas, tablas que se
 * pegan en PowerPoint como tabla y enlaces que llevan el trabajo dentro.
 */
import { useEffect, useState } from 'react'

export interface DatosAlumno {
  nombre: string
  /** Si trabajó en pareja. */
  companero: string
}

const CLAVE_ALUMNO = 'neumalab.alumno'

function leerAlumno(): DatosAlumno {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_ALUMNO) ?? '{}') as Partial<DatosAlumno>
    return { nombre: typeof d.nombre === 'string' ? d.nombre : '', companero: typeof d.companero === 'string' ? d.companero : '' }
  } catch {
    return { nombre: '', companero: '' }
  }
}

/** Nombre del alumno, compartido por las cuatro unidades y recordado en este navegador. */
export function useAlumno(): [DatosAlumno, (d: DatosAlumno) => void] {
  const [datos, setDatos] = useState<DatosAlumno>(leerAlumno)
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_ALUMNO, JSON.stringify(datos))
    } catch {
      /* sin almacenamiento */
    }
  }, [datos])
  return [datos, setDatos]
}

/** «Ana María Pérez» → «Ana_Maria_Perez» (sin tildes ni símbolos, apto para nombre de archivo). */
export function paraArchivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Base del nombre de los archivos: Nombre_Apellido[_Compañero]_Trabajo-N. */
export function baseArchivo(alumno: DatosAlumno, trabajo: string): string {
  const partes = [alumno.nombre, alumno.companero, trabajo].map(paraArchivo).filter(Boolean)
  return partes.join('_') || 'mi_trabajo'
}

export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function descargarTexto(texto: string, nombre: string, tipo = 'text/plain'): void {
  descargarBlob(new Blob([texto], { type: tipo }), nombre)
}

export async function descargarDataUrl(dataUrl: string, nombre: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob()
  descargarBlob(blob, nombre)
}

const escaparHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Copia una tabla al portapapeles como HTML y como texto con tabulaciones:
 * al pegarla en PowerPoint, Word o Excel queda como tabla.
 */
export async function copiarTabla(filas: string[][]): Promise<boolean> {
  const tsv = filas.map((f) => f.join('\t')).join('\n')
  const html =
    '<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse">' +
    filas
      .map((f, i) => `<tr>${f.map((c) => (i === 0 ? `<th>${escaparHtml(c)}</th>` : `<td>${escaparHtml(c)}</td>`)).join('')}</tr>`)
      .join('') +
    '</table>'
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([tsv], { type: 'text/plain' }) }),
      ])
      return true
    }
    await navigator.clipboard.writeText(tsv)
    return true
  } catch {
    return false
  }
}

export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Enlaces que llevan el trabajo dentro (sin servidor): el trabajo va
// comprimido y codificado en el fragmento de la URL (#plc=…, #cnc=…, #rob=…).
// ---------------------------------------------------------------------------
function aBase64Url(bytes: Uint8Array): string {
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function desdeBase64Url(codigo: string): Uint8Array {
  const normal = codigo.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function pasarPor(bytes: Uint8Array, flujo: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const salida = new Blob([bytes as BlobPart]).stream().pipeThrough(flujo)
  return new Uint8Array(await new Response(salida).arrayBuffer())
}

/** Codifica un dato para ponerlo en un enlace. Comprime si el navegador puede («z» al inicio). */
export async function codificarEnlace(dato: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(dato))
  if (typeof CompressionStream !== 'undefined') {
    try {
      return 'z' + aBase64Url(await pasarPor(bytes, new CompressionStream('deflate-raw')))
    } catch {
      /* sin compresión */
    }
  }
  return 'j' + aBase64Url(bytes)
}

export async function decodificarEnlace(codigo: string): Promise<unknown> {
  const tipo = codigo[0]
  let bytes = desdeBase64Url(codigo.slice(1))
  if (tipo === 'z') bytes = await pasarPor(bytes, new DecompressionStream('deflate-raw'))
  else if (tipo !== 'j') throw new Error('Enlace no reconocido')
  return JSON.parse(new TextDecoder().decode(bytes))
}

/** Enlace a esta misma app con el trabajo de una unidad dentro. */
export async function enlaceTrabajo(unidad: 'plc' | 'cnc' | 'robotica', clave: string, dato: unknown): Promise<string> {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('unidad', unidad)
  url.hash = `${clave}=${await codificarEnlace(dato)}`
  return url.toString()
}

/** Lee el trabajo que trae el enlace (#clave=…), si lo trae. */
export async function trabajoDelEnlace(clave: string): Promise<unknown | null> {
  const m = new RegExp(`[#&]${clave}=([A-Za-z0-9\\-_]+)`).exec(window.location.hash)
  if (!m) return null
  try {
    return await decodificarEnlace(m[1])
  } catch {
    return null
  }
}

/** Quita el trabajo del enlace de la barra de direcciones (ya se abrió). */
export function limpiarEnlace(): void {
  try {
    const url = new URL(window.location.href)
    url.hash = ''
    window.history.replaceState(null, '', url)
  } catch {
    /* sin historial */
  }
}
