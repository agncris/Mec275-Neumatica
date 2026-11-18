/**
 * El proceso de una tarea: las etapas en fila y un solo paso abierto
 * (dónde está, qué hacer y cómo saber que quedó). No da la solución.
 */
import type { ReactNode } from 'react'

export interface PasoProceso {
  id: string
  numero: number
  total: number
  titulo: string
  donde: string
  accion: string
  listo: string
  /** Lo que falta en este paso, si el trabajo está a medias. Dice qué falta, no cómo se resuelve. */
  pista?: string
}

export default function ProcesoTarea({ etapas, paso, children, progreso = false }: { etapas: string[]; paso: PasoProceso; children?: ReactNode; progreso?: boolean }) {
  const hechos = paso.numero - 1
  return (
    <section className="proceso" aria-label="Proceso de la tarea" data-paso-ahora={paso.id}>
      <p style={{ margin: 0, fontWeight: 700 }}>
        Paso {paso.numero} de {paso.total} · {paso.titulo}
      </p>
      {progreso && (
        <div role="progressbar" aria-label="Avance de la tarea" aria-valuemin={0} aria-valuemax={paso.total} aria-valuenow={hechos} data-progreso-tarea="si" style={{ height: 6, borderRadius: 3, background: '#e3e8ee', margin: '6px 0 0', overflow: 'hidden' }}>
          <div style={{ width: `${(hechos / paso.total) * 100}%`, height: '100%', background: 'var(--verde)' }} />
        </div>
      )}
      <ol className="proceso__etapas">
        {etapas.map((nombre, i) => {
          const n = i + 1
          const estado = n < paso.numero ? 'hecha' : n === paso.numero ? 'ahora' : ''
          return (
            <li key={nombre} className={estado ? `proceso__etapa proceso__etapa--${estado}` : 'proceso__etapa'} aria-current={estado === 'ahora' ? 'step' : undefined}>
              {estado === 'hecha' ? '✓ ' : `${n} `}
              {nombre}
            </li>
          )
        })}
      </ol>
      <dl className="proceso__fila">
        <dt>Dónde</dt>
        <dd>{paso.donde}</dd>
        <dt>Haz esto</dt>
        <dd>{paso.accion}</dd>
        <dt>Listo</dt>
        <dd>{paso.listo}</dd>
      </dl>
      {paso.pista && (
        <p data-pista-tarea="si" style={{ margin: '0 0 8px', padding: '6px 8px', borderRadius: 6, background: '#fff4e0', border: '1px solid #f0c987', color: '#6b4200' }}>
          <strong>Te falta esto:</strong> {paso.pista}
        </p>
      )}
      {children}
    </section>
  )
}

export const enlaceEstudiar: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#1668c7',
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
  fontSize: 'inherit',
  textDecoration: 'underline',
}
