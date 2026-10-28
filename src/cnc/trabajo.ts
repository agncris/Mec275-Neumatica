/**
 * El trabajo de CNC en un solo archivo (.json): programa, preparación y torreta
 * (y, en la Tarea 3, quién lo hizo), para entregarlo y volver a abrirlo sin pedirle
 * nada más al alumno. Aquí también está la revisión del trabajo, que usa el alumno
 * antes de entregar y que se muestra al abrir un .json.
 */
import { interpretar } from './gcode'
import { almacenDe, origenPrograma, posicionCasa, torretaDe, material as materialDe, type ConfigCNC, type HerramientaTorno } from './maquinas'
import { SimuladorCNC } from './simulador'
import type { DatosAlumno } from '../entregar'

export const TAREA_3 = 'tarea-3'

export interface TrabajoCNC {
  tipo: 'trabajo-cnc'
  version: 1 | 2
  /** Marca de la tarea de la que viene (sólo «tarea-3»). */
  tarea?: string
  alumno?: DatosAlumno
  nombre?: string
  config: ConfigCNC
  /** La torreta con que se corrió el programa (para revisarlo igual que lo vio el alumno). */
  torreta?: HerramientaTorno[]
  codigo: string
}

export function crearTrabajo(p: { nombre?: string; config: ConfigCNC; codigo: string; tarea?: string; alumno?: DatosAlumno }): TrabajoCNC {
  return {
    tipo: 'trabajo-cnc',
    version: 2,
    ...(p.tarea ? { tarea: p.tarea } : {}),
    ...(p.alumno && p.alumno.nombre.trim() ? { alumno: p.alumno } : {}),
    nombre: p.nombre,
    config: p.config,
    torreta: torretaDe(p.config),
    codigo: p.codigo,
  }
}

/** Lee un .json de trabajo. Falla con un mensaje claro si no lo es. */
export function leerTrabajo(texto: string): TrabajoCNC {
  let d: Partial<TrabajoCNC>
  try {
    d = JSON.parse(texto) as Partial<TrabajoCNC>
  } catch {
    throw new Error('Ese archivo no se puede leer: no es un .json válido.')
  }
  const c = d?.config as ConfigCNC | undefined
  if (d?.tipo !== 'trabajo-cnc' || !c || typeof d.codigo !== 'string' || !c.torno || !c.fresa || (c.maquina !== 'torno' && c.maquina !== 'fresadora')) {
    throw new Error('Ese archivo no es un trabajo de CNC de NeumaLab.')
  }
  // La torreta guardada manda: así la revisión usa las mismas herramientas que el alumno.
  const config: ConfigCNC = Array.isArray(d.torreta) && d.torreta.length ? { ...c, herramientasTorno: d.torreta } : c
  return { ...(d as TrabajoCNC), version: d.version === 2 ? 2 : 1, config }
}

/** Números de herramienta que llama el programa (en el torno, T0101 es la herramienta 1). */
export function herramientasLlamadas(codigo: string, torno: boolean): Map<number, number[]> {
  const uso = new Map<number, number[]>()
  codigo.split('\n').forEach((l, i) => {
    const limpia = l.replace(/\(.*?\)/g, '').replace(/;.*/, '')
    for (const m of limpia.matchAll(/\bT(\d+)/gi)) {
      const tt = Number(m[1])
      const t = torno && tt >= 100 ? Math.floor(tt / 100) : tt
      uso.set(t, [...(uso.get(t) ?? []), i + 1])
    }
  })
  return uso
}

export interface PuntoRevision {
  ok: boolean
  texto: string
}

export interface ResumenTrabajo {
  puntos: PuntoRevision[]
  /** Datos del trabajo, para quien lo revisa. */
  datos: Array<[string, string]>
}

/** Revisa un trabajo como lo haría la simulación completa: no califica, avisa. */
export function revisarTrabajo(config: ConfigCNC, codigo: string): ResumenTrabajo {
  const casa = posicionCasa(config)
  const radio = (t: number) => {
    const h = almacenDe(config).find((x) => x.t === t)
    return h ? h.diametro / 2 : undefined
  }
  const resultado = interpretar(codigo, config.maquina, casa, { origen: origenPrograma(config, codigo).origen, radio })
  const prueba = new SimuladorCNC(resultado, config, casa)
  prueba.terminar()
  const lineas = codigo.split('\n')
  const sinComentarios = lineas.filter((l) => !/^\s*[(;%]/.test(l))
  const limpia = (l: string) => l.replace(/\(.*?\)/g, '').replace(/;.*/, '')
  const mm = sinComentarios.some((l) => /\bG21\b/i.test(limpia(l)))
  const fin = sinComentarios.some((l) => /\bM(30|0?2)\b/i.test(limpia(l)))
  const errores = resultado.diagnosticos.filter((d) => d.nivel === 'error')
  const sinC = resultado.sinComentario
  const torno = config.maquina === 'torno'
  const lista: Array<{ t: number; nombre: string }> = torno ? torretaDe(config) : almacenDe(config)
  const herramientas = [...herramientasLlamadas(codigo, torno).keys()].sort((a, b) => a - b).map((t) => `T${t} ${lista.find((h) => h.t === t)?.nombre ?? '(no está en la torreta)'}`)
  const b = config.torno
  const cortes = resultado.puntos.some((p) => /^G0?[123]$/.test(p.codigo))
  const puntos: PuntoRevision[] = [
    {
      ok: cortes,
      texto: cortes ? 'El programa mecaniza: tiene movimientos de corte (G01, G02 o G03).' : 'El programa todavía no mecaniza: escribe la trayectoria con G01, G02 o G03.',
    },
    { ok: errores.length === 0, texto: errores.length === 0 ? 'El programa no tiene errores de escritura.' : `Hay ${errores.length} error(es). El primero, en la línea ${errores[0].linea + 1}: ${errores[0].texto}` },
    {
      ok: sinC.length === 0,
      texto: sinC.length === 0 ? 'Cada línea de código tiene su comentario.' : `Hay ${sinC.length} línea(s) de código sin comentario (por ejemplo la ${sinC[0] + 1}). Agrégalo entre paréntesis.`,
    },
    { ok: mm, texto: mm ? 'Trabaja en milímetros (G21).' : 'No encuentro G21: indica que trabajas en milímetros.' },
    { ok: fin, texto: fin ? 'El programa termina con M30 (o M02).' : 'El programa no termina con M30 ni M02.' },
    {
      ok: !prueba.alarma,
      texto: prueba.alarma ? `Al mecanizar todo salta una alarma en la línea ${prueba.alarma.linea + 1}: ${prueba.alarma.texto}` : 'La simulación completa llega al final sin alarmas ni choques.',
    },
    { ok: prueba.terminado && !prueba.alarma, texto: prueba.terminado && !prueba.alarma ? 'El ciclo completo termina.' : 'El ciclo completo no termina.' },
    {
      ok: prueba.consejos.length === 0,
      texto: prueba.consejos.length === 0 ? 'Sin avisos de pasadas muy profundas.' : `Hay ${prueba.consejos.length} aviso(s) de pasadas profundas (por ejemplo, en la línea ${prueba.consejos[0].linea + 1}: ${prueba.consejos[0].texto})`,
    },
  ]
  const datos: Array<[string, string]> = [
    ['Máquina', torno ? 'Centro de torneado' : 'Fresadora'],
    ['Material', materialDe(config.material).nombre],
    ['Bruto', torno ? `Ø${b.diametro} × ${b.largo} mm, garras ${b.agarre} mm, sobremetal ${b.sobremetal} mm` : `${config.fresa.largo} × ${config.fresa.ancho} × ${config.fresa.alto} mm`],
    ['Herramientas usadas', herramientas.length ? herramientas.join(' · ') : 'ninguna'],
    ['Líneas de código', String(sinComentarios.length)],
  ]
  return { puntos, datos }
}
