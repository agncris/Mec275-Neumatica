/** Ficha de repaso de CNC: palabras del bloque, códigos G y M básicos, coordenadas. */
import FichaRepaso, { TablaFicha } from '../components/estudio/FichaRepaso'
import { CODIGOS_G, CODIGOS_M } from './gcode'
import { G_BASICOS, M_BASICOS, PALABRAS } from './preguntasCNC'

const mono: React.CSSProperties = { fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700 }

export default function FichaCNC() {
  return (
    <FichaRepaso titulo="Ficha de repaso · CNC y código G">
      <h4>Palabras de un bloque</h4>
      <p style={{ margin: '0 0 4px', ...mono }}>N40 G01 X30 Z-20 F150 S1500 T0101 M03</p>
      <TablaFicha cabeza={['Letra', 'Indica']} filas={PALABRAS.map(([l, q]) => [<span style={mono}>{l}</span>, q.charAt(0).toUpperCase() + q.slice(1)])} />
      <h4>Códigos G</h4>
      <TablaFicha cabeza={['Código', 'Función']} filas={G_BASICOS.map((c) => [<span style={mono}>{c}</span>, CODIGOS_G[c]])} />
      <h4>Códigos M</h4>
      <TablaFicha cabeza={['Código', 'Función']} filas={M_BASICOS.map((c) => [<span style={mono}>{c}</span>, CODIGOS_M[c]])} />
      <h4>Coordenadas</h4>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>
          <strong>G90 absolutas</strong>: el punto de llegada, medido desde el cero pieza.
        </li>
        <li>
          <strong>G91 incrementales</strong>: cuánto se mueve desde donde está (en el torno también U y W).
        </li>
        <li>
          En el torno, <strong>X se programa en diámetro</strong> y Z a lo largo del eje (negativo hacia el plato).
        </li>
        <li>No retirar más material por pasada del que permita la herramienta y el material.</li>
      </ul>
    </FichaRepaso>
  )
}
