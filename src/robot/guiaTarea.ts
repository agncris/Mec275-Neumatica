/**
 * Guía de la Tarea 4: una lista de pasos cortos. Cada paso se marca solo cuando
 * lo que pide ya está en el lienzo, y el que toca ahora dice exactamente qué
 * hacer, dónde y por qué. Si el bloque ya está pero falta conectarlo o cambiar
 * un valor, la guía lo dice (la «pista»).
 *
 * No mira la solución: sólo comprueba qué hay en el lienzo y cómo está conectado,
 * así que sirve para cualquier camino válido (un Toolpath, LIN o CIR, otros
 * valores de Offset, etc.).
 */
import type { Definicion, NodoDef } from './nodos'

export type GrupoTarea = 'Contorno' | 'Ranuras' | 'Revisar'

export interface PasoTarea {
  id: string
  numero: number
  total: number
  grupo: GrupoTarea
  titulo: string
  donde: string
  accion: string
  listo: string
  por: string
  pasos: string[]
  /** Qué falta, si el bloque ya está en el lienzo a medias. */
  pista?: string
  pestana?: 'Trayectoria' | 'Movimientos' | 'Utilidades'
  destacar?: string
  seleccionar?: string
  enfocar?: string
}

/** Un bloque del mapa de la tarea: se marca cuando todos sus pasos están hechos. */
export interface PiezaMapa {
  id: string
  texto: string
  estado: 'hecho' | 'ahora' | 'falta'
}

/** Una etapa del mapa: una pregunta del proceso y los bloques que la responden. */
export interface EtapaMapa {
  id: string
  titulo: string
  piezas: PiezaMapa[]
}

export interface ItemAvance {
  id: string
  grupo: GrupoTarea
  titulo: string
  hecho: boolean
  ahora: boolean
}

interface Ctx {
  def: Definicion
  curvas: NodoDef[]
  contorno: NodoDef | undefined
  ranuras: NodoDef | undefined
  /** Ids alcanzables siguiendo los cables desde un nodo. */
  desde: (id: string) => Set<string>
  /** Nodos de un tipo que quedan después de un nodo. */
  despues: (id: string, tipo: string | string[]) => NodoDef[]
}

interface Def {
  id: string
  grupo: GrupoTarea
  titulo: string
  /** El paso ya está hecho. */
  hecho: (c: Ctx) => boolean
  /** Qué falta si está a medias. */
  pista?: (c: Ctx) => string | undefined
  donde: string
  accion: string
  listo: string
  por: string
  pasos: string[]
  pestana?: 'Trayectoria' | 'Movimientos' | 'Utilidades'
  destacar?: string
  seleccionar?: (c: Ctx) => string | undefined
  enfocar?: string
}

const capaDe = (n: NodoDef) => String(n.params.capa ?? '').trim().toUpperCase()
const num = (v: unknown, defecto = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : defecto)
const sinCableEnD = (c: Ctx, n: NodoDef) => !c.def.cables.some((k) => k.a === n.id && k.entrada === 1)

function contexto(def: Definicion): Ctx {
  const curvas = def.nodos.filter((n) => n.tipo === 'curvaDXF')
  const desde = (id: string) => {
    const vistos = new Set<string>()
    const pila = [id]
    while (pila.length) {
      const actual = pila.pop() as string
      for (const k of def.cables) if (k.de === actual && !vistos.has(k.a)) {
        vistos.add(k.a)
        pila.push(k.a)
      }
    }
    return vistos
  }
  const despues = (id: string, tipo: string | string[]) => {
    const tipos = Array.isArray(tipo) ? tipo : [tipo]
    const alcance = desde(id)
    return def.nodos.filter((n) => alcance.has(n.id) && tipos.includes(n.tipo))
  }
  return {
    def,
    curvas,
    contorno: curvas.find((n) => capaDe(n) === 'CONTORNO'),
    ranuras: curvas.find((n) => capaDe(n) === 'RANURAS'),
    desde,
    despues,
  }
}

const MOVS = ['recorrer', 'lin', 'cir']

/** Los pasos de una de las dos curvas (contorno o ranuras). */
function cadena(grupo: 'Contorno' | 'Ranuras'): Def[] {
  const esC = grupo === 'Contorno'
  // Hay otros caminos válidos (por ejemplo, una sola Curve con todas las capas y un Item por trazo),
  // así que sin capa elegida se usa la primera Curve.
  const cual = (c: Ctx) => (esC ? c.contorno ?? c.curvas.find((n) => capaDe(n) !== 'RANURAS') : c.ranuras ?? c.curvas.find((n) => capaDe(n) !== 'CONTORNO'))
  const k = esC ? 'c' : 'r'
  const pieza = esC ? 'el contorno' : 'las ranuras'
  const dOk = (d: number) => (esC ? d > 0 : d < 0)
  const signo = esC ? '+2,5 (hacia afuera)' : '-2,5 (hacia adentro)'
  return [
    {
      id: `${k}-curve`,
      grupo,
      titulo: esC ? 'Trae el dibujo (Curve)' : 'Trae otra Curve para las ranuras',
      hecho: (c) => (esC ? c.curvas.length >= 1 : c.curvas.length >= 2),
      donde: 'Paleta de la izquierda, pestaña Trayectoria, bloque Crv (borde azul).',
      accion: esC ? 'Arrastra Crv al lienzo.' : 'Arrastra un segundo Crv al lienzo, sin tocar el primero.',
      listo: esC ? 'Hay un bloque Crv en el lienzo.' : 'Hay dos bloques Crv en el lienzo.',
      por: esC ? 'Curve lee las líneas del plano que ya viene cargado. Sin ella el robot no sabe dónde cortar.' : 'El contorno y las ranuras se compensan al revés, por eso van en curvas distintas.',
      pasos: ['Abre Trayectoria en la paleta.', 'Arrastra Crv (borde azul) al lienzo gris, o haz clic para dejarlo en el centro.'],
      pestana: 'Trayectoria',
      destacar: 'curvaDXF',
    },
    {
      id: `${k}-capa`,
      grupo,
      titulo: esC ? 'Elige la capa CONTORNO' : 'Elige la capa RANURAS',
      hecho: (c) => (esC ? !!c.contorno : !!c.ranuras),
      pista: (c) => {
        const sin = c.curvas.find((n) => !['CONTORNO', 'RANURAS'].includes(capaDe(n)))
        return sin ? 'Esa Curve todavía dice «Todas las capas». Elige una capa en la lista.' : undefined
      },
      donde: 'Haz clic en el bloque Crv del lienzo. En el panel de abajo está la lista «Capa».',
      accion: esC ? 'Abre la lista Capa y elige CONTORNO.' : 'Abre la lista Capa de la segunda Curve y elige RANURAS.',
      listo: esC ? 'La lista dice CONTORNO.' : 'La lista dice RANURAS.',
      por: esC ? 'El plano tiene dos capas. Si no eliges, la Curve trae todas las líneas juntas.' : 'Las nueve aberturas están en la capa RANURAS.',
      pasos: ['Haz clic en el bloque Crv.', 'Abre la lista «Capa» en el panel de abajo.', esC ? 'Elige CONTORNO.' : 'Elige RANURAS.'],
      seleccionar: (c) => (esC ? c.curvas[0]?.id : c.curvas.find((n) => !['CONTORNO', 'RANURAS'].includes(capaDe(n)))?.id ?? c.curvas[c.curvas.length - 1]?.id),
      enfocar: 'capa',
    },
    {
      id: `${k}-offset-cable`,
      grupo,
      titulo: 'Agrega Offset Curve y conéctalo',
      hecho: (c) => {
        const cu = cual(c)
        return !!cu && c.despues(cu.id, 'desfase').length > 0
      },
      pista: (c) => {
        const cu = cual(c)
        if (!cu) return undefined
        const libres = c.def.nodos.filter((n) => n.tipo === 'desfase' && !c.def.cables.some((q) => q.a === n.id && q.entrada === 0))
        return libres.length ? 'Ya hay un Offset en el lienzo, pero no está conectado a la Curve. Arrastra desde el punto de la derecha de Crv hasta el punto C de la izquierda de Offset.' : undefined
      },
      donde: 'Pestaña Trayectoria, bloque Offset Curve (borde azul).',
      accion: `Arrástralo al lienzo y conecta la salida de Crv a su entrada C.`,
      listo: 'Hay un cable de Crv a Offset.',
      por: 'La fresa mide 5 mm. Si sigue la línea tal cual, corta 2,5 mm de más hacia un lado. Offset corre la línea el radio de la fresa.',
      pasos: ['Arrastra Offset Curve al lienzo.', 'Arrastra desde el punto de la derecha de Crv hasta el punto C (izquierda) de Offset.'],
      pestana: 'Trayectoria',
      destacar: 'desfase',
    },
    {
      id: `${k}-offset-d`,
      grupo,
      titulo: `Pon D en ${signo.split(' ')[0]} en ese Offset`,
      hecho: (c) => {
        const cu = cual(c)
        return !!cu && c.despues(cu.id, 'desfase').some((o) => !sinCableEnD(c, o) || dOk(num(o.params.d, 2.5)))
      },
      pista: (c) => {
        const cu = cual(c)
        const o = cu ? c.despues(cu.id, 'desfase')[0] : undefined
        return o ? `El Offset tiene D = ${num(o.params.d, 2.5)}. En ${pieza} debe ser ${signo}.` : undefined
      },
      donde: 'Haz clic en Offset. En el panel de abajo está el campo Distancia D.',
      accion: `Escribe D = ${esC ? '2,5' : '-2,5'}.`,
      listo: `D ${esC ? 'es positivo' : 'es negativo'}.`,
      por: esC ? 'En el contorno la fresa va por afuera de la línea: D positivo.' : 'En una ranura la fresa va por dentro de la abertura: D negativo.',
      pasos: ['Haz clic en el bloque Offset.', 'En el panel de abajo, cambia Distancia D.'],
      seleccionar: (c) => {
        const cu = cual(c)
        return cu ? c.despues(cu.id, 'desfase')[0]?.id : undefined
      },
      enfocar: 'd',
    },
    {
      id: `${k}-move`,
      grupo,
      titulo: 'Baja con Move a Z = -5',
      hecho: (c) => {
        const cu = cual(c)
        return !!cu && c.despues(cu.id, 'mover').some((m) => num(m.params.z) < 0)
      },
      pista: (c) => {
        const cu = cual(c)
        if (!cu) return undefined
        const dentro = c.despues(cu.id, 'mover')
        if (dentro.length) return `Move está conectado pero Z = ${num(dentro[0].params.z)}. Debe ser -5, el espesor de la plancha.`
        const suelto = c.def.nodos.some((n) => n.tipo === 'mover' && !c.def.cables.some((q) => q.a === n.id && q.entrada === 0))
        return suelto ? 'Hay un Move en el lienzo sin conectar. Lleva la salida de Offset a su entrada.' : undefined
      },
      donde: 'Pestaña Trayectoria, bloque Move (borde azul).',
      accion: 'Arrástralo, conéctalo a la salida de Offset y escribe Z = -5.',
      listo: 'Move dice Z = -5.',
      por: 'La plancha tiene 5 mm. La fresa debe bajar esos 5 mm para atravesarla. Si no, sólo la raya.',
      pasos: ['Arrastra Move al lienzo.', 'Conecta la salida de Offset a la entrada de Move.', 'Haz clic en Move y escribe Z = -5 (X e Y en 0).'],
      pestana: 'Trayectoria',
      destacar: 'mover',
    },
    {
      id: `${k}-path`,
      grupo,
      titulo: 'Convierte la curva en movimientos (Toolpath)',
      hecho: (c) => {
        const cu = cual(c)
        return !!cu && c.despues(cu.id, MOVS).length > 0
      },
      pista: (c) => {
        const cu = cual(c)
        if (!cu) return undefined
        const suelto = c.def.nodos.some((n) => n.tipo === 'recorrer' && !c.def.cables.some((q) => q.a === n.id && q.entrada === 0))
        return suelto ? 'Hay un Toolpath en el lienzo sin conectar. Lleva la salida de Move a su entrada C.' : undefined
      },
      donde: 'Pestaña Movimientos, bloque Path (Toolpath, borde azul).',
      accion: 'Arrástralo y conecta la salida de Move a su entrada. Déjalo con PTP para acercarse, LIN para cortar y PTP para salir.',
      listo: 'Hay un cable de Move a Toolpath.',
      por: 'Aquí la curva se vuelve movimientos del robot: se acerca en el aire (PTP), corta (LIN) y sale en el aire (PTP).',
      pasos: ['Abre Movimientos en la paleta.', 'Arrastra Path (Toolpath) al lienzo.', 'Conecta la salida de Move a su entrada.'],
      pestana: 'Movimientos',
      destacar: 'recorrer',
    },
  ]
}

const PASOS: Def[] = [
  ...cadena('Contorno'),
  {
    id: 'husillo-on',
    grupo: 'Contorno',
    titulo: 'Enciende el husillo (Set Digital Out en TRUE)',
    hecho: (c) => c.def.nodos.some((n) => n.tipo === 'salida' && n.params.valor !== false),
    donde: 'Pestaña Movimientos, bloque DOut (Set Digital Out).',
    accion: 'Arrástralo y déjalo en TRUE. Agrega también un Wait de 1 segundo.',
    listo: 'Hay un DOut en TRUE.',
    por: 'El husillo es el motor de la fresa. Si no está encendido, la fresa no corta. El Wait le da tiempo de tomar velocidad.',
    pasos: ['Arrastra DOut (Set Digital Out) y déjalo en TRUE.', 'Arrastra Wait y pon 1 s.'],
    pestana: 'Movimientos',
    destacar: 'salida',
  },
  {
    id: 'core',
    grupo: 'Contorno',
    titulo: 'Junta todo y llévalo al Core',
    hecho: (c) => {
      const core = c.def.nodos.find((n) => n.tipo === 'core')
      const cu = c.contorno ?? c.curvas[0]
      return !!core && !!cu && c.despues(cu.id, MOVS).some((m) => c.desde(m.id).has(core.id))
    },
    pista: (c) => {
      const core = c.def.nodos.find((n) => n.tipo === 'core')
      if (!core || !c.curvas.length) return undefined
      const hayUnir = c.def.nodos.some((n) => n.tipo === 'unir')
      return hayUnir ? 'Ya hay un Merge. Revisa que su salida llegue a la entrada C del Core y que el Toolpath entre en él.' : undefined
    },
    donde: 'Pestaña Utilidades (Merge) y la entrada C del Core.',
    accion: 'Usa Merge para juntar, en este orden: DOut (TRUE), Wait y Toolpath. Lleva su salida a la entrada C del Core.',
    listo: 'Aparece el botón ▶ activo bajo la vista 3D.',
    por: 'El Core arma el programa completo y es lo que se simula. Los comandos van en orden: encender, esperar, recorrer.',
    pasos: ['Abre Utilidades en la paleta y arrastra Merge (borde azul) al lienzo.', 'Conecta a Merge, en este orden: DOut en D1, Wait en D2 y el Toolpath en D3.', 'Lleva la salida de Merge a la entrada C del Core.', 'Pulsa ▶ y mira el contorno.'],
    pestana: 'Utilidades',
    destacar: 'unir',
  },
  ...cadena('Ranuras'),
  {
    id: 'unir-ranuras',
    grupo: 'Ranuras',
    titulo: 'Suma el recorrido de las ranuras al programa',
    hecho: (c) => {
      const core = c.def.nodos.find((n) => n.tipo === 'core')
      const cu = c.ranuras ?? c.curvas[c.curvas.length - 1]
      return !!core && !!cu && c.despues(cu.id, MOVS).some((m) => c.desde(m.id).has(core.id))
    },
    pista: (c) => (c.def.nodos.filter((n) => n.tipo === 'unir').length < 2 ? 'El primer Merge ya tiene sus tres entradas ocupadas. Por eso hace falta un segundo Merge.' : 'Ya hay dos Merge. Falta que el Toolpath de las ranuras entre al segundo y que su salida llegue a la C del Core.'),
    donde: 'Un segundo Merge, y la entrada C del Core.',
    accion: 'Conecta el Toolpath de las ranuras para que llegue al Core, después del contorno.',
    listo: 'El Toolpath de las ranuras llega al Core.',
    por: 'Lo que no llega al Core no se simula ni se exporta.',
    pasos: ['Abre Utilidades y arrastra otro Merge (borde azul).', 'Conecta ahí el Merge del contorno en D1 y el Toolpath de las ranuras en D2.', 'Lleva la salida del nuevo Merge a la entrada C del Core (reemplaza el cable anterior).'],
    pestana: 'Utilidades',
    destacar: 'unir',
  },
  {
    id: 'husillo-off',
    grupo: 'Ranuras',
    titulo: 'Apaga el husillo al terminar',
    hecho: (c) => c.def.nodos.some((n) => n.tipo === 'salida' && n.params.valor === false),
    donde: 'Pestaña Movimientos, otro bloque DOut.',
    accion: 'Agrega un Set Digital Out en FALSE al final del programa.',
    listo: 'Hay un DOut en FALSE después de las ranuras.',
    por: 'Un husillo encendido al volver a HOME es un riesgo. Se apaga antes de salir.',
    pasos: ['Arrastra otro DOut y desmarca «Activar (TRUE)» para dejarlo en FALSE.', 'Conéctalo a D3 del segundo Merge, después de las ranuras.'],
    pestana: 'Movimientos',
    destacar: 'salida',
  },
  {
    id: 'revisar',
    grupo: 'Revisar',
    titulo: 'Simula y revisa antes de entregar',
    hecho: () => false,
    donde: 'El botón ▶ bajo la vista 3D, el checklist de esta lámina y «Entregar Tarea Robótica».',
    accion: 'Pulsa ▶ y mira los diez trazos. Después abre Entregar y pulsa Revisar.',
    listo: 'El checklist queda todo en verde.',
    por: 'La revisión mide lo mismo que la pauta: recorrido, profundidad, husillo y movimientos.',
    pasos: ['Pulsa ▶ y mira la simulación completa.', 'Abre Entregar Tarea Robótica y pulsa Revisar.', 'Si algo queda con ☐, arréglalo y revisa de nuevo.'],
  },
]

/**
 * El mapa de la tarea: cuatro etapas, en el orden en que se arma y se prueba.
 * Cada pieza agrupa los pasos de un bloque (traerlo, conectarlo y darle su valor).
 */
const ETAPAS: Array<{ id: string; titulo: string; piezas: Array<[string, string[]]> }> = [
  {
    id: 'contorno',
    titulo: 'El contorno',
    piezas: [
      ['Curve CONTORNO', ['c-curve', 'c-capa']],
      ['Offset +2,5', ['c-offset-cable', 'c-offset-d']],
      ['Move Z -5', ['c-move']],
      ['Toolpath', ['c-path']],
    ],
  },
  {
    id: 'cortar',
    titulo: 'Que corte',
    piezas: [
      ['Encender husillo', ['husillo-on']],
      ['Al Core y ▶', ['core']],
    ],
  },
  {
    id: 'ranuras',
    titulo: 'Las ranuras',
    piezas: [
      ['Curve RANURAS', ['r-curve', 'r-capa']],
      ['Offset -2,5', ['r-offset-cable', 'r-offset-d']],
      ['Move Z -5', ['r-move']],
      ['Toolpath', ['r-path']],
    ],
  },
  {
    id: 'cerrar',
    titulo: 'Cerrar y revisar',
    piezas: [
      ['Ranuras al Core', ['unir-ranuras']],
      ['Apagar husillo', ['husillo-off']],
      ['Revisar', ['revisar']],
    ],
  },
]

/** El paso que toca ahora, el avance de toda la lista y el mapa por etapas. */
export function guiaTarea(def: Definicion): { paso: PasoTarea; avance: ItemAvance[]; etapas: EtapaMapa[] } {
  const c = contexto(def)
  const hechos = PASOS.map((p) => p.hecho(c))
  // Si un paso de una cadena (contorno o ranuras) ya está hecho, los anteriores de esa cadena también.
  for (const pref of ['c-', 'r-']) {
    const idx = PASOS.map((q, j) => (q.id.startsWith(pref) ? j : -1)).filter((j) => j >= 0)
    const ultimo = idx.filter((j) => hechos[j]).pop()
    if (ultimo !== undefined) for (const j of idx) if (j < ultimo) hechos[j] = true
  }
  // El primero que falta, aunque uno posterior ya esté hecho (por ejemplo, otro camino).
  let i = hechos.findIndex((h) => !h)
  if (i < 0) i = PASOS.length - 1
  const p = PASOS[i]
  const avance: ItemAvance[] = PASOS.map((q, j) => ({ id: q.id, grupo: q.grupo, titulo: q.titulo, hecho: hechos[j], ahora: j === i }))
  const hechoDe = new Map(PASOS.map((q, j) => [q.id, hechos[j]]))
  const etapas: EtapaMapa[] = ETAPAS.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    piezas: e.piezas.map(([texto, ids]) => ({
      id: ids[0],
      texto,
      estado: ids.includes(p.id) ? 'ahora' : ids.every((x) => hechoDe.get(x)) ? 'hecho' : 'falta',
    })),
  }))
  return {
    avance,
    etapas,
    paso: {
      id: p.id,
      numero: i + 1,
      total: PASOS.length,
      grupo: p.grupo,
      titulo: p.titulo,
      donde: p.donde,
      accion: p.accion,
      listo: p.listo,
      por: p.por,
      pasos: p.pasos,
      pista: p.pista?.(c),
      pestana: p.pestana,
      destacar: p.destacar,
      seleccionar: p.seleccionar?.(c),
      enfocar: p.enfocar,
    },
  }
}

/** Los bloques con que se arma la tarea, en el orden en que se usan. El resto de la paleta queda a un clic. */
export const BLOQUES_TAREA = ['curvaDXF', 'desfase', 'mover', 'recorrer', 'salida', 'esperar', 'unir']

export const TOTAL_PASOS_TAREA = PASOS.length
