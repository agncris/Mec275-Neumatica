import { planoXY, v, type Plano, type V3 } from './matematica'
import { poseDe, type PuntoEnsenado } from './Mando'
import { esDefinicion, type Dato, type Definicion, type Herramienta } from './nodos'
import { EJEMPLOS_ROBOT } from './ejemplos'
import { esEjemploGuiado, tareaAlAbrir } from './tarea4'
import type { Curva } from './geometria'
import type { Previa } from './Robot3D'
import type { robotPorId } from './robots'

export const CLAVE = 'neumalab.robot.definicion'
/**
 * La tarea de Robótica se trabaja en su propia sección, con su definición guardada
 * aparte del Laboratorio. El enunciado lo entrega el profesor; «Entregar» sólo
 * aparece ahí.
 */
export const CLAVE_TAREA = 'neumalab.robot.tarea'
/** Lo que había en la tarea antes de abrir el ejemplo guiado. */
export const CLAVE_ANTES_EJEMPLO = 'neumalab.robot.tarea.antes-ejemplo'
export const NOMBRE_TAREA = 'Tarea Robótica'
export const HERR_DEFECTO: Herramienta = { tipo: 'fresa', nombre: 'Husillo con fresa', largo: 200, diametro: 5 }
export const HERR_MANDO: Herramienta = { tipo: 'ventosa', nombre: 'Ventosa de vacío', largo: 120, diametro: 40 }
export const BASE_DEFECTO: Plano = planoXY(v(450, -150, 300))

export function leerGuardada(): Definicion {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (crudo) {
      const d = JSON.parse(crudo)
      if (esDefinicion(d)) return d
    }
  } catch {
    /* sin almacenamiento */
  }
  return EJEMPLOS_ROBOT[0].definicion()
}

export function definicionGuardada(clave: string): Definicion | null {
  try {
    const crudo = localStorage.getItem(clave)
    if (!crudo) return null
    const d = JSON.parse(crudo)
    return esDefinicion(d) ? d : null
  } catch {
    return null
  }
}

export function leerTarea(): Definicion {
  const guardada = definicionGuardada(CLAVE_TAREA)
  const previa = definicionGuardada(CLAVE_ANTES_EJEMPLO)
  if (guardada && esEjemploGuiado(guardada)) {
    try {
      localStorage.removeItem(CLAVE_ANTES_EJEMPLO)
    } catch {
      /* sin almacenamiento */
    }
  }
  return tareaAlAbrir(guardada, previa)
}

export const esCurva = (d: Dato): d is Curva => typeof d === 'object' && d !== null && 'pts' in d && 'cerrada' in d
export const esPlano = (d: Dato): d is Plano => typeof d === 'object' && d !== null && 'o' in d && 'z' in d
export const esPunto = (d: Dato): d is V3 => typeof d === 'object' && d !== null && 'x' in d && 'y' in d && 'z' in d && !('o' in d)

export function previaDe(datos: Dato[]): Previa {
  const p: Previa = { curvas: [], puntos: [], planos: [] }
  for (const d of datos) {
    if (esCurva(d)) p.curvas.push(d.cerrada ? d.pts : [...d.pts])
    else if (esPlano(d)) p.planos.push(d)
    else if (esPunto(d)) p.puntos.push(d)
  }
  return p
}


/** Posiciones de los puntos enseñados (para marcarlos en 3D). */
const cacheMarcas = new WeakMap<PuntoEnsenado[], V3[]>()
export function marcasDe(puntos: PuntoEnsenado[], modelo: ReturnType<typeof robotPorId>, h: Herramienta): V3[] {
  const c = cacheMarcas.get(puntos)
  if (c) return c
  const m = puntos.map((p) => poseDe(modelo, p.q, h.largo, 0).tcp)
  cacheMarcas.set(puntos, m)
  return m
}
