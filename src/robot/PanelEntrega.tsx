import CajonEntregar from '../components/banco/CajonEntregar'
import { copiarTabla, descargarTexto, leerAlumno } from '../entregar'
import { exportarPng, exportarPngEncuadrado } from '../exportar'
import type { MutableRefObject } from 'react'
import type { Simulacion } from './movimiento'
import { MARCA_TAREA4, analizarTarea4, revisarTarea4 } from './tarea4'
import type { Definicion, evaluar } from './nodos'
import type { robotPorId } from './robots'

/** Lo que se entrega en la tarea de Robótica: la revisión, las imágenes, el archivo y el video. */
export default function PanelEntrega({
  def,
  sim,
  simActiva,
  evaluacion,
  enTarea,
  modo,
  modeloVista,
  grabando,
  puedeGrabar,
  nombreVideo,
  tRef,
  alternarGrabacion,
  setReproduciendo,
  croquisPng,
  onCerrar,
}: {
  def: Definicion
  sim: Simulacion | null
  simActiva: Simulacion | null
  evaluacion: ReturnType<typeof evaluar>
  enTarea: boolean
  modo: 'visual' | 'mando'
  modeloVista: ReturnType<typeof robotPorId>
  grabando: boolean
  puedeGrabar: boolean
  nombreVideo: MutableRefObject<string | null>
  tRef: MutableRefObject<number>
  alternarGrabacion: () => void
  setReproduciendo: (v: boolean) => void
  croquisPng: (tipo: string, archivo: string) => Promise<void>
  onCerrar: () => void
}) {
  return (
  <CajonEntregar
    unidad="Robótica"
    clave="neumalab.robot.entrega"
    trabajoSugerido="Tarea-4"
    onCerrar={onCerrar}
    revisar={() => {
      const errs = sim?.problemas.filter((p) => p.nivel === 'error') ?? []
      const avs = sim?.problemas.filter((p) => p.nivel === 'aviso') ?? []
      // En la tarea, además: el plano, la fresa, el husillo, los trazos recorridos y el nombre.
      const deLaTarea = enTarea ? revisarTarea4(analizarTarea4(def), leerAlumno().nombre) : []
      return [
        { ok: !!sim, texto: sim ? `El Core arma un programa de ${sim.tiempo.toFixed(1)} s.` : 'El Core todavía no arma un programa: necesita comandos, robot y herramienta.' },
        ...(enTarea ? [] : [{ ok: !!def.dxf, texto: def.dxf ? `Usas el plano «${def.dxf.nombre}».` : 'No abriste un plano DXF: si el enunciado trae un plano, ábrelo con «Abrir DXF».' }]),
        { ok: errs.length === 0, texto: errs.length === 0 ? 'La simulación no encuentra errores (alcance, límites de ejes).' : `La simulación encuentra ${errs.length} error(es). El primero: ${errs[0].texto}` },
        { ok: avs.length === 0, texto: avs.length === 0 ? 'Sin avisos de singularidades ni de cercanía a los límites.' : `${avs.length} aviso(s). Revísalos en la pestaña Análisis.` },
        { ok: !evaluacion.ciclo, texto: evaluacion.ciclo ? 'Hay un ciclo en los cables.' : 'Los cables no forman ciclos.' },
        ...deLaTarea,
      ]
    }}
    presentacion={[
      {
        id: 'croquis-pieza',
        tipo: 'imagen',
        titulo: 'Croquis de la pieza',
        detalle: 'Pégala en la diapositiva Pieza de la plantilla. No la subas aparte.',
        hacer: async (base) => {
          await croquisPng('pieza', `${base}_croquis-pieza.png`)
          return `Descargada: ${base}_croquis-pieza.png`
        },
      },
      {
        id: 'posicionamiento',
        tipo: 'imagen',
        titulo: 'Posicionamiento del robot',
        detalle: 'Pégala en la diapositiva Pieza, junto al croquis. No la subas aparte.',
        hacer: async (base) => {
          await croquisPng('posicion', `${base}_posicionamiento.png`)
          return `Descargada: ${base}_posicionamiento.png`
        },
      },
      {
        id: 'definicion-png',
        tipo: 'imagen',
        titulo: 'Tu definición (los nodos)',
        detalle: 'Sale la definición completa, aunque no la veas entera en pantalla. Pégala en la diapositiva Programa. No la subas aparte.',
        deshabilitado: modo !== 'visual',
        porque: 'Cambia a «Programación visual».',
        hacer: async (base) => {
          const svg = document.querySelector('svg[data-lienzo-nodos]') as SVGSVGElement | null
          if (!svg) throw new Error('No se encontró el lienzo de nodos.')
          const contenido = svg.querySelector(':scope > g[transform]') as SVGGElement | null
          if (contenido) await exportarPngEncuadrado(svg, contenido, `${base}_definicion.png`)
          else await exportarPng(svg, `${base}_definicion.png`)
          return `Descargada: ${base}_definicion.png`
        },
      },
      {
        id: 'ficha',
        tipo: 'tabla',
        titulo: `Ficha técnica · ${modeloVista.nombre}`,
        detalle: 'Pégala en la diapositiva Robot y cita la ficha oficial de KUKA. No la subas aparte.',
        hacer: async () => {
          const filas = [
            ['Característica', 'Valor'],
            ['Modelo', modeloVista.nombre],
            ['Carga', `${modeloVista.carga} kg`],
            ['Alcance máximo', `${modeloVista.alcance} mm`],
            ['Repetibilidad', `± ${modeloVista.repetibilidad} mm`],
            ['Número de ejes', '6'],
            ['Peso', `${modeloVista.peso} kg`],
            ['Montaje', modeloVista.montaje],
            ['Rango de los ejes', modeloVista.limites.map((l, k) => `A${k + 1} ${l[0]}°/${l[1]}°`).join(' · ')],
          ]
          return (await copiarTabla(filas)) ? 'Tabla copiada: pégala en la diapositiva Robot (Ctrl+V) y cita la ficha oficial de KUKA.' : 'Tu navegador no dejó copiar.'
        },
      },
    ]}
    archivos={[
      {
        id: 'definicion',
        tipo: 'archivo',
        titulo: 'Tu definición (NeumaLab)',
        detalle: 'Súbelo a Aula junto con el PDF de la plantilla y el video. Trae el plano y tu nombre.',
        hacer: (base) => {
          const alumno = leerAlumno()
          descargarTexto(JSON.stringify(enTarea ? { ...def, tarea: MARCA_TAREA4, ...(alumno.nombre.trim() ? { alumno } : {}) } : def, null, 2), `${base}.json`, 'application/json')
          return `Descargado: ${base}.json`
        },
      },
      {
        id: 'video',
        tipo: 'video',
        titulo: 'Video de la simulación',
        detalle: grabando ? 'Grabando… se detiene sola al terminar el recorrido. Si quieres cortar antes, pulsa «■ Detener grabación» arriba.' : 'La simulación completa, de principio a fin. Es un archivo aparte: no lo insertes en el PPT.',
        deshabilitado: !puedeGrabar || grabando || !simActiva,
        porque: grabando ? 'Grabando… pulsa «■ Detener grabación» arriba al terminar.' : !simActiva ? 'Todavía no hay recorrido que grabar.' : 'Tu navegador no permite grabar video.',
        hacer: (base) => {
          nombreVideo.current = `${base}_simulacion`
          tRef.current = 0
          alternarGrabacion()
          setReproduciendo(true)
          return 'Grabando desde el inicio. Al terminar el recorrido la grabación se detiene sola y baja el video. No cambies de pestaña mientras graba.'
        },
      },
    ]}
  />
  )
}
