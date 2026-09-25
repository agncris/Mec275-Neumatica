/** Ficha de repaso de PLC: instrucciones, ciclo de scan, direcciones y sensores. */
import FichaRepaso, { TablaFicha } from '../components/estudio/FichaRepaso'
import { formatear } from './notacion'
import { INSTRUCCIONES, SENSORES } from './preguntasPLC'

export default function FichaPLC() {
  return (
    <FichaRepaso titulo="Ficha de repaso · PLC y Ladder">
      <h4>Instrucciones</h4>
      <TablaFicha cabeza={['Instrucción', 'Qué hace']} filas={INSTRUCCIONES.map(([n, q]) => [<strong>{n}</strong>, q.charAt(0).toUpperCase() + q.slice(1)])} />
      <h4>Ciclo de scan (se repite sin parar)</h4>
      <ol style={{ margin: '0 0 6px', paddingLeft: 18 }}>
        <li>Lee las entradas y guarda su estado (imagen de entradas).</li>
        <li>Resuelve los escalones de arriba abajo.</li>
        <li>Escribe las salidas con lo que quedó.</li>
      </ol>
      <p style={{ margin: '0 0 6px' }}>Si una salida tiene bobina en dos escalones, manda la de más abajo.</p>
      <h4>Direcciones</h4>
      <TablaFicha
        cabeza={['', 'Apunte', 'LogixPro']}
        filas={[
          ['Entrada', 'I0.3', formatear('I0.3', 'ab')],
          ['Salida', 'Q0.1', formatear('Q0.1', 'ab')],
          ['Marca', 'M0.2', formatear('M0.2', 'ab')],
          ['Temporizador (hecho)', 'T0.DN', formatear('T0.DN', 'ab')],
          ['Contador', 'C1', formatear('C1', 'ab')],
        ]}
      />
      <h4>Sensores</h4>
      <TablaFicha cabeza={['Sensor', 'Cómo detecta']} filas={SENSORES.map(([n, q]) => [<strong>{n}</strong>, q.charAt(0).toUpperCase() + q.slice(1)])} />
    </FichaRepaso>
  )
}
