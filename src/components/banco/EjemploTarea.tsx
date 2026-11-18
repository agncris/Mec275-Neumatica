/**
 * El ejemplo de una tarea es una visita: el trabajo del alumno queda guardado aparte y
 * estas piezas dicen que lo que se ve es un ejemplo y dejan volver a la tarea.
 * Las usan CNC y PLC; Robótica usa la barra con sus propios textos.
 */
import type { ReactNode } from 'react'

/** Barra sobre las pestañas del panel inferior (va en `inferior.encabezado`). */
export function BarraEjemplo({
  ejemplo,
  aviso,
  etiquetaVer,
  onVer,
  onVolver,
  etiquetaSeguir,
  tituloSeguir,
  onSeguir,
}: {
  ejemplo: boolean
  aviso: string
  etiquetaVer: string
  onVer: () => void
  onVolver: () => void
  etiquetaSeguir?: string
  tituloSeguir?: string
  onSeguir?: () => void
}) {
  return (
    <>
      {ejemplo && <p className="panel-acoplado__encabezado__aviso">{aviso}</p>}
      <div className="tarea-accion">
        {ejemplo ? (
          <>
            <button type="button" className="tarea-accion__principal" onClick={onVolver} data-volver-tarea="si">
              Volver a mi tarea
            </button>
            {onSeguir && (
              <button type="button" className="tarea-accion__secundario" onClick={onSeguir} data-seguir-ejemplo="si" title={tituloSeguir}>
                {etiquetaSeguir}
              </button>
            )}
          </>
        ) : (
          <button type="button" className="tarea-accion__principal" onClick={onVer} data-ver-ejemplo="si">
            {etiquetaVer}
          </button>
        )}
      </div>
    </>
  )
}

/** Franja sobre el área del programa mientras se ve el ejemplo: se ve aunque el panel inferior esté plegado. */
export function AvisoEjemplo({ onVolver, children }: { onVolver: () => void; children: ReactNode }) {
  return (
    <div className="tarea-ejemplo" data-ejemplo-tarea="si">
      <p>{children}</p>
      <span>
        <button type="button" className="tarea-accion__principal" onClick={onVolver} data-volver-tarea="si">
          Volver a mi tarea
        </button>
      </span>
    </div>
  )
}
