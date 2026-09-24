/**
 * Definiciones de ejemplo de la unidad de robótica (programas por nodos, al
 * estilo Grasshopper + KUKA|prc). Son ejemplos de estudio: no corresponden a
 * ninguna evaluación.
 */
import { dxfDeEjemplo } from './geometria'
import { componente, paramsIniciales, type Cable, type Definicion, type NodoDef, type ValorParam } from './nodos'

type N = [id: string, tipo: string, x: number, y: number, params?: Record<string, ValorParam>]
type C = [de: string, salida: number, a: string, entrada: number]

function def(nombre: string, nodos: N[], cables: C[], dxf?: Definicion['dxf']): Definicion {
  return {
    version: 1,
    tipo: 'definicion-robot',
    nombre,
    nodos: nodos.map(([id, tipo, x, y, params]): NodoDef => {
      const comp = componente(tipo)
      if (!comp) throw new Error(`Componente ${tipo} no existe`)
      return { id, tipo, x, y, params: { ...paramsIniciales(comp), ...(params ?? {}) } }
    }),
    cables: cables.map(([de, salida, a, entrada]): Cable => ({ de, salida, a, entrada })),
    dxf: dxf ?? null,
  }
}

export interface EjemploRobot {
  id: string
  titulo: string
  resumen: string
  definicion: () => Definicion
}

export const EJEMPLOS_ROBOT: EjemploRobot[] = [
  {
    id: 'basico',
    titulo: '1 · Estructura básica: rectángulo con LIN',
    resumen: 'Las siete partes de toda simulación en KUKA|prc: curva, puntos, planos, comando, robot, herramienta y Core.',
    definicion: () =>
      def(
        'Estructura básica',
        [
          ['rec', 'rectangulo', 20, 40, { x: 150, y: 100 }],
          ['lar', 'slider', 20, 200, { valor: 10, min: 2, max: 50, paso: 1 }],
          ['div', 'dividirLargo', 220, 60],
          ['xy', 'planoXY', 400, 60],
          ['vel', 'slider', 400, 170, { valor: 0.05, min: 0.01, max: 0.5, paso: 0.01 }],
          ['lin', 'lin', 580, 80],
          ['rob', 'robot', 580, 220],
          ['her', 'herramienta', 580, 330, { tipo: 'lapiz', largo: 150, diametro: 10 }],
          ['core', 'core', 780, 140, { espesor: 5 }],
          ['pan', 'panel', 400, 280],
        ],
        [
          ['rec', 0, 'div', 0],
          ['lar', 0, 'div', 1],
          ['div', 0, 'xy', 0],
          ['xy', 0, 'lin', 0],
          ['vel', 0, 'lin', 1],
          ['lin', 0, 'core', 0],
          ['rob', 0, 'core', 1],
          ['her', 0, 'core', 2],
          ['div', 0, 'pan', 0],
        ],
      ),
  },
  {
    id: 'aproximacion',
    titulo: '2 · Acercarse y alejarse con PTP',
    resumen: 'El robot llega con PTP sobre el primer punto, dibuja con LIN y se retira: Move, List Item y Command Weaver.',
    definicion: () =>
      def(
        'Acercarse y alejarse',
        [
          ['pol', 'poligono', 20, 40, { r: 60, s: 6 }],
          ['mv0', 'mover', 20, 200, { x: 90, y: 70, z: 0 }],
          ['div', 'kukaDividir', 220, 60, { d: 8 }],
          ['it0', 'item', 400, 20, { i: 0 }],
          ['it1', 'item', 400, 250, { i: -1 }],
          ['up0', 'mover', 560, 20, { x: 0, y: 0, z: 40 }],
          ['up1', 'mover', 560, 250, { x: 0, y: 0, z: 40 }],
          ['ptp', 'ptp', 740, 20, { v: 40 }],
          ['lin', 'lin', 740, 130, { v: 0.05 }],
          ['sal', 'lin', 740, 250, { v: 0.1 }],
          ['wea', 'tejer', 920, 110],
          ['rob', 'robot', 920, 250],
          ['her', 'herramienta', 920, 350, { tipo: 'lapiz', largo: 150, diametro: 10 }],
          ['core', 'core', 1100, 180],
        ],
        [
          ['pol', 0, 'mv0', 0],
          ['mv0', 0, 'div', 0],
          ['div', 0, 'it0', 0],
          ['div', 0, 'it1', 0],
          ['it0', 0, 'up0', 0],
          ['it1', 0, 'up1', 0],
          ['up0', 0, 'ptp', 0],
          ['div', 0, 'lin', 0],
          ['up1', 0, 'sal', 0],
          ['ptp', 0, 'wea', 0],
          ['lin', 0, 'wea', 1],
          ['sal', 0, 'wea', 2],
          ['wea', 0, 'core', 0],
          ['rob', 0, 'core', 1],
          ['her', 0, 'core', 2],
        ],
      ),
  },
  {
    id: 'fresado',
    titulo: '3 · Fresado de una placa desde un DXF',
    resumen:
      'Plano DXF de ejemplo: contorno compensado con Offset (radio de la fresa), taladrado de los agujeros con Area + Command Weaver (intercalar) y husillo con salida digital.',
    definicion: () =>
      def(
        'Fresado de placa (DXF de ejemplo)',
        [
          ['crv', 'curvaDXF', 20, 40, { capa: 'CONTORNO' }],
          ['off', 'desfase', 180, 40, { d: 2.5 }],
          ['baj', 'mover', 340, 40, { x: 0, y: 0, z: -5 }],
          ['div', 'dividirLargo', 500, 40, { l: 5 }],
          ['pxy', 'planoXY', 500, 160],
          ['it0', 'item', 660, -60, { i: 0 }],
          ['it1', 'item', 660, 150, { i: -1 }],
          ['up0', 'mover', 820, -60, { x: 0, y: 0, z: 30 }],
          ['up1', 'mover', 820, 150, { x: 0, y: 0, z: 30 }],
          ['ptp', 'ptp', 980, -60, { v: 40 }],
          ['lin', 'lin', 980, 50, { v: 0.02 }],
          ['sal', 'lin', 980, 150, { v: 0.1 }],
          ['w1', 'tejer', 1140, 30],
          ['agu', 'curvaDXF', 20, 300, { capa: 'AGUJEROS' }],
          ['are', 'area', 180, 300],
          ['xy', 'planoXY', 340, 300],
          ['sob', 'mover', 500, 260, { x: 0, y: 0, z: 20 }],
          ['fon', 'mover', 500, 380, { x: 0, y: 0, z: -6 }],
          ['l1', 'lin', 660, 260, { v: 0.1 }],
          ['l2', 'lin', 660, 380, { v: 0.01 }],
          ['w2', 'tejer', 820, 320, { modo: 'intercalar' }],
          ['on', 'salida', 1140, -120, { salida: 1, valor: true }],
          ['esp', 'esperar', 1140, -40, { t: 2 }],
          ['off1', 'salida', 1140, 250, { salida: 1, valor: false }],
          ['m1', 'unir', 1300, -60],
          ['m2', 'unir', 1300, 120],
          ['rob', 'robot', 1300, 260],
          ['her', 'herramienta', 1300, 360, { tipo: 'fresa', largo: 200, diametro: 5 }],
          ['core', 'core', 1470, 120, { espesor: 5 }],
        ],
        [
          ['crv', 0, 'off', 0],
          ['off', 0, 'baj', 0],
          ['baj', 0, 'div', 0],
          ['div', 0, 'pxy', 0],
          ['pxy', 0, 'it0', 0],
          ['pxy', 0, 'it1', 0],
          ['it0', 0, 'up0', 0],
          ['it1', 0, 'up1', 0],
          ['up0', 0, 'ptp', 0],
          ['pxy', 0, 'lin', 0],
          ['up1', 0, 'sal', 0],
          ['ptp', 0, 'w1', 0],
          ['lin', 0, 'w1', 1],
          ['sal', 0, 'w1', 2],
          ['agu', 0, 'are', 0],
          ['are', 1, 'xy', 0],
          ['xy', 0, 'sob', 0],
          ['xy', 0, 'fon', 0],
          ['sob', 0, 'l1', 0],
          ['fon', 0, 'l2', 0],
          ['l1', 0, 'w2', 0],
          ['l2', 0, 'w2', 1],
          ['l1', 0, 'w2', 2],
          ['on', 0, 'm1', 0],
          ['esp', 0, 'm1', 1],
          ['w1', 0, 'm1', 2],
          ['m1', 0, 'm2', 0],
          ['w2', 0, 'm2', 1],
          ['off1', 0, 'm2', 2],
          ['m2', 0, 'core', 0],
          ['rob', 0, 'core', 1],
          ['her', 0, 'core', 2],
        ],
        { nombre: 'placa-ejemplo.dxf', texto: dxfDeEjemplo() },
      ),
  },
  {
    id: 'vacio',
    titulo: 'Definición en blanco (sólo robot, herramienta y Core)',
    resumen: 'Para armar tu propia definición desde cero.',
    definicion: () =>
      def(
        'Mi definición',
        [
          ['rob', 'robot', 500, 60],
          ['her', 'herramienta', 500, 180],
          ['core', 'core', 700, 100],
        ],
        [
          ['rob', 0, 'core', 1],
          ['her', 0, 'core', 2],
        ],
      ),
  },
]
