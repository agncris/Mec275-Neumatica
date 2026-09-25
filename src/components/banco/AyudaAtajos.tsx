/** Hoja de atajos y gestos del banco (botón «?»). */
import { useEffect, useRef } from 'react'

export default function AyudaAtajos({ onCerrar, tactil }: { onCerrar: () => void; tactil: boolean }) {
  const caja = useRef<HTMLDivElement>(null)
  const cerrar = useRef(onCerrar)
  cerrar.current = onCerrar
  useEffect(() => {
    caja.current?.focus()
    // En captura y con una referencia estable: otros atajos (Esc cancela la
    // manguera) re-dibujan la app y no deben dejar sin efecto este.
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current()
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [])
  const filas: Array<[string, string]> = tactil
    ? [
        ['Dos dedos', 'Acercar o alejar el tablero'],
        ['Arrastrar el fondo', 'Mover el tablero'],
        ['Tocar una ficha de la paleta', 'Agregarla en un lugar libre (o arrástrala)'],
        ['Tocar un puerto y luego otro', 'Unirlos con una manguera'],
        ['Tocar una ficha', 'Ver y cambiar sus propiedades'],
        ['Mantener el dedo en un pulsador', 'Accionar la válvula mientras simulas'],
        ['Tocar una biestable', 'Conmutarla a mano'],
        ['Tocar la fuente', 'Cortar o dar el aire'],
      ]
    : [
        ['Rueda del mouse', 'Acercar o alejar el tablero'],
        ['Arrastrar el fondo', 'Mover el tablero'],
        ['Clic cerca de un puerto', 'Empezar o terminar una manguera (los puertos son magnéticos)'],
        ['Supr', 'Borrar la ficha o manguera seleccionada'],
        ['Esc', 'Cancelar la manguera en curso'],
        ['Espacio', 'Simular / detener'],
        ['Ctrl+Z · Ctrl+Shift+Z', 'Deshacer · rehacer'],
        ['Mantener pulsado un pulsador', 'Accionar la válvula mientras simulas'],
        ['Clic en una biestable', 'Conmutarla a mano'],
        ['Clic en la fuente', 'Cortar o dar el aire'],
      ]
  return (
    <div role="presentation" onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(28,39,51,0.35)', zIndex: 80, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-atajos"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', width: 'min(520px, 100%)', maxHeight: '85dvh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(28,39,51,0.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <h2 id="titulo-atajos" style={{ margin: 0, fontSize: '1.05rem' }}>
            {tactil ? 'Gestos del banco' : 'Atajos del banco'}
          </h2>
          <button onClick={onCerrar} className="boton-icono" style={{ marginLeft: 'auto' }} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.9rem' }}>
          <tbody>
            {filas.map(([k, v]) => (
              <tr key={k} style={{ borderTop: '1px solid #eef1f4' }}>
                <td style={{ padding: '7px 10px 7px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                  <kbd style={{ background: '#f1f4f7', border: '1px solid #c6ced6', borderRadius: 5, padding: '1px 6px', fontFamily: 'inherit', fontSize: '0.84rem' }}>{k}</kbd>
                </td>
                <td style={{ padding: '7px 0', color: '#33475c' }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
