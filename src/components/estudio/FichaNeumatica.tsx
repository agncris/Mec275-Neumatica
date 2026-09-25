/** Ficha de repaso de neumática: orificios, válvulas, método cascada y VDI 2860. */
import { FUNCIONES_VDI } from '../../symbols/SimbolosVDI'
import FichaRepaso, { TablaFicha } from './FichaRepaso'

export default function FichaNeumatica() {
  return (
    <FichaRepaso titulo="Ficha de repaso · Neumática">
      <h4>Orificios de las válvulas (ISO 5599)</h4>
      <TablaFicha
        cabeza={['Número', 'Función']}
        filas={[
          ['1', 'Alimentación (presión)'],
          ['2, 4', 'Salidas de trabajo'],
          ['3, 5', 'Escapes'],
          ['12', 'Pilotaje que conecta 1 con 2'],
          ['14', 'Pilotaje que conecta 1 con 4'],
          ['10', 'Pilotaje que cierra el paso de 1 (3/2 normalmente abierta)'],
        ]}
      />
      <h4>Válvulas: vías / posiciones</h4>
      <p style={{ margin: '0 0 6px' }}>
        «5/2» = 5 orificios y 2 posiciones. <strong>Monoestable</strong>: vuelve sola (muelle). <strong>Biestable</strong>: se queda donde la dejó el último pilotaje (memoria).
      </p>
      <h4>Método cascada, paso a paso</h4>
      <ol style={{ margin: '0 0 6px', paddingLeft: 18 }}>
        <li>Escribe la secuencia (A+ B+ B− A−…).</li>
        <li>Divídela en grupos: ninguna letra se repite dentro de un grupo.</li>
        <li>Nº de válvulas de cascada = nº de grupos − 1 (5/2 biestables).</li>
        <li>Cada grupo tiene su línea; sólo una está con presión a la vez.</li>
        <li>La señal que da el último movimiento de cada grupo pasa la presión a la línea del grupo siguiente.</li>
      </ol>
      <h4>Diagrama de fase</h4>
      <p style={{ margin: '0 0 6px' }}>Una fila por actuador: 0 = retraído, 1 = extendido; columnas = pasos de la secuencia.</p>
      <h4>Funciones VDI 2860</h4>
      <p style={{ margin: 0, lineHeight: 1.45 }}>{FUNCIONES_VDI.map((f) => `${f.n}. ${f.nombre}`).join(' · ')}</p>
    </FichaRepaso>
  )
}
