/**
 * Preguntas de práctica de neumática, generadas al azar: orificios de las
 * válvulas, vías y posiciones, grupos del método cascada y símbolos VDI 2860.
 * Son de repaso: no son las preguntas de los controles ni de las tareas.
 */
import { elegir, mezclar, type Generador } from '../Autoevaluacion'
import { analizarSecuencia } from '../../secuencias'
import { FUNCIONES_VDI, SimboloVDI } from '../../symbols/SimbolosVDI'

export const ORIFICIOS: Array<[string, string]> = [
  ['1', 'la alimentación (presión)'],
  ['2', 'una salida de trabajo (la que da 1 → 2)'],
  ['3', 'un escape'],
  ['12', 'el pilotaje que conecta 1 con 2'],
  ['14', 'el pilotaje que conecta 1 con 4'],
  ['10', 'el pilotaje que cierra el paso de 1'],
]

const REGLA = '1 alimenta, 2 y 4 son salidas de trabajo, 3 y 5 escapes. Los pilotajes se numeran con las vías que conectan: 12 une 1 con 2, 14 une 1 con 4 y 10 cierra el paso de 1.'

const orificios: Generador = (azar) => {
  const [n, que] = elegir(ORIFICIOS, azar)
  const otros = ORIFICIOS.filter((o) => o[0] !== n).sort(() => azar() - 0.5)
  if (azar() < 0.5) {
    const m = mezclar(
      que,
      otros.map((o) => o[1]),
      azar,
    )
    return {
      tema: 'Orificios',
      enunciado: `En una válvula (ISO 5599), ¿qué es el orificio ${n}?`,
      ...m,
      explicacion: `El ${n} es ${que}. ${REGLA}`,
    }
  }
  const m = mezclar(
    n,
    otros.map((o) => o[0]),
    azar,
  )
  return {
    tema: 'Orificios',
    enunciado: `En una válvula (ISO 5599), ¿qué número lleva ${que}?`,
    ...m,
    explicacion: `Es el ${n}. ${REGLA}`,
  }
}

const VALVULAS: Array<{
  p: string
  ok: string
  mal: string[]
  porque: string
}> = [
  {
    p: '¿Qué significa «5/2» en una válvula?',
    ok: '5 orificios (vías) y 2 posiciones',
    mal: ['5 posiciones y 2 orificios', '5 bar y 2 salidas', '5 mm de diámetro y 2 pilotajes'],
    porque: 'El primer número son las vías (orificios) y el segundo, las posiciones (los cuadros del símbolo).',
  },
  {
    p: '¿Qué significa «3/2» en una válvula?',
    ok: '3 orificios (vías) y 2 posiciones',
    mal: ['3 posiciones y 2 orificios', '3 salidas de trabajo y 2 escapes', '3 pilotajes y 2 muelles'],
    porque: 'Una 3/2 tiene alimentación (1), salida (2) y escape (3), y dos posiciones.',
  },
  {
    p: 'Una válvula monoestable, al dejar de accionarla…',
    ok: 'vuelve sola a su posición de reposo (muelle)',
    mal: ['se queda en la última posición', 'corta el aire de todo el circuito', 'cambia a una tercera posición'],
    porque: 'Monoestable: tiene una sola posición estable; el muelle la devuelve.',
  },
  {
    p: 'Una válvula biestable (5/2 con dos pilotajes)…',
    ok: 'se queda donde la dejó el último pilotaje: tiene memoria',
    mal: ['vuelve sola por el muelle', 'sólo funciona mientras se mantiene pilotada', 'no puede mover un cilindro de doble efecto'],
    porque: 'Biestable: las dos posiciones son estables; cambia sólo cuando llega el pilotaje contrario.',
  },
  {
    p: 'Una 3/2 normalmente cerrada (NC), en reposo…',
    ok: 'tiene la salida 2 conectada al escape 3',
    mal: ['tiene la salida 2 con presión', 'tiene 1 conectado con 3', 'tiene todos los orificios cerrados'],
    porque: 'NC: en reposo no deja pasar el aire; la salida queda a escape. Al accionarla, 1 pasa a 2.',
  },
  {
    p: '¿Qué válvula se usa normalmente para mover un cilindro de doble efecto?',
    ok: 'Una 5/2 (o 4/2)',
    mal: ['Una 3/2', 'Una válvula antirretorno', 'Una válvula de escape rápido'],
    porque: 'El doble efecto necesita dos salidas (2 y 4): una empuja hacia afuera y la otra hacia adentro.',
  },
  {
    p: '¿Qué hace una válvula de simultaneidad (función Y)?',
    ok: 'Da salida sólo si llega aire por las dos entradas',
    mal: ['Da salida si llega aire por cualquiera de las dos entradas', 'Regula la velocidad del cilindro', 'Mantiene la presión constante'],
    porque: 'Simultaneidad = Y. La selectora (O) da salida con cualquiera de las dos.',
  },
  {
    p: '¿Qué hace un regulador de caudal unidireccional puesto a la salida del cilindro?',
    ok: 'Regula la velocidad del vástago estrangulando el aire que sale',
    mal: ['Aumenta la fuerza del cilindro', 'Cambia el sentido del movimiento', 'Corta el aire en una emergencia'],
    porque: 'Estrangular el escape da un movimiento más parejo que estrangular la entrada.',
  },
]

const valvulas: Generador = (azar) => {
  const q = elegir(VALVULAS, azar)
  const m = mezclar(q.ok, q.mal, azar)
  return { tema: 'Válvulas', enunciado: q.p, ...m, explicacion: q.porque }
}

/** Una secuencia al azar de 2 o 3 cilindros: cada uno sale y vuelve una vez. */
function secuenciaAlAzar(azar: () => number): string {
  const letras = ['A', 'B', 'C'].slice(0, azar() < 0.5 ? 2 : 3)
  const pendientes = letras.map((l) => [`${l}+`, `${l}-`])
  const salida: string[] = []
  while (pendientes.some((p) => p.length)) {
    const vivos = pendientes.filter((p) => p.length)
    salida.push(elegir(vivos, azar).shift()!)
  }
  return salida.join(' ')
}

const cascada: Generador = (azar) => {
  const texto = secuenciaAlAzar(azar)
  const a = analizarSecuencia(texto)
  const n = a.grupos.length
  const division = a.grupos.map((g) => g.map((x) => x.texto).join(' ')).join(' / ')
  const bonita = texto.replace(/-/g, '−')
  if (azar() < 0.5) {
    const m = mezclar(
      String(n),
      ['1', '2', '3', '4', '5'].filter((x) => x !== String(n)),
      azar,
    )
    return {
      tema: 'Método cascada',
      enunciado: `Para la secuencia ${bonita}, ¿en cuántos grupos se divide con el método cascada?`,
      ...m,
      explicacion: `Se abre un grupo nuevo cada vez que una letra se repetiría: ${division}. Son ${n} grupo${n === 1 ? '' : 's'}.`,
    }
  }
  const v = Math.max(n - 1, 0)
  const m = mezclar(
    String(v),
    ['0', '1', '2', '3', '4'].filter((x) => x !== String(v)),
    azar,
  )
  return {
    tema: 'Método cascada',
    enunciado: `Para la secuencia ${bonita}, ¿cuántas válvulas de cascada (5/2 biestables) hacen falta?`,
    ...m,
    explicacion: `Grupos: ${division}. Válvulas de cascada = grupos − 1 = ${n} − 1 = ${v}.${v === 0 ? ' Con un solo grupo no hay señales bloqueantes: no hace falta cascada.' : ''}`,
  }
}

const vdi: Generador = (azar) => {
  const f = elegir(FUNCIONES_VDI, azar)
  const otros = FUNCIONES_VDI.filter((x) => x.n !== f.n).sort(() => azar() - 0.5)
  const m = mezclar(
    f.nombre,
    otros.map((o) => o.nombre),
    azar,
  )
  return {
    tema: 'Simbología VDI 2860',
    enunciado: '¿Qué función de manipulación representa este símbolo VDI 2860?',
    figura: (
      <div
        style={{
          width: 90,
          height: 90,
          border: '1px solid #e0e5eb',
          borderRadius: 8,
          background: '#fff',
          padding: 4,
        }}
      >
        <SimboloVDI n={f.n} />
      </div>
    ),
    ...m,
    explicacion: `Es la función nº ${f.n}: ${f.nombre}.`,
  }
}

export const PREGUNTAS_NEUMATICA = [
  { tema: 'Orificios', generar: orificios },
  { tema: 'Válvulas', generar: valvulas },
  { tema: 'Método cascada', generar: cascada },
  { tema: 'Simbología VDI 2860', generar: vdi },
]
