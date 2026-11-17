import { BotonNuevo, botonPrimario, botonSecundario, Menu, type ItemMenu } from '../components/ui'
import { ETIQUETA_GRUPO, PRACTICA_ROBOT, type GrupoPractica } from './practica'
import { EJEMPLOS_ROBOT } from './ejemplos'
import type { RefObject } from 'react'
import type { Modo } from './datosRobot'

/** La barra de arriba de Robótica: forma de programar, ejemplos, Archivo y Exportar. */
export default function BarraRobot({
  modo,
  setModo,
  setReproduciendo,
  estrecha,
  enTarea,
  ejemploEnTarea,
  ejemploAbierto,
  puedeDeshacer,
  puedeRehacer,
  deshacer,
  rehacer,
  cargarEjemplo,
  volverDelEjemplo,
  inputDXF,
  inputDef,
  abrirDXF,
  abrirDef,
  guia,
  grabando,
  alternarGrabacion,
  itemsArchivo,
  itemsExportar,
}: {
  modo: Modo
  setModo: (m: Modo) => void
  setReproduciendo: (v: boolean) => void
  estrecha: boolean
  enTarea: boolean
  ejemploEnTarea: boolean
  ejemploAbierto: { id: string; titulo: string } | null
  puedeDeshacer: boolean
  puedeRehacer: boolean
  deshacer: () => void
  rehacer: () => void
  cargarEjemplo: (id: string) => void
  volverDelEjemplo: () => void
  inputDXF: RefObject<HTMLInputElement>
  inputDef: RefObject<HTMLInputElement>
  abrirDXF: (f: File | undefined) => Promise<void>
  abrirDef: (f: File | undefined) => Promise<void>
  guia: { abrir: () => void }
  grabando: boolean
  alternarGrabacion: () => void
  itemsArchivo: ItemMenu[]
  itemsExportar: ItemMenu[]
}) {
  return (
    <>
      <span className="segmentado" role="radiogroup" aria-label="Forma de programar">
        {(
          [
            ['visual', estrecha ? 'Nodos' : 'Programación visual'],
            ['mando', estrecha ? 'Mando' : 'Mando manual'],
          ] as Array<[Modo, string]>
        ).map(([m, t]) => (
          <button
            key={m}
            role="radio"
            aria-checked={modo === m}
            onClick={() => {
              setReproduciendo(false)
              setModo(m)
            }}
            data-modo={m}
            title={m === 'mando' ? 'Mover el robot a mano y grabar puntos (teach-in)' : 'Armar el programa con nodos, como Grasshopper + KUKA|prc'}
            style={{ minHeight: 34 }}
          >
            {t}
          </button>
        ))}
      </span>
      {modo === 'visual' && (
        <>
          <BotonNuevo que="la tarea de cero" compacto={estrecha} onClick={() => cargarEjemplo('vacio')} />
          {ejemploEnTarea && (
            <button type="button" onClick={volverDelEjemplo} style={botonPrimario()} data-volver-tarea="si">
              Volver a mi tarea
            </button>
          )}
          <span style={{ display: 'inline-flex', gap: 2 }}>
            <button onClick={deshacer} disabled={!puedeDeshacer} aria-label="Deshacer" className="boton-icono" style={{ opacity: puedeDeshacer ? 1 : 0.4 }} title="Deshacer (Ctrl+Z)">
              ↶
            </button>
            <button onClick={rehacer} disabled={!puedeRehacer} aria-label="Rehacer" className="boton-icono" style={{ opacity: puedeRehacer ? 1 : 0.4 }} title="Rehacer (Ctrl+Shift+Z)">
              ↷
            </button>
          </span>
          {!enTarea && (
          <select
            value={ejemploAbierto?.id ?? ''}
            onChange={(e) => {
              if (e.target.value) cargarEjemplo(e.target.value)
            }}
            style={{ padding: '0.35rem 0.4rem', minHeight: 36, width: estrecha ? '42vw' : 340, maxWidth: '46vw' }}
            data-ejemplos-robot="si"
            aria-label="Ejemplos"
            title={ejemploAbierto ? ejemploAbierto.titulo : 'Ejemplos'}
          >
            <option value="">Ejemplos…</option>
            {EJEMPLOS_ROBOT.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titulo}
              </option>
            ))}
            {(['clase', 'fallas', 'control', 'retos'] as GrupoPractica[]).map((g) => (
              <optgroup key={g} label={ETIQUETA_GRUPO[g]}>
                {PRACTICA_ROBOT.filter((e) => e.grupo === g).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.titulo}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          )}
          {!estrecha && (
            <button
              onClick={() => inputDXF.current?.click()}
              disabled={enTarea}
              style={{ ...botonSecundario, opacity: enTarea ? 0.45 : 1 }}
              title={enTarea ? 'En la tarea el plano ya está cargado' : 'Traer un plano DXF para usar sus curvas'}
              data-abrir-dxf="si"
            >
              Abrir DXF
            </button>
          )}
        </>
      )}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        {!estrecha && (
          <button onClick={guia.abrir} className="boton-icono" title="Guía de inicio" aria-label="Guía de inicio" data-abrir-guia="si">
            ?
          </button>
        )}
        {grabando && (
          <button onClick={alternarGrabacion} style={{ ...botonSecundario, color: '#fff', background: '#c62828', borderColor: '#c62828' }}>
            ■ {estrecha ? 'Detener' : 'Detener grabación'}
          </button>
        )}
        {estrecha ? (
          <Menu etiqueta="⋯" datos="mas" ancho={300} items={[...(modo === 'visual' ? itemsArchivo : []), ...itemsExportar.map((it, i) => (i === 0 && modo === 'visual' ? { ...it, separar: true } : it)), { texto: 'Guía de inicio', ayuda: 'Los cuatro pasos para partir', onClick: guia.abrir, separar: true }]} />
        ) : (
          <>
            {modo === 'visual' && <Menu etiqueta="Archivo" items={itemsArchivo} />}
            <Menu etiqueta="Exportar" ancho={300} items={itemsExportar} />
          </>
        )}
      </span>
      <input ref={inputDXF} type="file" accept=".dxf" style={{ display: 'none' }} onChange={(e) => (void abrirDXF(e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={inputDef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => (void abrirDef(e.target.files?.[0]), (e.target.value = ''))} />
    </>
  )
}
