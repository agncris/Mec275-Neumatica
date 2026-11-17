import type { robotPorId } from './robots'

/** La ficha técnica del modelo de robot: carga, alcance, ejes y uso típico. */
export default function FichaModelo({ modeloVista }: { modeloVista: ReturnType<typeof robotPorId> }) {
  return (
    <>
      <table style={{ fontSize: '0.85rem', borderCollapse: 'collapse' }}>
        <tbody>
          {(
            [
              ['Carga', `${modeloVista.carga} kg`],
              ['Alcance máximo', `${modeloVista.alcance} mm`],
              ['Repetibilidad', `± ${modeloVista.repetibilidad} mm`],
              ['Número de ejes', '6'],
              ['Peso', `${modeloVista.peso} kg`],
              ['Montaje', modeloVista.montaje],
              ['Rango de los ejes', modeloVista.limites.map((l, k) => `A${k + 1} ${l[0]}°/${l[1]}°`).join(' · ')],
              ['Uso típico', modeloVista.descripcion],
            ] as Array<[string, string]>
          ).map(([x, y]) => (
            <tr key={x}>
              <td style={{ padding: '3px 8px', fontWeight: 600, verticalAlign: 'top' }}>{x}</td>
              <td style={{ padding: '3px 8px' }}>{y}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '0.78rem', color: '#5f6b78' }}>Datos de las fichas técnicas publicadas de cada modelo. Para un trabajo formal, cita la ficha oficial de KUKA.</p>
    </>
  )
}
