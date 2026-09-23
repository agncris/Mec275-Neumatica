/**
 * Ejercicios para resolver: el enunciado, la planta y la tabla de conexiones,
 * con el programa en blanco. La aplicación no trae la solución: el alumno
 * programa y «Verificar mi programa» lo prueba contra la planta simulada,
 * diciendo en qué paso del enunciado falla (sin mostrar cómo resolverlo).
 */
import { escalonVacio, estadoInicial, scan, type IdPlanta, type ProgramaPLC, type Simbolo } from './ladder'
import { PlantaElevador } from './plantas'

export interface ResultadoVerificacion {
  ok: boolean
  mensajes: Array<{ ok: boolean; texto: string }>
}

export interface EjercicioPLC {
  id: string
  titulo: string
  planta: IdPlanta
  /** Pasos del enunciado, en orden. */
  enunciado: string[]
  /** Esquema de conexiones: símbolo, dirección y descripción. */
  simbolos: Simbolo[]
  /** Qué se pide entregar / hacer. */
  consigna: string[]
  verificar: (p: ProgramaPLC) => ResultadoVerificacion
}

// ---------------------------------------------------------------------------
// Ejercicio 2 · Elevador de piezas
// ---------------------------------------------------------------------------
const SIMBOLOS_ELEVADOR: Simbolo[] = [
  { dir: 'I0.0', nombre: 'S0', descripcion: 'Detector de proximidad. Determina que hay una pieza lista para ser elevada' },
  { dir: 'I0.1', nombre: 'S1', descripcion: 'Detector fin de carrera. Determina que el cilindro Z1 se halla en su posición inicial' },
  { dir: 'I0.2', nombre: 'S2', descripcion: 'Detector fin de carrera. Determina que el cilindro Z1 se halla en su posición final' },
  { dir: 'I0.3', nombre: 'S3', descripcion: 'Detector fin de carrera. Determina que el cilindro Z2 se halla en su posición inicial' },
  { dir: 'I0.4', nombre: 'S4', descripcion: 'Detector fin de carrera. Determina que el cilindro Z2 se halla en su posición final' },
  { dir: 'Q0.0', nombre: 'Y1', descripcion: 'Electroválvula. Activa al cilindro Z1' },
  { dir: 'Q0.1', nombre: 'Y2', descripcion: 'Electroválvula. Activa al cilindro Z2' },
]

/** Corre el programa contra el elevador y cuenta qué pasa. */
function ensayarElevador(p: ProgramaPLC) {
  const planta = new PlantaElevador()
  const estado = estadoInicial()
  const dt = 0.02
  const orden: string[] = []
  let y1 = false
  let y2 = false
  const correr = (s: number) => {
    for (let i = 0; i < Math.round(s / dt); i++) {
      scan(p, estado, planta.sensores(), dt)
      const q = { 'Q0.0': estado.bits['Q0.0'], 'Q0.1': estado.bits['Q0.1'] }
      if (q['Q0.0'] !== y1) orden.push(q['Q0.0'] ? 'Z1+' : 'Z1−')
      if (q['Q0.1'] !== y2) orden.push(q['Q0.1'] ? 'Z2+' : 'Z2−')
      y1 = q['Q0.0']
      y2 = q['Q0.1']
      planta.paso(q, dt)
    }
  }
  return { planta, orden, correr }
}

function verificarElevador(p: ProgramaPLC): ResultadoVerificacion {
  const mensajes: ResultadoVerificacion['mensajes'] = []
  const e = ensayarElevador(p)

  // Paso 1: sin pieza, todo quieto.
  e.correr(2)
  const quieto = e.orden.length === 0
  mensajes.push({
    ok: quieto,
    texto: quieto
      ? 'Paso 1: sin pieza en la plataforma, los cilindros se quedan retraídos.'
      : 'Paso 1: sin pieza en la plataforma algún cilindro se mueve. El ciclo sólo debe empezar cuando S0 detecta una pieza.',
  })

  // Primera pieza.
  e.planta.accion('pieza')
  const inicio = e.orden.length
  e.correr(14)
  const ciclo = e.orden.slice(inicio)
  const esperado = ['Z1+', 'Z2+', 'Z2−', 'Z1−']
  const pasos = [
    ['Paso 2: S0 detecta la pieza y Z1 sube (Y1).', 'Paso 2: al llegar la pieza, Z1 no sube. Revisa la condición de Y1 con S0.'],
    ['Paso 3: con Z1 arriba (S2), Z2 sale a empujar (Y2).', 'Paso 3: Z1 llega arriba pero Z2 no sale, o sale antes de tiempo.'],
    ['Paso 4: con Z2 en su final (S4), Z2 vuelve.', 'Paso 4: Z2 llega a su final (S4) pero no se retrae.'],
    ['Paso 5: con Z2 de vuelta (S3), Z1 baja.', 'Paso 5: Z2 vuelve a su inicio pero Z1 no baja.'],
  ]
  let bien = true
  for (let i = 0; i < esperado.length; i++) {
    const ok = bien && ciclo[i] === esperado[i]
    mensajes.push({ ok, texto: ok ? pasos[i][0] : pasos[i][1] })
    if (!ok) bien = false
  }
  if (bien && ciclo.length > esperado.length) {
    bien = false
    mensajes.push({ ok: false, texto: `Después del ciclo sigue habiendo movimientos: ${ciclo.slice(4).join(' ')}. El ciclo debe terminar con los dos cilindros retraídos.` })
  }
  const transferida = e.planta.transferidas === 1
  mensajes.push({
    ok: transferida,
    texto: transferida ? 'La pieza llega a la segunda banda.' : 'La pieza no llega a la segunda banda.',
  })
  // Sólo cuenta si hubo ciclo: con un programa que no hace nada, los cilindros
  // también están «en su inicio».
  const enInicio = bien && transferida && e.planta.z1 <= 0.02 && e.planta.z2 <= 0.02
  mensajes.push({
    ok: enInicio,
    texto: enInicio
      ? 'Paso 6: con S1 activo el sistema queda listo para un nuevo ciclo.'
      : 'Paso 6: al terminar, los cilindros no quedan en su posición inicial.',
  })

  // Paso 7: una pieza nueva repite el ciclo.
  e.planta.accion('pieza')
  e.correr(14)
  const repite = e.planta.transferidas === 2
  mensajes.push({
    ok: repite,
    texto: repite ? 'Paso 7: con una pieza nueva el ciclo se repite.' : 'Paso 7: con una pieza nueva el ciclo no se repite.',
  })

  const avisos = e.planta.eventos.filter((x) => x.aviso)
  for (const a of avisos.slice(0, 2)) mensajes.push({ ok: false, texto: `La planta avisa: ${a.mensaje}` })

  return { ok: mensajes.every((m) => m.ok), mensajes }
}

export const EJERCICIOS_PLC: EjercicioPLC[] = [
  {
    id: 'ejercicio2',
    titulo: 'Ejercicio 2 · Elevador de piezas',
    planta: 'elevador',
    enunciado: [
      'El sistema se encuentra en estado inicial: ambos cilindros Z1 y Z2 están retraídos y no hay piezas presentes en la plataforma del elevador.',
      'La pieza situada en la plataforma del elevador es detectada por S0; éste activa el movimiento de Z1 por medio del accionamiento de la válvula Y1.',
      'S2 determina que Z1 llega a su fin de carrera y Z2 da inicio al movimiento de extensión debido al accionamiento de la válvula Y2.',
      'S4 detecta la posición de fin de carrera y Z2 empieza a retraerse, concluido el trabajo de empujar la pieza a la segunda banda transportadora.',
      'S3 determina que el cilindro Z2 llega a su posición de inicio de carrera, con lo cual Z1 empieza a retraerse.',
      'Cuando S1 detecta que Z1 está en posición de inicio de carrera, el sistema está a punto para iniciar un nuevo ciclo.',
      'El ciclo se repite una vez que una nueva pieza llega a la plataforma del elevador.',
    ],
    simbolos: SIMBOLOS_ELEVADOR,
    consigna: [
      'Programa en Ladder el funcionamiento descrito, usando las entradas y salidas del esquema de conexiones.',
      'Pruébalo en la planta: pon una pieza (o activa la alimentación automática) y observa el ciclo.',
      'Cuando creas que funciona, pulsa «Verificar mi programa»: la aplicación lo prueba paso por paso.',
    ],
    verificar: verificarElevador,
  },
]

/** Programa en blanco para empezar un ejercicio. */
export function programaDeEjercicio(e: EjercicioPLC): ProgramaPLC {
  return {
    version: 1,
    tipo: 'programa-plc',
    nombre: e.titulo,
    planta: e.planta,
    ejercicio: e.id,
    simbolos: e.simbolos.map((s) => ({ ...s })),
    escalones: [escalonVacio()],
  }
}
