import type { ReactNode, RefObject } from 'react'
import type { ItemMenu } from '../components/ui'
import { BotonNuevo, botonPrimario, botonSecundario, Menu } from '../components/ui'
import { type TipoMaquina } from './maquinas'
import { rotulo, selector } from './estilos'
import { MAQUINAS } from './SelectorMaquina'
import { NOMBRE_TAREA } from './datosCNC'

const VELOCIDADES = [0.5, 1, 2, 5, 10, 25, 60]

/** El selector de velocidad de la simulación (en la barra, o junto a la máquina en pantallas estrechas). */
export function SelectorVelocidad({ velocidad, setVelocidad, estrecha }: { velocidad: number; setVelocidad: (v: number) => void; estrecha: boolean }) {
  return (
  <label style={{ ...rotulo }} title="Velocidad de la simulación">
    Velocidad
    <select value={velocidad} onChange={(e) => setVelocidad(Number(e.target.value))} style={{ ...selector, minHeight: estrecha ? 32 : 36 }} aria-label="Velocidad" data-velocidad-cnc="si">
      {VELOCIDADES.map((v) => (
        <option key={v} value={v}>
          ×{v}
        </option>
      ))}
    </select>
  </label>
  )
}

/** La barra de arriba de CNC: ciclo, avance por bloques, máquina, Archivo y Exportar. */
export default function BarraCNC({
  estado,
  setEstado,
  correr,
  atras,
  alFinal,
  reiniciar,
  hayPasos,
  hayErrores,
  estrecha,
  enTarea,
  bloqueado,
  nuevo,
  selectorVelocidad,
  maquina,
  setEligiendoMaquina,
  guia,
  grabando,
  alternarGrabacion,
  itemsArchivo,
  itemsExportar,
  inputArchivo,
  abrir,
}: {
  estado: string
  setEstado: (e: 'pausa') => void
  correr: (modo: 'corriendo' | 'bloque') => void
  atras: () => void
  alFinal: () => void
  reiniciar: () => void
  hayPasos: boolean
  hayErrores: boolean
  estrecha: boolean
  enTarea: boolean
  bloqueado: boolean
  nuevo: () => void
  selectorVelocidad: ReactNode
  maquina: TipoMaquina
  setEligiendoMaquina: (v: boolean) => void
  guia: { abrir: () => void }
  grabando: boolean
  alternarGrabacion: () => void
  itemsArchivo: ItemMenu[]
  itemsExportar: ItemMenu[]
  inputArchivo: RefObject<HTMLInputElement>
  abrir: (archivo: File | undefined) => Promise<void>
}) {
  const botonMaquina = enTarea ? (
    <span className="boton-planta" title="El enunciado de la tarea está en Aula" data-maquina-tarea="si" style={{ maxWidth: 360, cursor: 'default', padding: estrecha ? '0 0.5rem' : undefined }}>
      {!estrecha && <span style={{ color: '#9a4a00', fontWeight: 700 }}>{NOMBRE_TAREA}:</span>}
      <span className="u-semi">{estrecha ? MAQUINAS.torno.corto : MAQUINAS.torno.nombre}</span>
    </span>
  ) : (
    <button
      onClick={() => setEligiendoMaquina(true)}
      className="boton-planta"
      title="Elegir la máquina o abrir un ejemplo"
      aria-label={`Máquina: ${MAQUINAS[maquina].nombre}. Elegir máquina o ejemplo`}
      data-boton-maquina="si"
      style={{ maxWidth: 360, padding: estrecha ? '0 0.5rem' : undefined }}
    >
      {!estrecha && <span className="u-suave">Máquina:</span>}
      <span className="u-semi">{estrecha ? MAQUINAS[maquina].corto : MAQUINAS[maquina].nombre}</span>
      <span aria-hidden style={{ fontSize: '0.7rem', flex: 'none' }}>
        ▾
      </span>
    </button>
  )
  return (
    <>
      {estado === 'corriendo' ? (
        <button onClick={() => setEstado('pausa')} style={{ ...botonPrimario(false, '#ffa726'), color: 'var(--texto)' }} data-control="pausa">
          ❚❚ Pausa
        </button>
      ) : (
        <button
          onClick={() => correr('corriendo')}
          disabled={!hayPasos}
          title={hayErrores ? 'Hay errores: la máquina corre hasta la línea anterior al primer error' : 'Ejecuta el programa completo'}
          style={{ ...botonPrimario(), opacity: hayPasos ? 1 : 0.5 }}
          data-control="ciclo"
        >
          {estado === 'parada' ? '▶ Continuar' : '▶ Ciclo'}
        </button>
      )}
      <span className="grupo-zoom" role="group" aria-label="Avance del programa">
        <button onClick={atras} disabled={estado === 'corriendo' || estado === 'listo'} style={{ opacity: estado === 'corriendo' || estado === 'listo' ? 0.4 : 1 }} title="Bloque anterior: vuelve una línea" aria-label="Bloque anterior" data-control="atras">
          {'⏮\uFE0E'}
        </button>
        <button onClick={() => correr('bloque')} disabled={!hayPasos || estado === 'corriendo'} style={{ opacity: !hayPasos || estado === 'corriendo' ? 0.4 : 1 }} title="Bloque a bloque: ejecuta una línea y se detiene" aria-label="Bloque a bloque" data-control="bloque">
          {'⏭\uFE0E'}
        </button>
        <button onClick={alFinal} disabled={!hayPasos} title="Al final: mecaniza todo de una vez" aria-label="Al final" data-control="final">
          {'⏩\uFE0E'}
        </button>
        <button onClick={reiniciar} title="Reiniciar: vuelve al inicio con el bruto entero" aria-label="Reiniciar" data-control="reiniciar">
          {'⟲\uFE0E'}
        </button>
      </span>
      {/* Igual que en las otras unidades: acción principal, «Nuevo» y después los selectores. */}
      <BotonNuevo que="un programa" compacto={estrecha} deshabilitado={bloqueado} onClick={() => void nuevo()} />
      {!estrecha && selectorVelocidad}
      {botonMaquina}
      <span className="u-barra-derecha">
        {!estrecha && (
          <button onClick={guia.abrir} className="boton-icono" title="Guía de inicio" aria-label="Guía de inicio" data-abrir-guia="si">
            ?
          </button>
        )}
        {grabando && (
          <button onClick={alternarGrabacion} style={{ ...botonSecundario, color: '#fff', background: 'var(--rojo)', borderColor: 'var(--rojo)' }}>
            ■ {estrecha ? 'Detener' : 'Detener grabación'}
          </button>
        )}
        {estrecha ? (
          <Menu etiqueta="⋯" datos="mas" items={[...itemsArchivo, ...itemsExportar.map((it, i) => (i === 0 ? { ...it, separar: true } : it)), { texto: 'Guía de inicio', ayuda: 'Los cuatro pasos para partir', onClick: guia.abrir, separar: true }]} />
        ) : (
          <>
            <Menu etiqueta="Archivo" items={itemsArchivo} />
            <Menu etiqueta="Exportar" items={itemsExportar} />
          </>
        )}
      </span>
      <input
        ref={inputArchivo}
        type="file"
        accept=".json,.cnc,.nc,.gcode,.ngc,.tap,.txt,application/json,text/plain"
        className="u-oculto"
        onChange={(e) => {
          void abrir(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </>
  )
}
