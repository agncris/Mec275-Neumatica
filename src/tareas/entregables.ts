/**
 * Qué se entrega en cada tarea. Es la única fuente: la interfaz (el cajón «Entregar» de cada
 * unidad) lee de aquí los títulos, las explicaciones y los nombres de archivo, y
 * `npm run entregables` imprime lo mismo en Markdown para pegarlo en el enunciado.
 * Así el enunciado y la app no se desalinean.
 *
 * Lo que hace cada botón (descargar, copiar la tabla, grabar) sigue en el panel de la
 * unidad; aquí solo está lo que se le cuenta al alumno.
 *
 * En los nombres de archivo, `{base}` es «Nombre_Apellido[_Compañero]_Tarea-N».
 */

export type TipoEntregable = 'imagen' | 'tabla' | 'archivo' | 'video'
export type IdTarea = 'neumatica' | 'plc' | 'cnc' | 'robotica'

export interface Entregable {
  id: string
  tipo: TipoEntregable
  /** `{modelo}` se reemplaza por el robot elegido (solo en la ficha técnica de Robótica). */
  titulo: string
  detalle: string
  /** El detalle mientras se graba (solo los videos). */
  detalleGrabando?: string
  /** Nombre del archivo que baja, con `{base}`. Las tablas se copian: no tienen. */
  archivo?: string
  /** El alumno puede no entregarlo. */
  opcional?: boolean
}

export interface TareaEntregable {
  id: IdTarea
  /** Como se llama en el curso. */
  nombre: string
  /** Nombre sugerido para los archivos: `Nombre_Apellido_{sugerido}`. */
  sugerido: string
  /** Lo que se pega en la presentación (PPT) y se guarda como PDF. */
  presentacion: Entregable[]
  /** Lo que se sube a Aula junto con el PDF. */
  archivos: Entregable[]
}

export const TAREAS: Record<IdTarea, TareaEntregable> = {
  neumatica: {
    id: 'neumatica',
    nombre: 'Tarea 1 · Neumática',
    sugerido: 'Tarea-1',
    presentacion: [
      { id: 'vdi', tipo: 'imagen', titulo: 'Diagrama VDI 2860', detalle: 'Las funciones que armaste arriba, en orden y con tus notas.', archivo: '{base}_diagrama-VDI.png' },
      { id: 'fase', tipo: 'imagen', titulo: 'Diagrama espacio-fase', detalle: 'Sale de la simulación: pulsa ▶ Simular y deja que el ciclo corra al menos una vez.', archivo: '{base}_diagrama-fase.png' },
      { id: 'elementos', tipo: 'tabla', titulo: 'Elementos del circuito', detalle: 'Cantidad y tipo de cada elemento de tu circuito.' },
      { id: 'circuito-png', tipo: 'imagen', titulo: 'Imagen del circuito', detalle: 'El esquema tal como está en el banco.', archivo: '{base}_circuito.png' },
    ],
    archivos: [
      { id: 'circuito', tipo: 'archivo', titulo: 'Tu circuito (MecLab)', detalle: 'Se abre en la app con Archivo › Abrir y se puede simular. Incluye tu diagrama VDI.', archivo: '{base}.json' },
    ],
  },
  plc: {
    id: 'plc',
    nombre: 'Tarea 2 · PLC',
    sugerido: 'Tarea-2',
    presentacion: [
      { id: 'ladder', tipo: 'imagen', titulo: 'Diagrama Ladder', detalle: 'Tu programa completo, escalón por escalón.', archivo: '{base}_ladder.png' },
      { id: 'es', tipo: 'tabla', titulo: 'Tabla de entradas y salidas', detalle: 'Símbolo, dirección, tipo y descripción, desde la pestaña «Entradas y salidas».' },
    ],
    archivos: [
      { id: 'programa', tipo: 'archivo', titulo: 'Tu programa (.json)', detalle: 'Adjúntalo en Aula junto con tu PDF. Se abre en la app con Archivo › Abrir.', archivo: '{base}.json' },
    ],
  },
  cnc: {
    id: 'cnc',
    nombre: 'Tarea 3 · CNC',
    sugerido: 'Tarea-3',
    presentacion: [
      { id: 'trayectoria', tipo: 'imagen', titulo: 'Trayectoria con sus puntos', detalle: 'La silueta que recorre la herramienta, con los puntos numerados.', archivo: '{base}_trayectoria.png' },
      { id: 'coordenadas', tipo: 'tabla', titulo: 'Tabla de coordenadas', detalle: 'Dónde queda la herramienta en cada bloque, en absolutas e incrementales.' },
      { id: 'herramientas', tipo: 'tabla', titulo: 'Herramientas que usa tu programa', detalle: 'Cada herramienta con su nombre y en qué líneas se llama.' },
      { id: 'bruto', tipo: 'tabla', titulo: 'Material y dimensiones del bruto', detalle: 'Lo que pusiste en Preparación.' },
    ],
    archivos: [
      { id: 'trabajo', tipo: 'archivo', titulo: 'Tu programa (.json)', detalle: 'Programa y preparación en un archivo. Adjúntalo en Aula junto con tu PDF; se abre en la app con Archivo › Abrir.', archivo: '{base}.json' },
      { id: 'cnc', tipo: 'archivo', titulo: 'Programa .cnc', detalle: 'Opcional: solo el código G, en texto. También se abre en CNC Simulator Pro.', archivo: '{base}.cnc', opcional: true },
      {
        id: 'video',
        tipo: 'video',
        titulo: 'Video de la simulación',
        detalle: 'Graba la máquina 3D mientras mecaniza; se descarga al detener.',
        detalleGrabando: 'Grabando… pulsa «■ Detener grabación» arriba al terminar.',
        archivo: '{base}_simulacion',
      },
    ],
  },
  robotica: {
    id: 'robotica',
    nombre: 'Tarea 4 · Robótica',
    sugerido: 'Tarea-4',
    presentacion: [
      { id: 'croquis-pieza', tipo: 'imagen', titulo: 'Croquis de la pieza', detalle: 'Pégala en la diapositiva Pieza de la plantilla. No la subas aparte.', archivo: '{base}_croquis-pieza.png' },
      { id: 'posicionamiento', tipo: 'imagen', titulo: 'Posicionamiento del robot', detalle: 'Pégala en la diapositiva Pieza, junto al croquis. No la subas aparte.', archivo: '{base}_posicionamiento.png' },
      { id: 'definicion-png', tipo: 'imagen', titulo: 'Tu definición (los nodos)', detalle: 'Sale la definición completa, aunque no la veas entera en pantalla. Pégala en la diapositiva Programa. No la subas aparte.', archivo: '{base}_definicion.png' },
      { id: 'ficha', tipo: 'tabla', titulo: 'Ficha técnica · {modelo}', detalle: 'Pégala en la diapositiva Robot y cita la ficha oficial de KUKA. No la subas aparte.' },
    ],
    archivos: [
      { id: 'definicion', tipo: 'archivo', titulo: 'Tu definición (MecLab)', detalle: 'Súbelo a Aula junto con el PDF de la plantilla y el video. Trae el plano y tu nombre.', archivo: '{base}.json' },
      {
        id: 'video',
        tipo: 'video',
        titulo: 'Video de la simulación',
        detalle: 'La simulación completa, de principio a fin. Es un archivo aparte: no lo insertes en el PPT.',
        detalleGrabando: 'Grabando… se detiene sola al terminar el recorrido. Si quieres cortar antes, pulsa «■ Detener grabación» arriba.',
        archivo: '{base}_simulacion',
      },
    ],
  },
}

function buscar(tarea: IdTarea, id: string): Entregable {
  const t = TAREAS[tarea]
  const e = [...t.presentacion, ...t.archivos].find((x) => x.id === id)
  if (!e) throw new Error(`La tarea ${tarea} no tiene el entregable «${id}»`)
  return e
}

/** Lo que la interfaz le muestra al alumno de un entregable: id, tipo, título y explicación. */
export function entregable(tarea: IdTarea, id: string, grabando = false): Pick<Entregable, 'id' | 'tipo' | 'titulo' | 'detalle'> {
  const e = buscar(tarea, id)
  return { id: e.id, tipo: e.tipo, titulo: e.titulo, detalle: grabando && e.detalleGrabando ? e.detalleGrabando : e.detalle }
}

/** El nombre del archivo que baja un entregable, con la base ya puesta («Ana_Perez_Tarea-2_ladder.png»). */
export function nombreArchivo(tarea: IdTarea, id: string, base: string): string {
  const a = buscar(tarea, id).archivo
  if (!a) throw new Error(`El entregable «${id}» de ${tarea} no baja un archivo`)
  return a.replace('{base}', base)
}

const ROTULO_TIPO: Record<TipoEntregable, string> = { imagen: 'imagen', tabla: 'tabla', archivo: 'archivo', video: 'video' }

/** Todo lo que se entrega, en Markdown, para pegarlo en el enunciado. */
export function entregablesEnMarkdown(tareas: IdTarea[] = ['neumatica', 'plc', 'cnc', 'robotica']): string {
  const fila = (e: Entregable, sugerido: string) => {
    const titulo = e.titulo.replace('{modelo}', 'el robot elegido')
    const nombre = e.archivo ? ` Archivo: \`${e.archivo.replace('{base}', `Nombre_Apellido_${sugerido}`)}\`.` : ''
    const opc = e.opcional ? ' (opcional)' : ''
    return `- **${titulo}**${opc} (${ROTULO_TIPO[e.tipo]}). ${e.detalle}${nombre}`
  }
  const partes: string[] = []
  for (const id of tareas) {
    const t = TAREAS[id]
    partes.push(`## ${t.nombre}`, '', `Los archivos parten con tu nombre y la tarea. Si trabajas en pareja, con el nombre de los dos: \`Nombre_Apellido_Compañero_${t.sugerido}\`.`, '', '### Para pegar en tu presentación (PPT), que guardas como PDF', '', ...t.presentacion.map((e) => fila(e, t.sugerido)), '', '### Archivos que subes a Aula junto con tu PDF', '', ...t.archivos.map((e) => fila(e, t.sugerido)), '')
  }
  return partes.join('\n').trimEnd() + '\n'
}
