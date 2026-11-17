import type { MutableRefObject } from 'react'
import CajonEntregar from '../components/banco/CajonEntregar'
import { filasCoordenadas } from './TablaPuntos'
import type { material as materialDe } from './maquinas'
import { almacenDe, torretaDe, type ConfigCNC } from './maquinas'
import { type ResultadoGcode } from './gcode'
import { herramientasLlamadas, revisarTrabajo } from './trabajo'
import { copiarTabla, descargarTexto } from '../entregar'

/** Lo que se entrega en la Tarea 3: la revisión, las tablas, los archivos y el video. */
export default function PanelEntrega({
  config,
  codigo,
  resultado,
  torno,
  lineas,
  casa,
  mat,
  trabajoJson,
  exportarPlano,
  grabando,
  puedeGrabar,
  nombreVideo,
  reiniciar,
  alternarGrabacion,
  correr,
  onCerrar,
}: {
  config: ConfigCNC
  codigo: string
  resultado: ResultadoGcode
  torno: boolean
  lineas: string[]
  casa: { x: number; y: number; z: number }
  mat: ReturnType<typeof materialDe>
  trabajoJson: () => string
  exportarPlano: (nombreArchivo?: string) => Promise<void>
  grabando: boolean
  puedeGrabar: boolean
  nombreVideo: MutableRefObject<string | null>
  reiniciar: () => void
  alternarGrabacion: () => void
  correr: (modo: 'corriendo' | 'bloque') => void
  onCerrar: () => void
}) {
  return (
  <CajonEntregar
    unidad="CNC"
    clave="neumalab.cnc.entrega"
    trabajoSugerido="Tarea-3"
    onCerrar={onCerrar}
    revisar={() => revisarTrabajo(config, codigo).puntos}
    presentacion={[
      {
        id: 'trayectoria',
        tipo: 'imagen',
        titulo: 'Trayectoria con sus puntos',
        detalle: 'La silueta que recorre la herramienta, con los puntos numerados.',
        hacer: async (base) => {
          await exportarPlano(`${base}_trayectoria.png`)
          return `Descargada: ${base}_trayectoria.png`
        },
      },
      {
        id: 'coordenadas',
        tipo: 'tabla',
        titulo: 'Tabla de coordenadas',
        detalle: 'Dónde queda la herramienta en cada bloque, en absolutas e incrementales.',
        hacer: async () => {
          const filas = filasCoordenadas(resultado, torno, lineas, casa)
          if (filas.length < 2) throw new Error('El programa todavía no mueve la máquina.')
          return (await copiarTabla(filas)) ? 'Tabla copiada: pégala en tu presentación (Ctrl+V).' : 'Tu navegador no dejó copiar.'
        },
      },
      {
        id: 'herramientas',
        tipo: 'tabla',
        titulo: 'Herramientas que usa tu programa',
        detalle: 'Cada herramienta con su nombre y en qué líneas se llama.',
        hacer: async () => {
          const lista = torno ? torretaDe(config) : almacenDe(config)
          const uso = herramientasLlamadas(codigo, torno)
          if (!uso.size) throw new Error('Tu programa no llama a ninguna herramienta (T).')
          const filas = [...uso.entries()].sort((a, b) => a[0] - b[0]).map(([t, ls]) => [`T${t}`, lista.find((h) => h.t === t)?.nombre ?? '(no está en la torreta)', lista.find((h) => h.t === t)?.uso ?? '', ls.join(', ')])
          return (await copiarTabla([['Herramienta', 'Nombre', 'Para qué sirve', 'Líneas'], ...filas])) ? 'Tabla copiada: pégala en tu presentación (Ctrl+V).' : 'Tu navegador no dejó copiar.'
        },
      },
      {
        id: 'bruto',
        tipo: 'tabla',
        titulo: 'Material y dimensiones del bruto',
        detalle: 'Lo que pusiste en Preparación.',
        hacer: async () => {
          const filas = torno
            ? [['Material', 'Diámetro (mm)', 'Largo (mm)', 'Toman las garras (mm)', 'Sobremetal en la cara (mm)'], [mat.nombre, String(config.torno.diametro), String(config.torno.largo), String(config.torno.agarre), String(config.torno.sobremetal)]]
            : [['Material', 'Largo X (mm)', 'Ancho Y (mm)', 'Alto Z (mm)'], [mat.nombre, String(config.fresa.largo), String(config.fresa.ancho), String(config.fresa.alto)]]
          return (await copiarTabla(filas)) ? 'Tabla copiada: pégala en tu presentación (Ctrl+V).' : 'Tu navegador no dejó copiar.'
        },
      },
    ]}
    archivos={[
      {
        id: 'trabajo',
        tipo: 'archivo',
        titulo: 'Tu programa (.json)',
        detalle: 'Programa y preparación en un archivo. Adjúntalo en Aula junto con tu PDF; se abre en la app con Archivo › Abrir.',
        hacer: (base) => {
          descargarTexto(trabajoJson(), `${base}.json`, 'application/json')
          return `Descargado: ${base}.json`
        },
      },
      {
        id: 'cnc',
        tipo: 'archivo',
        titulo: 'Programa .cnc',
        detalle: 'Opcional: solo el código G, en texto. También se abre en CNC Simulator Pro.',
        hacer: (base) => {
          descargarTexto(codigo.replace(/\n/g, '\r\n'), `${base}.cnc`)
          return `Descargado: ${base}.cnc`
        },
      },
      {
        id: 'video',
        tipo: 'video',
        titulo: 'Video de la simulación',
        detalle: grabando ? 'Grabando… pulsa «■ Detener grabación» arriba al terminar.' : 'Graba la máquina 3D mientras mecaniza; se descarga al detener.',
        deshabilitado: !puedeGrabar || grabando,
        porque: grabando ? 'Grabando… pulsa «■ Detener grabación» arriba al terminar.' : 'Tu navegador no permite grabar video.',
        hacer: (base) => {
          nombreVideo.current = `${base}_simulacion`
          reiniciar()
          alternarGrabacion()
          setTimeout(() => correr('corriendo'), 300)
          return 'Grabando desde el inicio. Al terminar el mecanizado pulsa «■ Detener grabación» (arriba a la derecha).'
        },
      },
    ]}
  />
  )
}
