/** Ficha de repaso de robótica: tipos y grados de libertad, ejes, movimientos y ficha técnica. */
import FichaRepaso, { TablaFicha } from '../components/estudio/FichaRepaso'

export default function FichaRobot() {
  return (
    <FichaRepaso titulo="Ficha de repaso · Robótica industrial">
      <h4>Tipos de robot de base fija</h4>
      <TablaFicha
        cabeza={['Tipo', 'Grados de libertad', 'Uso típico']}
        filas={[
          ['Antropomórfico (articulado)', '6 (todas rotacionales)', 'Soldadura, pintura, mecanizado, manipulación'],
          ['SCARA', '4 (X, Y, Z y giro de la herramienta)', 'Montaje y pick and place en un plano'],
          ['Cartesiano (pórtico)', '3 lineales (X, Y, Z)', 'Paletizado, impresión 3D, cargas grandes'],
          ['Paralelo (delta)', '3 o 4', 'Pick and place muy rápido'],
          ['Cilíndrico / esférico', '3 (combinan giro y desplazamiento)', 'Carga de máquinas'],
        ]}
      />
      <h4>Ejes de un KUKA de 6 ejes</h4>
      <ul style={{ margin: '0 0 6px', paddingLeft: 18 }}>
        <li>A1, A2 y A3 llevan la muñeca a su lugar (posición).</li>
        <li>A4, A5 y A6 orientan la herramienta.</li>
        <li>Singularidad: con A5 en 0°, A4 y A6 quedan alineados.</li>
      </ul>
      <h4>Movimientos</h4>
      <TablaFicha
        cabeza={['Movimiento', 'Qué hace', 'Cuándo se usa']}
        filas={[
          [<strong>PTP</strong>, 'Todos los ejes a la vez; el TCP no va en línea recta', 'Acercarse y alejarse (rápido)'],
          [<strong>LIN</strong>, 'El TCP en línea recta a la velocidad dada', 'Trabajar la pieza: tramos rectos'],
          [<strong>CIR</strong>, 'Arco que pasa por un punto auxiliar', 'Trabajar la pieza: tramos curvos'],
        ]}
      />
      <h4>Ficha técnica</h4>
      <TablaFicha
        cabeza={['Dato', 'Qué significa']}
        filas={[
          ['Carga', 'Peso máximo en el flange, incluida la herramienta'],
          ['Alcance máximo', 'Hasta dónde llega el centro de la muñeca (campo de trabajo)'],
          ['Repetibilidad', 'Cuánto se aleja al volver al mismo punto'],
          ['Número de ejes', 'Grados de libertad'],
          ['Montaje', 'Suelo, pared, techo…'],
        ]}
      />
      <h4>Componentes</h4>
      <p style={{ margin: 0 }}>Manipulador (brazo) · controlador (armario) · interfaz de control (teach pendant; en KUKA, smartPAD) · efector final (pinza, husillo…) · sensores.</p>
    </FichaRepaso>
  )
}
