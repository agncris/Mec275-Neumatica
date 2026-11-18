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
  /** Trabajo en curso: se conserva junto al circuito en la copia local. */
  trabajo?: {
    alumno?: { nombre: string; rol: string }
    ejercicio?: string
    respuestas?: unknown
  }
}

/**
 * Todas las claves con las que la app guarda cosas en este navegador (`localStorage`).
 * Son las únicas: nadie más escribe una clave `neumalab.*` a mano (lo comprueba un test).
 * No cambies un valor: quien ya trabajó perdería lo que tenía guardado.
 */
export const CLAVES = {
  /** Nombre del alumno y de su compañero, compartido por las cuatro unidades. */
  alumno: 'neumalab.alumno',
  /** Qué unidad quedó abierta. */
  unidad: 'neumalab.unidad',
  // Neumática
  circuito: 'neumalab.circuito',
  circuitoAbierto: 'neumalab.circuito-abierto',
  /** Antes elegía el lienzo; ahora solo decide «3D» o «Por dentro» en la simulación ('banco3d' o 'taller'). */
  bancoVista: 'neumalab.banco.vista',
  bancoPaletaPlegada: 'neumalab.banco.paleta-plegada',
  // bancoInspector, bancoAnchoInspector y las tres de «inferior» ya no se leen (el panel de la derecha usa neumaticaPanel). Quedan para no reutilizarlas.
  bancoInspector: 'neumalab.banco.inspector',
  bancoAnchoPaleta: 'neumalab.banco.ancho-paleta',
  bancoAnchoInspector: 'neumalab.banco.ancho-inspector',
  bancoInferior: 'neumalab.banco.inferior',
  bancoAltoInferior: 'neumalab.banco.alto-inferior',
  bancoInferiorAmpliado: 'neumalab.banco.inferior-ampliado',
  banco3dSonido: 'neumalab.banco3d.sonido',
  paletaGrupos: 'neumalab.paleta.grupos',
  neumaticaEntrega: 'neumalab.neumatica.entrega',
  neumaticaPanel: 'neumalab.neumatica.panel',
  neumaticaBanco: 'neumalab.neumatica.banco',
  // PLC
  plcPrograma: 'neumalab.plc.programa',
  plcTarea: 'neumalab.plc.tarea',
  /** Lo que había en la tarea antes de abrir el ejemplo guiado. */
  plcAntesEjemplo: 'neumalab.plc.tarea.antes-ejemplo',
  plcDirecciones: 'neumalab.plc.direcciones',
  plcPanel: 'neumalab.plc.panel',
  plcBanco: 'neumalab.plc.banco.v2',
  plcEntrega: 'neumalab.plc.entrega',
  plcRotulos3d: 'neumalab.plc.rotulos3d',
  plcSonido: 'neumalab.plc.sonido',
  // CNC
  cnc: 'neumalab.cnc',
  cncTarea: 'neumalab.cnc.tarea',
  /** Lo que había en la tarea antes de abrir el ejemplo guiado. */
  cncAntesEjemplo: 'neumalab.cnc.tarea.antes-ejemplo',
  cncPanel: 'neumalab.cnc.panel',
  cncBanco: 'neumalab.cnc.banco.v2',
  cncEntrega: 'neumalab.cnc.entrega',
  // Robótica
  robotDefinicion: 'neumalab.robot.definicion',
  robotTarea: 'neumalab.robot.tarea',
  /** Lo que había en la tarea antes de abrir el ejemplo guiado. */
  robotAntesEjemplo: 'neumalab.robot.tarea.antes-ejemplo',
  robotPanel: 'neumalab.robot.panel.v3',
  robotPlegado: 'neumalab.robot.plegado',
  robotEscena: 'neumalab.robot.escena.v4',
  robotEntrega: 'neumalab.robot.entrega',
  robotPaleta: 'neumalab.robot.paleta.v1',
  robotAyudaLienzo: 'neumalab.robot.lienzo.ayuda.v1',
  // MecBot
  /** Si lee las respuestas en voz alta. Parte apagado. */
  mecbotVoz: 'neumalab.mecbot.voz',
  /** Si el alumno deja guardar sus consultas para investigación (ver api/registro.js). */
  mecbotGuardar: 'neumalab.mecbot.guardar',
} as const

/** Si ya vio la guía de inicio de esa unidad. */
export const claveGuia = (unidad: string) => `neumalab.guia.${unidad}`
/** Los trabajos con nombre de «Mis trabajos» de esa unidad. */
export const claveTrabajos = (unidad: string) => `neumalab.trabajos.${unidad}`

/** Lo guardado como texto. `null` si no hay nada o si el navegador no deja leer (incógnito, bloqueado). */
export function leerTexto(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    // Sin almacenamiento: se actúa como si no hubiera nada guardado.
    return null
  }
}

/** Guarda un texto. Devuelve `false` si no se pudo (sin almacenamiento o lleno): quien llama decide si avisa. */
export function guardarTexto(clave: string, valor: string): boolean {
  try {
    localStorage.setItem(clave, valor)
    return true
  } catch {
    return false
  }
}

/** Borra una clave. Si el navegador no deja, no pasa nada. */
export function borrarClave(clave: string): void {
  try {
    localStorage.removeItem(clave)
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}

/** Lo guardado como JSON. `null` si no hay nada, si el JSON está roto o si el navegador no deja leer. */
export function leerJson(clave: string): unknown {
  const crudo = leerTexto(clave)
  if (crudo === null) return null
  try {
    return JSON.parse(crudo)
  } catch {
    // Dato roto: se actúa como si no hubiera nada.
    return null
  }
}

/** Guarda un valor como JSON. Devuelve `false` si no se pudo guardar. */
export function guardarJson(clave: string, valor: unknown): boolean {
  try {
    return guardarTexto(clave, JSON.stringify(valor))
  } catch {
    // Valor que no se puede pasar a JSON.
    return false
  }
}

const CLAVE = CLAVES.circuito

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
  // Modo incógnito o almacenamiento lleno: no es motivo para romper la app.
  guardarJson(CLAVE, circuito)
}

export function leerLocal(): CircuitoGuardado | null {
  const dato = leerJson(CLAVE)
  return esCircuitoValido(dato) ? dato : null
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
  if (!esCircuitoValido(dato)) throw new Error('El archivo no contiene un circuito de MecLab válido.')
  return dato
}
