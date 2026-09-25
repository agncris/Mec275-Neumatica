/**
 * Preguntas de práctica de CNC, generadas al azar: códigos G y M, palabras de
 * un bloque, absolutas e incrementales, y arcos.
 */
import { elegir, mezclar, type Generador } from '../components/Autoevaluacion'
import { CODIGOS_G, CODIGOS_M } from './gcode'

/** Los códigos que se ven en clases (los ciclos y variantes DIN quedan fuera). */
export const G_BASICOS = ['G00', 'G01', 'G02', 'G03', 'G04', 'G20', 'G21', 'G28', 'G90', 'G91', 'G94', 'G95', 'G96', 'G97', 'G40', 'G41', 'G42']
export const M_BASICOS = ['M00', 'M02', 'M03', 'M04', 'M05', 'M06', 'M08', 'M09', 'M30']

const codigos: Generador = (azar) => {
  const esG = azar() < 0.6
  const lista = esG ? G_BASICOS : M_BASICOS
  const dic = esG ? CODIGOS_G : CODIGOS_M
  const c = elegir(lista, azar)
  const otros = [...lista].filter((x) => x !== c).sort(() => azar() - 0.5)
  if (azar() < 0.5) {
    const m = mezclar(dic[c], otros.map((o) => dic[o]), azar)
    return { tema: 'Códigos G y M', enunciado: `¿Qué hace ${c}?`, ...m, explicacion: `${c}: ${dic[c]}.` }
  }
  const m = mezclar(c, otros, azar)
  return { tema: 'Códigos G y M', enunciado: `¿Qué código significa: «${dic[c]}»?`, ...m, explicacion: `${c}: ${dic[c]}.` }
}

export const PALABRAS: Array<[string, string]> = [
  ['N', 'el número de bloque (de línea)'],
  ['F', 'la velocidad de avance'],
  ['S', 'la velocidad del husillo (rpm) o de corte'],
  ['T', 'la herramienta que se usa'],
  ['M', 'una función auxiliar de la máquina (husillo, refrigerante, fin…)'],
  ['G', 'una función preparatoria (tipo de movimiento, unidades, coordenadas…)'],
  ['R', 'el radio de un arco (G02/G03)'],
]

const palabras: Generador = (azar) => {
  const [l, que] = elegir(PALABRAS, azar)
  const m = mezclar(l, PALABRAS.map((p) => p[0]).sort(() => azar() - 0.5), azar)
  return { tema: 'Estructura del bloque', enunciado: `En un bloque de código G, ¿qué letra indica ${que}?`, ...m, explicacion: `${l} indica ${que}.` }
}

/** Absolutas e incrementales en la fresadora (X e Y en mm, sin diámetros). */
const incrementales: Generador = (azar) => {
  const r = () => Math.round(azar() * 16) * 5 - 20
  const a = { x: r(), y: r() }
  let b = { x: r(), y: r() }
  if (b.x === a.x && b.y === a.y) b = { x: a.x + 15, y: a.y - 10 }
  const d = { x: b.x - a.x, y: b.y - a.y }
  const aIncremental = azar() < 0.5
  const fmt = (p: { x: number; y: number }) => `X${p.x} Y${p.y}`
  if (aIncremental) {
    const ok = `G91 G01 ${fmt(d)}`
    const m = mezclar(ok, [`G91 G01 ${fmt(b)}`, `G91 G01 ${fmt({ x: -d.x, y: -d.y })}`, `G90 G01 ${fmt(d)}`], azar)
    return {
      tema: 'Absolutas e incrementales',
      enunciado: `La herramienta está en X${a.x} Y${a.y}. ¿Qué bloque la lleva a X${b.x} Y${b.y} en coordenadas incrementales?`,
      ...m,
      explicacion: `En G91 se escribe cuánto se mueve desde donde está: ΔX = ${b.x} − (${a.x}) = ${d.x} y ΔY = ${b.y} − (${a.y}) = ${d.y}.`,
    }
  }
  const ok = `G90 G01 ${fmt(b)}`
  const m = mezclar(ok, [`G90 G01 ${fmt(d)}`, `G91 G01 ${fmt(b)}`, `G90 G01 ${fmt({ x: a.x - d.x, y: a.y - d.y })}`], azar)
  return {
    tema: 'Absolutas e incrementales',
    enunciado: `La herramienta está en X${a.x} Y${a.y} y debe moverse ${d.x} mm en X y ${d.y} mm en Y. ¿Qué bloque lo hace en coordenadas absolutas?`,
    ...m,
    explicacion: `En G90 se escribe el punto de llegada medido desde el cero pieza: X${a.x} + (${d.x}) = ${b.x}, Y${a.y} + (${d.y}) = ${b.y}.`,
  }
}

const ARCOS: Array<{ p: string; ok: string; mal: string[]; porque: string }> = [
  {
    p: 'Mirando el plano de trabajo desde arriba (fresadora, plano XY), el arco va en el sentido de las agujas del reloj. ¿Qué código se usa?',
    ok: 'G02',
    mal: ['G03', 'G01', 'G00'],
    porque: 'G02 es el arco en sentido horario (CW); G03, en sentido antihorario (CCW).',
  },
  {
    p: 'En un bloque G02 o G03, ¿qué indica la palabra R?',
    ok: 'El radio del arco',
    mal: ['El punto de inicio del arco', 'La velocidad de avance del arco', 'El número de vueltas'],
    porque: 'Con R se da el radio; el punto final va en X/Y (o X/Z en el torno) y el inicio es donde está la herramienta.',
  },
  {
    p: '¿Qué necesita un bloque G02 para dibujar el arco con radio?',
    ok: 'El punto final y el radio (R)',
    mal: ['Sólo el radio', 'El punto de inicio y el punto final', 'El centro y el ángulo'],
    porque: 'El arco parte de la posición actual; se le da el punto final y el radio R (o el centro con I, J, K).',
  },
]

const arcos: Generador = (azar) => {
  const q = elegir(ARCOS, azar)
  const m = mezclar(q.ok, q.mal, azar)
  return { tema: 'Arcos', enunciado: q.p, ...m, explicacion: q.porque }
}

export const PREGUNTAS_CNC = [
  { tema: 'Códigos G y M', generar: codigos },
  { tema: 'Estructura del bloque', generar: palabras },
  { tema: 'Absolutas e incrementales', generar: incrementales },
  { tema: 'Arcos', generar: arcos },
]
