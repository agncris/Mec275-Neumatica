/**
 * Ficha de repaso: lo esencial de la unidad en una página, para imprimir o
 * guardar como PDF (el botón imprime sólo la ficha).
 */
import { useRef, type ReactNode } from 'react'

export default function FichaRepaso({ titulo, children }: { titulo: string; children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null)
  const imprimir = () => {
    const el = caja.current
    if (!el) return
    // Se imprime una copia de la ficha sola, sin el resto de la página (así no salen hojas en blanco).
    const copia = document.createElement('div')
    copia.id = 'impresion-ficha'
    copia.innerHTML = el.outerHTML
    document.body.appendChild(copia)
    document.body.classList.add('imprimir-ficha')
    const limpiar = () => {
      copia.remove()
      document.body.classList.remove('imprimir-ficha')
      window.removeEventListener('afterprint', limpiar)
    }
    window.addEventListener('afterprint', limpiar)
    window.print()
    setTimeout(limpiar, 1000)
  }
  return (
    <div>
      <p style={{ margin: '0 0 8px', color: '#33475c' }}>
        Lo esencial en una página.{' '}
        <button onClick={imprimir} style={{ border: '1px solid #1668c7', background: '#fff', color: '#1668c7', borderRadius: 8, padding: '0.3rem 0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: 34 }} data-imprimir-ficha="si">
          🖨 Imprimir o guardar como PDF
        </button>
      </p>
      <div ref={caja} className="ficha-repaso">
        <h3 className="ficha-repaso__titulo">{titulo}</h3>
        {children}
        <p className="ficha-repaso__pie">NeumaLab · MEC275</p>
      </div>
    </div>
  )
}

/** Tabla compacta de la ficha. */
export function TablaFicha({ cabeza, filas }: { cabeza: string[]; filas: ReactNode[][] }) {
  return (
    <table className="tabla-ficha">
      <thead>
        <tr>
          {cabeza.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i}>
            {f.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
