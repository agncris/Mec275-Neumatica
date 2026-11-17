import { describe, expect, it } from 'vitest'
import { TAREAS, entregable, entregablesEnMarkdown, nombreArchivo, type IdTarea } from '../tareas/entregables'

describe('entregables de cada tarea', () => {
  it('cada tarea declara lo que se pega en la presentación y lo que se sube a Aula', () => {
    for (const id of Object.keys(TAREAS) as IdTarea[]) {
      const t = TAREAS[id]
      expect(t.sugerido).toMatch(/^Tarea-\d$/)
      expect(t.presentacion.length).toBeGreaterThan(0)
      expect(t.archivos.length).toBeGreaterThan(0)
      const ids = [...t.presentacion, ...t.archivos].map((e) => e.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const e of [...t.presentacion, ...t.archivos]) {
        expect(e.titulo.length).toBeGreaterThan(3)
        expect(e.detalle.length).toBeGreaterThan(10)
        // Lo que baja un archivo lo dice; las tablas se copian y no lo dicen.
        expect(Boolean(e.archivo)).toBe(e.tipo !== 'tabla')
        if (e.tipo === 'video') expect(e.detalleGrabando).toBeTruthy()
      }
    }
  })

  it('los nombres de archivo son los mismos que bajaba la app antes de tener este módulo', () => {
    const base = 'Ana_Perez_Tarea-2'
    expect(nombreArchivo('plc', 'ladder', base)).toBe('Ana_Perez_Tarea-2_ladder.png')
    expect(nombreArchivo('plc', 'programa', base)).toBe('Ana_Perez_Tarea-2.json')
    expect(nombreArchivo('cnc', 'trayectoria', base)).toBe('Ana_Perez_Tarea-2_trayectoria.png')
    expect(nombreArchivo('cnc', 'trabajo', base)).toBe('Ana_Perez_Tarea-2.json')
    expect(nombreArchivo('cnc', 'cnc', base)).toBe('Ana_Perez_Tarea-2.cnc')
    expect(nombreArchivo('cnc', 'video', base)).toBe('Ana_Perez_Tarea-2_simulacion')
    expect(nombreArchivo('robotica', 'croquis-pieza', base)).toBe('Ana_Perez_Tarea-2_croquis-pieza.png')
    expect(nombreArchivo('robotica', 'posicionamiento', base)).toBe('Ana_Perez_Tarea-2_posicionamiento.png')
    expect(nombreArchivo('robotica', 'definicion-png', base)).toBe('Ana_Perez_Tarea-2_definicion.png')
    expect(nombreArchivo('robotica', 'definicion', base)).toBe('Ana_Perez_Tarea-2.json')
    expect(nombreArchivo('robotica', 'video', base)).toBe('Ana_Perez_Tarea-2_simulacion')
    expect(nombreArchivo('neumatica', 'vdi', base)).toBe('Ana_Perez_Tarea-2_diagrama-VDI.png')
    expect(nombreArchivo('neumatica', 'fase', base)).toBe('Ana_Perez_Tarea-2_diagrama-fase.png')
    expect(nombreArchivo('neumatica', 'circuito-png', base)).toBe('Ana_Perez_Tarea-2_circuito.png')
    expect(nombreArchivo('neumatica', 'circuito', base)).toBe('Ana_Perez_Tarea-2.json')
  })

  it('un entregable que no existe, o una tabla sin archivo, avisa en vez de callar', () => {
    expect(() => entregable('plc', 'no-existe')).toThrow(/no tiene/)
    expect(() => nombreArchivo('plc', 'es', 'x')).toThrow(/no baja un archivo/)
  })

  it('los videos cambian su explicación mientras se graba', () => {
    expect(entregable('cnc', 'video').detalle).not.toBe(entregable('cnc', 'video', true).detalle)
    expect(entregable('plc', 'ladder', true).detalle).toBe(entregable('plc', 'ladder').detalle)
  })

  it('el Markdown trae todas las tareas, sin llaves sin reemplazar', () => {
    const md = entregablesEnMarkdown()
    for (const id of Object.keys(TAREAS) as IdTarea[]) {
      expect(md).toContain(`## ${TAREAS[id].nombre}`)
      for (const e of [...TAREAS[id].presentacion, ...TAREAS[id].archivos]) expect(md).toContain(e.titulo.replace('{modelo}', 'el robot elegido'))
    }
    expect(md).not.toMatch(/\{base\}|\{modelo\}/)
    expect(entregablesEnMarkdown(['plc'])).not.toContain('Tarea 3')
  })
})
