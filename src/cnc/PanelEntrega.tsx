import type { MutableRefObject } from 'react'
import CajonEntregar from '../components/banco/CajonEntregar'
import { filasCoordenadas } from './TablaPuntos'
import type { material as materialDe } from './maquinas'
import { almacenDe, torretaDe, type ConfigCNC } from './maquinas'
import { type ResultadoGcode } from './gcode'
import { herramientasLlamadas, revisarTrabajo } from './trabajo'
import { copiarTabla, descargarTexto } from '../entregar'
import { CLAVES } from '../persistencia'
import { entregable, nombreArchivo } from '../tareas/entregables'

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
    clave={CLAVES.cncEntrega}
    trabajoSugerido="Tarea-3"
    onCerrar={onCerrar}
    revisar={() => revisarTrabajo(config, codigo).puntos}
    presentacion={[
      {
        ...entregable('cnc', 'trayectoria'),
        hacer: async (base) => {
          const nombre = nombreArchivo('cnc', 'trayectoria', base)
          await exportarPlano(nombre)
          return `Descargada: ${nombre}`
        },
      },
      {
        ...entregable('cnc', 'coordenadas'),
        hacer: async () => {
          const filas = filasCoordenadas(resultado, torno, lineas, casa)
          if (filas.length < 2) throw new Error('El programa todavía no mueve la máquina.')
          return (await copiarTabla(filas)) ? 'Tabla copiada: pégala en tu presentación (Ctrl+V).' : 'Tu navegador no dejó copiar.'
        },
      },
      {
        ...entregable('cnc', 'herramientas'),
        hacer: async () => {
          const lista = torno ? torretaDe(config) : almacenDe(config)
          const uso = herramientasLlamadas(codigo, torno)
          if (!uso.size) throw new Error('Tu programa no llama a ninguna herramienta (T).')
          const filas = [...uso.entries()].sort((a, b) => a[0] - b[0]).map(([t, ls]) => [`T${t}`, lista.find((h) => h.t === t)?.nombre ?? '(no está en la torreta)', lista.find((h) => h.t === t)?.uso ?? '', ls.join(', ')])
          return (await copiarTabla([['Herramienta', 'Nombre', 'Para qué sirve', 'Líneas'], ...filas])) ? 'Tabla copiada: pégala en tu presentación (Ctrl+V).' : 'Tu navegador no dejó copiar.'
        },
      },
      {
        ...entregable('cnc', 'bruto'),
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
        ...entregable('cnc', 'trabajo'),
        hacer: (base) => {
          const nombre = nombreArchivo('cnc', 'trabajo', base)
          descargarTexto(trabajoJson(), nombre, 'application/json')
          return `Descargado: ${nombre}`
        },
      },
      {
        ...entregable('cnc', 'cnc'),
        hacer: (base) => {
          const nombre = nombreArchivo('cnc', 'cnc', base)
          descargarTexto(codigo.replace(/\n/g, '\r\n'), nombre)
          return `Descargado: ${nombre}`
        },
      },
      {
        ...entregable('cnc', 'video', grabando),
        deshabilitado: !puedeGrabar || grabando,
        porque: grabando ? 'Grabando… pulsa «■ Detener grabación» arriba al terminar.' : 'Tu navegador no permite grabar video.',
        hacer: (base) => {
          nombreVideo.current = nombreArchivo('cnc', 'video', base)
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
