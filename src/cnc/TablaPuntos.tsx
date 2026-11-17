import { botonSuave, celdaNum } from './estilos'
import { type ResultadoGcode } from './gcode'
import { textoPunto } from './Plano2D'
import { useMemo, useState } from 'react'

/** Filas de la tabla de coordenadas (con encabezado), para copiar al informe. */
export function filasCoordenadas(resultado: ResultadoGcode, torno: boolean, lineas: string[], casa: { x: number; y: number; z: number }): string[][] {
  let previo = casa
  const r = (v: number) => String(Math.round(v * 1000) / 1000)
  const cab = torno ? ['Bloque', 'G', 'X (Ø)', 'Z', 'U (ΔX)', 'W (ΔZ)'] : ['Bloque', 'G', 'X', 'Y', 'Z', 'ΔX', 'ΔY', 'ΔZ']
  const filas = resultado.puntos.map((p) => {
    const d = { x: p.pos.x - previo.x, y: p.pos.y - previo.y, z: p.pos.z - previo.z }
    previo = p.pos
    const n = /^\s*N(\d+)/i.exec(lineas[p.linea] ?? '')
    const b = n ? `N${n[1]}` : `L${p.linea + 1}`
    return torno ? [b, p.codigo, r(p.prog.x), r(p.prog.z), r(d.x), r(d.z)] : [b, p.codigo, r(p.prog.x), r(p.prog.y), r(p.prog.z), r(d.x), r(d.y), r(d.z)]
  })
  return [cab, ...filas]
}

export default function TablaPuntos({
  resultado,
  torno,
  lineas,
  irA,
  seleccionada,
  casa,
  origen,
}: {
  resultado: ResultadoGcode
  torno: boolean
  lineas: string[]
  irA: (n: number) => void
  seleccionada: number | null
  casa: { x: number; y: number; z: number }
  origen: { x: number; y: number; z: number }
}) {
  const [copiado, setCopiado] = useState(false)
  const casaProg = { x: casa.x - origen.x, y: casa.y - origen.y, z: casa.z - origen.z }
  const filas = useMemo(() => {
    let previo = casa
    return resultado.puntos.map((p) => {
      const d = { x: p.pos.x - previo.x, y: p.pos.y - previo.y, z: p.pos.z - previo.z }
      previo = p.pos
      const n = /^\s*N(\d+)/i.exec(lineas[p.linea] ?? '')
      return { ...p, pos: p.prog, d, n: n ? `N${n[1]}` : `L${p.linea + 1}` }
    })
  }, [resultado, lineas, casa])
  const r = (v: number) => String(Math.round(v * 1000) / 1000)
  const cab = torno ? ['Bloque', 'G', 'X (Ø)', 'Z', 'U (ΔX)', 'W (ΔZ)'] : ['Bloque', 'G', 'X', 'Y', 'Z', 'ΔX', 'ΔY', 'ΔZ']
  const copiar = () => {
    const texto = [cab.join('\t'), ...filas.map((f) => (torno ? [f.n, f.codigo, r(f.pos.x), r(f.pos.z), r(f.d.x), r(f.d.z)] : [f.n, f.codigo, r(f.pos.x), r(f.pos.y), r(f.pos.z), r(f.d.x), r(f.d.y), r(f.d.z)]).join('\t'))].join('\n')
    void navigator.clipboard?.writeText(texto).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }
  if (!filas.length) return <p className="u-nota">El programa todavía no mueve la máquina.</p>
  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: 'var(--tinta-tenue)' }}>
        Dónde queda la herramienta al final de cada bloque, en absolutas y en incrementales (Δ desde el bloque anterior).{' '}
        <button onClick={copiar} style={{ ...botonSuave, padding: '1px 8px', fontSize: '0.78rem' }}>
          {copiado ? '✓ Copiada' : 'Copiar tabla'}
        </button>
      </p>
      <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--borde-suave)', borderRadius: 6 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem', fontFamily: 'ui-monospace, Menlo, monospace' }} data-tabla-puntos="si">
          <thead style={{ position: 'sticky', top: 0 }}>
            <tr>
              {cab.map((c) => (
                <th key={c} style={{ background: 'var(--tinta)', color: '#fff', padding: '3px 6px', textAlign: 'right' }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} onClick={() => irA(f.linea)} style={{ cursor: 'pointer', background: seleccionada === f.linea ? '#fff2a8' : i % 2 ? '#f8fafc' : '#fff' }}>
                <td style={celdaNum}>{f.n}</td>
                <td style={celdaNum}>{f.codigo}</td>
                <td style={celdaNum}>{r(f.pos.x)}</td>
                {!torno && <td style={celdaNum}>{r(f.pos.y)}</td>}
                <td style={celdaNum}>{r(f.pos.z)}</td>
                <td style={{ ...celdaNum, color: 'var(--tinta-tenue)' }}>{r(f.d.x)}</td>
                {!torno && <td style={{ ...celdaNum, color: 'var(--tinta-tenue)' }}>{r(f.d.y)}</td>}
                <td style={{ ...celdaNum, color: 'var(--tinta-tenue)' }}>{r(f.d.z)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--tinta-gris)' }}>Punto de partida: posición de referencia {textoPunto(casaProg, torno)}.</p>
    </div>
  )
}
