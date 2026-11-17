/** Ficha de repaso de PLC: instrucciones, ciclo de scan, direcciones y sensores. */
import FichaRepaso, { TablaFicha } from '../components/estudio/FichaRepaso'
import { INSTRUCCIONES, SENSORES } from './preguntasPLC'

export default function FichaPLC() {
  return (
    <FichaRepaso titulo="Ficha de repaso · PLC y Ladder">
      <h4>Instrucciones</h4>
      <TablaFicha cabeza={['Instrucción', 'Qué hace']} filas={INSTRUCCIONES.map(([n, q]) => [<strong>{n}</strong>, q.charAt(0).toUpperCase() + q.slice(1)])} />
      <h4>Ciclo de scan (se repite sin parar)</h4>
      <ol className="u-lista">
        <li>Lee las entradas y guarda su estado (imagen de entradas).</li>
        <li>Resuelve los escalones de arriba abajo.</li>
        <li>Escribe las salidas con lo que quedó.</li>
      </ol>
      <p className="u-m-0-0-6">Si una salida tiene bobina en dos escalones, manda la de más abajo.</p>
      <h4>Direcciones</h4>
      <TablaFicha
        cabeza={['Qué es', 'Se escribe', 'Ejemplo']}
        filas={[
          ['Entrada (sensor, pulsador)', 'I byte.bit', 'I0.3'],
          ['Salida (actuador, piloto)', 'Q byte.bit', 'Q0.1'],
          ['Marca (memoria interna)', 'M byte.bit', 'M0.2'],
        ]}
      />
      <h4>Sensores</h4>
      <TablaFicha cabeza={['Sensor', 'Cómo detecta']} filas={SENSORES.map(([n, q]) => [<strong>{n}</strong>, q.charAt(0).toUpperCase() + q.slice(1)])} />
    </FichaRepaso>
  )
}
