import { useEffect, useRef, useState } from 'react'
import { comandoEn, explicarLineaKRL, presentarLineaKRL, type Simulacion } from './movimiento'

/** El KRL generado: cada línea trae su glosa, y al elegirla se explica cada palabra como en el código G. */
export default function CodigoKRL({ sim, t, seguir }: { sim: Simulacion; t: number; seguir: boolean }) {
  const filas = sim.krl.replace(/\r/g, '').replace(/\n$/, '').split('\n')
  const vistas = filas.map(presentarLineaKRL)
  const cmd = comandoEn(sim, t)
  const activa = sim.krlLineas[cmd] ?? -1
  const [elegida, setElegida] = useState<number | null>(null)
  const explicada = seguir && activa >= 0 ? activa : (elegida ?? (activa >= 0 ? activa : 0))
  const marca = useRef<HTMLDivElement>(null)
  const explicacion = explicarLineaKRL(filas[explicada] ?? '')
  useEffect(() => {
    const el = marca.current
    const caja = el?.closest('.panel-acoplado__contenido') as HTMLElement | null
    if (!el || !caja) return
    const er = el.getBoundingClientRect()
    const cr = caja.getBoundingClientRect()
    if (er.top < cr.top) caja.scrollTop -= cr.top - er.top
    else if (er.bottom > cr.bottom) caja.scrollTop += er.bottom - cr.bottom
  }, [explicada])
  return (
    <>
      <p className="u-ayuda-suave">
        El programa que se genera para el controlador KUKA ({filas.length} líneas). Cada línea dice qué hace. Elige una para ver sus palabras.
        {seguir && activa >= 0 ? ` Ahora va por la línea ${activa + 1}.` : ''} Descárgalo desde Exportar.
      </p>
      <pre style={{ margin: 0, overflow: 'auto', background: '#1f2328', color: '#e8eaed', padding: '6px 0', borderRadius: 8, fontSize: '0.78rem', lineHeight: '1.45' }} data-krl="si" data-krl-linea={activa >= 0 ? activa : undefined}>
        {vistas.map((vista, i) => {
          const corre = i === activa
          const mira = i === explicada
          return (
            <div
              key={i}
              ref={mira ? marca : undefined}
              data-krl-fila={i}
              role="button"
              tabIndex={0}
              onClick={() => setElegida(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setElegida(i)
                }
              }}
              title="Explicar esta línea"
              style={{ padding: '1px 10px 3px', cursor: 'pointer', background: corre ? '#1d4e89' : mira ? '#3a3424' : undefined, color: corre ? '#fff' : mira ? '#ffe7b3' : undefined }}
            >
              <span style={{ display: 'inline-block', width: '2.2em', color: corre ? '#c5d8ef' : mira ? '#e2c98a' : '#6b7785', userSelect: 'none' }}>{i + 1}</span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{vista.codigo || ' '}</span>
              {vista.glosa ? (
                <span data-glosa-krl="" style={{ display: 'block', marginLeft: '2.2em', color: corre ? '#d7ecc8' : '#9dcea0' }}>
                  {vista.glosa}
                </span>
              ) : null}
            </div>
          )
        })}
      </pre>
      <p style={{ margin: '8px 0 6px', fontSize: '0.82rem', color: 'var(--tinta-suave)' }}>Línea {explicada + 1}. Cada palabra, como en el código G.</p>
      <code style={{ display: 'block', background: '#f4f6f9', padding: '6px 8px', borderRadius: 6, marginBottom: 6, whiteSpace: 'pre-wrap' }}>{vistas[explicada]?.codigo || ' '}</code>
      {explicacion.length ? (
        <table className="u-tabla" data-explicacion-krl="si">
          <tbody>
            {explicacion.map((e, i) => (
              <tr key={i}>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--fondo-gris)', fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{e.palabra}</td>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--fondo-gris)' }}>{e.texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="u-nota">Línea vacía.</p>
      )}
    </>
  )
}
