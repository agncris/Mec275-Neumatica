/**
 * Ejercicios para practicar en clase (Clase 2) y en el estudio para el control: tres
 * ejercicios de la clase, cinco fallas para diagnosticar y la figura de una pregunta
 * del control. Cada uno es una definición de nodos que se abre desde «Ejemplos».
 * Los enunciados no dicen cuál es la falla: eso se encuentra mirando los colores,
 * el análisis y el código KRL.
 */
import { EJEMPLOS_ROBOT } from './ejemplos'
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

export type GrupoPractica = 'clase' | 'fallas' | 'control' | 'retos'

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
  // Retos abiertos: no hay una sola respuesta. Sirven para probar caminos propios.
  {
    id: 'reto-figura',
    grupo: 'retos',
    titulo: 'Reto 1 · Dibuja tu propia figura',
    enunciado: 'Dibuja con el robot una figura tuya (una letra, un óvalo, una flor). Combina LIN y CIR como quieras. Vale cualquier figura si el análisis no marca errores. Anota qué hiciste.',
    definicion: () => {
      const d = copia(EJEMPLOS_ROBOT.find((e) => e.id === 'vacio')!.definicion())
      const her = d.nodos.find((n) => n.tipo === 'herramienta')
      if (her) Object.assign(her.params, { tipo: 'lapiz', largo: 150, diametro: 10 })
      d.nombre = 'Mi figura'
      return d
    },
  },
  {
    id: 'reto-posicion',
    grupo: 'retos',
    titulo: 'Reto 2 · ¿Dónde pongo la plancha?',
    enunciado: 'Cambia el robot y la posición de la plancha en el Core (X, Y y altura del mesón). Encuentra tres combinaciones que funcionen y tres que no, y anota por qué. Hay muchas respuestas.',
    definicion: () => copia(EJEMPLOS_ROBOT.find((e) => e.id === 'fresado')!.definicion()),
  },
  {
    id: 'reto-tiempo',
    grupo: 'retos',
    titulo: 'Reto 3 · Baja el tiempo del ciclo',
    enunciado: 'Baja el tiempo del ciclo sin errores: prueba velocidades, el orden de los movimientos y la separación de los puntos. Anota qué probaste. Hay más de un camino.',
    definicion: () => copia(EJEMPLOS_ROBOT.find((e) => e.id === 'aproximacion')!.definicion()),
  },
]

export const ETIQUETA_GRUPO: Record<GrupoPractica, string> = {
  clase: 'Practicar · Clase 2',
  fallas: 'Practicar · Diagnosticar fallas',
  control: 'Ejercicio del control',
  retos: 'Retos abiertos',
}
