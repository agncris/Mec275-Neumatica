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
}

export default function ProcesoTarea({ etapas, paso, children }: { etapas: string[]; paso: PasoProceso; children?: ReactNode }) {
  return (
    <section className="proceso" aria-label="Proceso de la tarea" data-paso-ahora={paso.id}>
      <p style={{ margin: 0, fontWeight: 700 }}>
        Paso {paso.numero} de {paso.total} · {paso.titulo}
      </p>
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
