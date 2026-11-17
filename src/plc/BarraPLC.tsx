import type { RefObject } from 'react'
import type { Notacion } from './notacion'
import type { PLANTAS } from './plantas'
import { BotonNuevo, botonPrimario, Menu } from '../components/ui'
import { NOMBRE_TAREA } from './datosPLC'

/** La barra de arriba de PLC: RUN/STOP, paso a paso, deshacer, planta, Archivo y Exportar. */
export default function BarraPLC({
  corriendo,
  setCorriendo,
  pausado,
  setPausado,
  unBarrido,
  estrecha,
  acostado,
  enTarea,
  descripcion,
  setEligiendoPlanta,
  notacion,
  setNotacion,
  nuevo,
  deshacer,
  rehacer,
  puedeDeshacer,
  puedeRehacer,
  inputArchivo,
  abrir,
  guardar,
  setMisTrabajos,
  exportarLadder,
  guia,
}: {
  corriendo: boolean
  setCorriendo: (f: (c: boolean) => boolean) => void
  pausado: boolean
  setPausado: (f: (p: boolean) => boolean) => void
  unBarrido: () => void
  estrecha: boolean
  acostado: boolean
  enTarea: boolean
  descripcion: (typeof PLANTAS)[keyof typeof PLANTAS]
  setEligiendoPlanta: (v: boolean) => void
  notacion: Notacion
  setNotacion: (n: Notacion) => void
  nuevo: () => void
  deshacer: () => void
  rehacer: () => void
  puedeDeshacer: boolean
  puedeRehacer: boolean
  inputArchivo: RefObject<HTMLInputElement>
  abrir: (archivo: File | undefined) => Promise<void>
  guardar: () => void
  setMisTrabajos: (v: boolean) => void
  exportarLadder: () => Promise<void>
  guia: { abrir: () => void }
}) {
  const botonPlanta = enTarea ? (
    <span className="boton-planta" title="El enunciado de la tarea está en Aula" data-planta-tarea="si" style={{ width: acostado ? 'clamp(64px, 17vw - 44px, 170px)' : estrecha ? '28vw' : 'auto', maxWidth: 360, cursor: 'default' }}>
      {!estrecha && <span style={{ color: '#9a4a00', fontWeight: 700 }}>{NOMBRE_TAREA}:</span>}
      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{descripcion.nombre.replace(` (${NOMBRE_TAREA})`, '')}</span>
    </span>
  ) : (
    <button onClick={() => setEligiendoPlanta(true)} className="boton-planta" title="Elegir la planta, o empezar un ejercicio o un ejemplo" aria-label={`Planta: ${descripcion.nombre}. Elegir planta, ejercicio o ejemplo`} data-boton-planta="si" style={{ width: acostado ? 'clamp(64px, 17vw - 44px, 170px)' : estrecha ? '28vw' : 'auto', maxWidth: 360 }}>
      {!estrecha && <span style={{ color: '#51606f' }}>Planta:</span>}
      <span style={{ fontWeight: 600 }}>{descripcion.nombre}</span>
      <span aria-hidden style={{ fontSize: '0.7rem', flex: 'none' }}>
        ▾
      </span>
    </button>
  )
  /** La notación de LogixPro sólo sirve a quien use ese simulador: queda en el menú, no en la barra. */
  const itemNotacion = {
    texto: notacion === 'ab' ? 'Direcciones como en el apunte' : 'Direcciones como en LogixPro',
    ayuda: notacion === 'ab' ? 'Volver a I0.3, Q0.1' : 'I:1/03, O:2/01 (sólo si usas LogixPro)',
    onClick: () => setNotacion(notacion === 'ab' ? 'siemens' : 'ab'),
  }
  const itemsArchivo = [
    { texto: 'Nuevo programa', ayuda: 'Empieza con el diagrama vacío', onClick: nuevo },
    { texto: 'Abrir…', ayuda: 'Un programa guardado (.json)', onClick: () => inputArchivo.current?.click() },
    { texto: 'Guardar', ayuda: 'Descarga el programa para volver a abrirlo', onClick: guardar },
    { texto: 'Mis trabajos…', ayuda: 'Guarda varios programas con nombre y cámbiate entre ellos', onClick: () => setMisTrabajos(true), separar: true },
  ]
  const itemExportar = { texto: 'Diagrama Ladder (PNG)', ayuda: 'Imagen del programa para tu informe', onClick: () => void exportarLadder() }
  const itemJson = { texto: 'Programa (JSON)', ayuda: 'El archivo del programa: se vuelve a abrir en la app con «Abrir…»', onClick: guardar }

  return (
    <>
      {/* RUN / STOP: la acción principal. */}
      <button onClick={() => setCorriendo((c) => !c)} title="Atajo: barra espaciadora" aria-pressed={corriendo} style={botonPrimario(corriendo)} data-run="si">
        {corriendo ? '■ STOP' : '▶ RUN'}
      </button>
      {corriendo && (
        <span className="grupo-zoom" role="group" aria-label="Paso a paso">
          <button onClick={() => setPausado((p) => !p)} aria-pressed={pausado} title={pausado ? 'Seguir corriendo' : 'Pausar el PLC y la planta para ver barrido a barrido'} data-pausar-plc="si" style={{ padding: '0 8px', minWidth: 'auto', fontWeight: 600 }}>
            {pausado ? '▶ Seguir' : '❚❚ Pausar'}
          </button>
          <button onClick={unBarrido} disabled={!pausado} style={{ opacity: pausado ? 1 : 0.4, padding: '0 8px', minWidth: 'auto', fontWeight: 600 }} title="Ejecuta un solo barrido (lee entradas, resuelve los escalones, escribe salidas)" data-un-barrido="si">
            ⏭ Un barrido
          </button>
        </span>
      )}
      <BotonNuevo que="un programa" compacto={estrecha} onClick={nuevo} />
      <span style={{ display: 'inline-flex', gap: 2 }}>
        <button onClick={deshacer} disabled={corriendo || !puedeDeshacer} title="Deshacer (Ctrl+Z)" aria-label="Deshacer" className="boton-icono" style={{ opacity: corriendo || !puedeDeshacer ? 0.4 : 1 }}>
          ↶
        </button>
        {!estrecha && (
          <button onClick={rehacer} disabled={corriendo || !puedeRehacer} title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer" className="boton-icono" style={{ opacity: corriendo || !puedeRehacer ? 0.4 : 1 }}>
            ↷
          </button>
        )}
      </span>
      {botonPlanta}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        {!estrecha && (
          <button onClick={guia.abrir} className="boton-icono" title="Guía de inicio" aria-label="Guía de inicio" data-abrir-guia="si">
            ?
          </button>
        )}
        {estrecha ? (
          <Menu
            etiqueta="⋯"
            datos="mas"
            items={[
              { texto: 'Rehacer', onClick: rehacer, deshabilitado: corriendo || !puedeRehacer, porque: corriendo ? 'Pasa el PLC a STOP para editar' : 'No hay nada que rehacer' },
              ...itemsArchivo.map((it, i) => ({ ...it, separar: i === 0 })),
              { ...itemExportar, texto: 'Exportar Ladder (PNG)', separar: true },
              { ...itemJson, texto: 'Exportar programa (JSON)' },
              { ...itemNotacion, separar: true },
              { texto: 'Guía de inicio', ayuda: 'Los cuatro pasos para partir', onClick: guia.abrir },
            ]}
          />
        ) : (
          <>
            <Menu etiqueta="Archivo" items={[...itemsArchivo, { ...itemNotacion, separar: true }]} />
            <Menu etiqueta="Exportar" items={[itemExportar, itemJson]} />
          </>
        )}
      </span>
      <input
        ref={inputArchivo}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          void abrir(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </>
  )
}
