/**
 * Ejercicios para practicar en clase (Clase 2) y en el estudio para el control: tres
 * ejercicios de la clase, cinco fallas para diagnosticar y la figura de una pregunta
 * del control. Cada uno es una definición de nodos que se abre desde «Ejemplos».
 * Los enunciados no dicen cuál es la falla: eso se encuentra mirando los colores,
 * el análisis y el código KRL.
 */
import type { Definicion } from './nodos'
import ejCir from '../../ejercicios-clase2/Ej_CIR.json'
import ejWeaver from '../../ejercicios-clase2/Ej_Weaver.json'
import ejAxis from '../../ejercicios-clase2/Ej_AXIS_KRL.json'
import fallaA from '../../ejercicios-clase2/Falla_A.json'
import fallaB from '../../ejercicios-clase2/Falla_B.json'
import fallaC from '../../ejercicios-clase2/Falla_C.json'
import fallaD from '../../ejercicios-clase2/Falla_D.json'
import fallaE from '../../ejercicios-clase2/Falla_E.json'
import controlP2 from '../../ejercicios-clase2/Control_P2.json'

export type GrupoPractica = 'clase' | 'fallas' | 'control'

export interface EjercicioPractica {
  id: string
  grupo: GrupoPractica
  titulo: string
  /** Una línea para el alumno. */
  enunciado: string
  definicion: () => Definicion
}

export const ENUNCIADO_FALLA = 'Esta definición tiene un problema. Encuéntralo.'

const copia = (d: unknown): Definicion => JSON.parse(JSON.stringify(d)) as Definicion

export const PRACTICA_ROBOT: EjercicioPractica[] = [
  {
    id: 'ej-cir',
    grupo: 'clase',
    titulo: 'Ejercicio 1 · Un arco con CIR',
    enunciado: 'Pulsa ▶ y mira la trayectoria. ¿Qué forma hace CIR y qué punto define el arco? Mueve el punto del medio hasta (50, 0) y mira qué avisa la app.',
    definicion: () => copia(ejCir),
  },
  {
    id: 'ej-weaver',
    grupo: 'clase',
    titulo: 'Ejercicio 2 · El orden con Command Weaver',
    enunciado: 'Cambia el modo de Command Weaver entre secuencia e intercalar. Mira en Código KRL qué orden queda en cada caso.',
    definicion: () => copia(ejWeaver),
  },
  {
    id: 'ej-axis',
    grupo: 'clase',
    titulo: 'Ejercicio 3 · AXIS y KRL a mano',
    enunciado: 'Busca en Código KRL cómo sale cada AXIS. Cambia un ángulo y mira la línea. ¿Qué pasa si A1 vale 200?',
    definicion: () => copia(ejAxis),
  },
  ...(
    [
      ['a', 'Falla A', fallaA],
      ['b', 'Falla B', fallaB],
      ['c', 'Falla C', fallaC],
      ['d', 'Falla D', fallaD],
      ['e', 'Falla E', fallaE],
    ] as Array<[string, string, unknown]>
  ).map(
    ([k, titulo, d]): EjercicioPractica => ({ id: `falla-${k}`, grupo: 'fallas', titulo, enunciado: ENUNCIADO_FALLA, definicion: () => copia(d) }),
  ),
  {
    id: 'control-p2',
    grupo: 'control',
    titulo: 'Pregunta 2 del control',
    enunciado: 'Esta definición debería dibujar un rectángulo de 150 por 100 mm con un lápiz, pero está mal conectada. Mira los colores de los nodos y encuentra la falla.',
    definicion: () => copia(controlP2),
  },
]

export const ETIQUETA_GRUPO: Record<GrupoPractica, string> = {
  clase: 'Practicar · Clase 2',
  fallas: 'Practicar · Diagnosticar fallas',
  control: 'Ejercicio del control',
}
