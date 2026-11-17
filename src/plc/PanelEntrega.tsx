import CajonEntregar from '../components/banco/CajonEntregar'
import type { Notacion } from './notacion'
import type { ProgramaPLC } from './ladder'
import { copiarTabla, descargarTexto } from '../entregar'
import { exportarPng } from '../exportar'
import { areaDe } from './ladder'
import { formatear } from './notacion'
import { CLAVES } from '../persistencia'

/** Lo que se entrega en la Tarea 2: la revisión, el diagrama, la tabla de E/S y el archivo. */
export default function PanelEntrega({
  programa,
  hayContenido,
  avisos,
  forzados,
  tieneEjercicio,
  notacion,
  onCerrar,
}: {
  programa: ProgramaPLC
  hayContenido: boolean
  avisos: string[]
  forzados: Record<string, boolean>
  /** Hay un ejercicio abierto (cambia una frase de la revisión). */
  tieneEjercicio: boolean
  notacion: Notacion
  onCerrar: () => void
}) {
  return (
  <CajonEntregar
    unidad="PLC"
    clave={CLAVES.plcEntrega}
    trabajoSugerido="Tarea-2"
    onCerrar={onCerrar}
    revisar={() => {
      const usadas = new Set<string>()
      for (const e of programa.escalones) {
        for (const f of e.celdas) for (const c of f) if ('dir' in c && typeof c.dir === 'string' && c.dir) usadas.add(c.dir)
        for (const b of e.bobinas) if (b?.dir) usadas.add(b.dir)
      }
      const sinNombre = [...usadas].filter((d) => ['I', 'Q'].includes(areaDe(d) ?? '') && !programa.simbolos.find((x) => x.dir === d)?.nombre)
      return [
        { ok: hayContenido, texto: hayContenido ? 'El programa no está vacío.' : 'El programa está vacío: todavía no hay nada que entregar.' },
        { ok: avisos.length === 0, texto: avisos.length === 0 ? 'El editor no encuentra problemas en el programa.' : `Hay ${avisos.length} aviso(s). El primero: ${avisos[0]}` },
        {
          ok: sinNombre.length === 0,
          texto: sinNombre.length === 0 ? 'Todas las entradas y salidas que usas tienen símbolo.' : `Ponle símbolo en la pestaña «Entradas y salidas» a: ${sinNombre.map((d) => formatear(d, notacion)).join(', ')}.`,
        },
        { ok: Object.keys(forzados).length === 0, texto: Object.keys(forzados).length === 0 ? 'No quedan entradas ni salidas forzadas.' : 'Quedan E/S forzadas: quítalas antes de probar y entregar.' },
        {
          ok: true,
          texto: tieneEjercicio ? 'Pruébalo con «✓ Verificar mi programa» del ejercicio y también en RUN, accionando la planta.' : 'Pruébalo en RUN accionando la planta (pestaña Planta) antes de entregar.',
        },
      ]
    }}
    presentacion={[
      {
        id: 'ladder',
        tipo: 'imagen',
        titulo: 'Diagrama Ladder',
        detalle: 'Tu programa completo, escalón por escalón.',
        hacer: async (base) => {
          const svg = document.getElementById('ladder-svg') as SVGSVGElement | null
          if (!svg) throw new Error('No se encontró el diagrama.')
          await exportarPng(svg, `${base}_ladder.png`)
          return `Descargada: ${base}_ladder.png`
        },
      },
      {
        id: 'es',
        tipo: 'tabla',
        titulo: 'Tabla de entradas y salidas',
        detalle: 'Símbolo, dirección, tipo y descripción, desde la pestaña «Entradas y salidas».',
        hacer: async () => {
          const tipo: Record<string, string> = { I: 'Entrada (INPUT)', Q: 'Salida (OUTPUT)', M: 'Marca', T: 'Temporizador', C: 'Contador' }
          const orden = 'IQMTC'
          const filas = programa.simbolos
            .filter((x) => x.nombre.trim())
            .sort((a, b) => orden.indexOf(areaDe(a.dir) ?? 'Z') - orden.indexOf(areaDe(b.dir) ?? 'Z') || a.dir.localeCompare(b.dir))
            .map((x) => [x.nombre, formatear(x.dir, notacion), tipo[areaDe(x.dir) ?? ''] ?? '', x.descripcion])
          if (!filas.length) throw new Error('Todavía no le pones símbolo a ninguna entrada o salida.')
          return (await copiarTabla([['Símbolo', 'Dirección', 'Tipo', 'Descripción'], ...filas])) ? 'Tabla copiada: pégala en tu presentación (Ctrl+V).' : 'Tu navegador no dejó copiar.'
        },
      },
    ]}
    archivos={[
      {
        id: 'programa',
        tipo: 'archivo',
        titulo: 'Tu programa (.json)',
        detalle: 'Adjúntalo en Aula junto con tu PDF. Se abre en la app con Archivo › Abrir.',
        hacer: (base) => {
          descargarTexto(JSON.stringify(programa, null, 2), `${base}.json`, 'application/json')
          return `Descargado: ${base}.json`
        },
      },
    ]}
  />
  )
}
