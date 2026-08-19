/**
 * Referencia de identificación de orificios (norma ISO 1219-1 vs. CETOP) y
 * cómo se lee la designación "número de vías / número de posiciones".
 */

const FILAS = [
  { iso: 'P', cetop: '1', funcion: 'Conexión de aire comprimido (alimentación)' },
  { iso: 'A, B, C', cetop: '2, 4, 6', funcion: 'Tuberías o vías de trabajo' },
  { iso: 'R, S, T', cetop: '3, 5, 7', funcion: 'Orificios de purga o escape' },
  { iso: 'X, Y, Z', cetop: '12, 14, 16', funcion: 'Tuberías de control, pilotaje o accionamiento' },
  { iso: 'L', cetop: '9', funcion: 'Fuga' },
]

export default function TablaNomenclatura() {
  return (
    <details>
      <summary
        style={{
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          color: '#33475c',
          listStyle: 'revert',
        }}
      >
        Nº de vías y posiciones · nomenclatura de los orificios
      </summary>

      <p style={{ fontSize: '0.88rem', color: '#33475c', lineHeight: 1.55, margin: '10px 0' }}>
        La designación de una válvula se lee <strong>vías / posiciones</strong>. Una{' '}
        <strong>3/2</strong> tiene 3 orificios útiles (vías) y 2 posiciones de trabajo; una{' '}
        <strong>5/2</strong> tiene 5 vías y 2 posiciones. En el símbolo, cada{' '}
        <strong>cuadro es una posición</strong>: las flechas de su interior indican qué orificio
        queda comunicado con cuál mientras esa posición está activa. Los orificios se dibujan
        siempre sobre el cuadro que está activo <em>en reposo</em>.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.86rem', minWidth: 460 }}>
          <thead>
            <tr style={{ background: '#8a97a5', color: '#fff' }}>
              <th style={{ ...celda, textAlign: 'left', width: 110 }}>Norma ISO</th>
              <th style={{ ...celda, textAlign: 'left', width: 120 }}>Norma CETOP</th>
              <th style={{ ...celda, textAlign: 'left' }}>Función</th>
            </tr>
          </thead>
          <tbody>
            {FILAS.map((f, i) => (
              <tr key={f.iso} style={{ background: i % 2 ? '#f3f5f7' : '#fff' }}>
                <td style={{ ...celda, fontWeight: 600 }}>{f.iso}</td>
                <td style={{ ...celda, fontWeight: 600 }}>{f.cetop}</td>
                <td style={celda}>{f.funcion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '0.82rem', color: '#5a6b7d', margin: '10px 0 0', lineHeight: 1.5 }}>
        NeumaLab usa la numeración CETOP (1, 2, 3, 4, 5, 12, 14), que es la que verás grabada en los
        componentes del banco.
      </p>
    </details>
  )
}

const celda: React.CSSProperties = {
  border: '1px solid #d5dbe1',
  padding: '0.45rem 0.6rem',
  textAlign: 'left',
  verticalAlign: 'top',
}
