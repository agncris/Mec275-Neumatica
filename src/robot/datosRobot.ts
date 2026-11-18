import { planoXY, v, type Plano, type V3 } from './matematica'
import { HOME } from './robots'
import { poseDe, type PuntoEnsenado } from './Mando'
import { esDefinicion, type Comando, type Dato, type Definicion, type Herramienta, type Programa, type RobotVirtual } from './nodos'
import { EJEMPLOS_ROBOT } from './ejemplos'
import { esEjemploGuiado, tareaAlAbrir } from './tarea4'
import type { Curva } from './geometria'
import type { Previa } from './Robot3D'
import type { robotPorId } from './robots'
import { borrarClave, CLAVES, leerJson } from '../persistencia'

/** Cómo se programa: con nodos o con el mando manual. */
export type Modo = 'visual' | 'mando'

export const CLAVE = CLAVES.robotDefinicion
/**
 * La tarea de Robótica se trabaja en su propia sección, con su definición guardada
 * aparte del Laboratorio. El enunciado lo entrega el profesor; «Entregar» sólo
 * aparece ahí.
 */
export const CLAVE_TAREA = CLAVES.robotTarea
/** Lo que había en la tarea antes de abrir el ejemplo guiado. */
export const CLAVE_ANTES_EJEMPLO = CLAVES.robotAntesEjemplo
export const NOMBRE_TAREA = 'Tarea Robótica'
export const HERR_DEFECTO: Herramienta = { tipo: 'fresa', nombre: 'Husillo con fresa', largo: 200, diametro: 5 }
export const HERR_MANDO: Herramienta = { tipo: 'ventosa', nombre: 'Ventosa de vacío', largo: 120, diametro: 40 }
export const BASE_DEFECTO: Plano = planoXY(v(450, -150, 300))

/**
 * Dónde se dibuja la mesa en el mando manual. Es solo de referencia: con un robot grande,
 * a 450 mm quedaría metida en su base, así que se aleja con el alcance.
 */
export function baseMando(alcance: number): Plano {
  return alcance > 1000 ? planoXY(v(Math.round(alcance * 0.45), -150, 300)) : BASE_DEFECTO
}

export function leerGuardada(): Definicion {
  const d = leerJson(CLAVE)
  if (esDefinicion(d)) return d
  return EJEMPLOS_ROBOT[0].definicion()
}

export function definicionGuardada(clave: string): Definicion | null {
  const d = leerJson(clave)
  return esDefinicion(d) ? d : null
}

export function leerTarea(): Definicion {
  const guardada = definicionGuardada(CLAVE_TAREA)
  const previa = definicionGuardada(CLAVE_ANTES_EJEMPLO)
  if (guardada && esEjemploGuiado(guardada)) {
    borrarClave(CLAVE_ANTES_EJEMPLO)
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

/** Programa del mando (teach-in): PTP por ejes, LIN en línea recta. */
export function programaDelMando(puntos: PuntoEnsenado[], modeloM: ReturnType<typeof robotPorId>, herrMando: Herramienta): Programa | null {
  if (!puntos.length) return null
  const comandos: Comando[] = [{ tipo: 'AXIS', q: [...HOME], vel: 40, nodo: 'mando' }]
  let salida = false
  for (const p of puntos) {
    if (p.tipo === 'PTP') comandos.push({ tipo: 'AXIS', q: p.q, vel: 40, nodo: 'mando' })
    else {
      const pose = poseDe(modeloM, p.q, herrMando.largo, 0)
      const xt = { x: pose.R[0][0], y: pose.R[1][0], z: pose.R[2][0] }
      const zt = { x: pose.R[0][2], y: pose.R[1][2], z: pose.R[2][2] }
      const zPlano = { x: -xt.x, y: -xt.y, z: -xt.z }
      const yPlano = { x: zPlano.y * zt.z - zPlano.z * zt.y, y: zPlano.z * zt.x - zPlano.x * zt.z, z: zPlano.x * zt.y - zPlano.y * zt.x }
      comandos.push({ tipo: 'LIN', plano: { o: pose.tcp, x: zt, y: yPlano, z: zPlano }, vel: 0.15, nodo: 'mando' })
    }
    if (p.salida && p.salida.valor !== salida) {
      salida = p.salida.valor
      comandos.push({ tipo: 'OUT', salida: 1, valor: salida, nodo: 'mando' }, { tipo: 'WAIT', seg: 0.5, nodo: 'mando' })
    }
  }
  const rv: RobotVirtual = { modelo: modeloM, pedestal: 0 }
  return { comandos, robot: rv, herramienta: herrMando, base: planoXY(v()), espesor: 0, inicio: [...HOME], nodo: 'mando' }
}
