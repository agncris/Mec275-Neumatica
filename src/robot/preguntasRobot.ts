/**
 * Preguntas de práctica de robótica, generadas al azar: grados de libertad y
 * tipos de robot, ejes del KUKA, movimientos (PTP, LIN, CIR), ficha técnica y
 * componentes.
 */
import { elegir, mezclar, type Generador } from '../components/Autoevaluacion'

interface Fija {
  p: string
  ok: string
  mal: string[]
  porque: string
}

const desde =
  (tema: string, banco: Fija[]): Generador =>
  (azar) => {
    const q = elegir(banco, azar)
    const m = mezclar(q.ok, q.mal, azar)
    return { tema, enunciado: q.p, ...m, explicacion: q.porque }
  }

const GDL: Fija[] = [
  { p: '¿Cuántos grados de libertad tiene un robot antropomórfico (articulado) industrial típico?', ok: '6', mal: ['3', '4', '5'], porque: '3 para llevar la muñeca a cualquier posición (X, Y, Z) y 3 para darle cualquier orientación.' },
  { p: '¿Cuántos grados de libertad tiene un robot SCARA?', ok: '4', mal: ['3', '5', '6'], porque: 'Un SCARA tiene 4: X, Y, Z y el giro de la herramienta.' },
  { p: '¿Cuántos grados de libertad tiene un robot cartesiano (pórtico)?', ok: '3', mal: ['2', '4', '6'], porque: 'Un cartesiano tiene 3 ejes lineales: X, Y y Z.' },
  { p: 'Para dejar un objeto en cualquier posición y con cualquier orientación, ¿cuántos grados de libertad hacen falta?', ok: '6', mal: ['3', '4', '9'], porque: 'Posición: 3 (X, Y, Z). Orientación: otros 3.' },
  { p: 'En un KUKA de 6 ejes, ¿qué ejes llevan la muñeca a su lugar?', ok: 'A1, A2 y A3', mal: ['A4, A5 y A6', 'A1, A3 y A5', 'Sólo A1'], porque: 'A1, A2 y A3 posicionan la muñeca; A4, A5 y A6 orientan la herramienta.' },
  { p: 'En un KUKA de 6 ejes, ¿qué ejes orientan la herramienta?', ok: 'A4, A5 y A6', mal: ['A1, A2 y A3', 'A2, A4 y A6', 'Sólo A6'], porque: 'A4, A5 y A6 forman la muñeca y orientan la herramienta.' },
  { p: '¿Cuándo aparece la singularidad de muñeca en un robot de 6 ejes?', ok: 'Cuando A5 queda en 0° y A4 y A6 quedan alineados', mal: ['Cuando A1 gira 180°', 'Cuando el robot está en HOME', 'Cuando la carga supera la nominal'], porque: 'Con A5 en 0°, A4 y A6 giran sobre el mismo eje: el robot pierde un grado de libertad y cerca de ahí A4 y A6 pueden girar muy rápido.' },
]

const MOVIMIENTOS: Fija[] = [
  { p: '¿Qué movimiento lleva la punta de la herramienta (TCP) en línea recta de un punto a otro?', ok: 'LIN', mal: ['PTP', 'CIR', 'HOME'], porque: 'LIN: el TCP recorre una recta a la velocidad indicada. Es el que se usa para cortar o soldar siguiendo un trazo.' },
  { p: '¿Qué movimiento es el más rápido para ir de un punto a otro, aunque el TCP no vaya en línea recta?', ok: 'PTP', mal: ['LIN', 'CIR', 'Ninguno: todos tardan lo mismo'], porque: 'PTP (punto a punto) mueve cada eje a la vez hasta su destino: es rápido, pero la trayectoria del TCP no es recta. Sirve para acercarse, no para trabajar la pieza.' },
  { p: '¿Qué movimiento hace un arco pasando por un punto auxiliar?', ok: 'CIR', mal: ['LIN', 'PTP', 'SPLINE'], porque: 'CIR describe un arco que pasa por un punto auxiliar y termina en el punto final.' },
  { p: 'Para fresar el contorno de una pieza siguiendo el plano, ¿qué movimientos conviene usar mientras la herramienta corta?', ok: 'LIN y CIR', mal: ['Sólo PTP', 'PTP y LIN', 'Sólo HOME'], porque: 'Mientras corta, la herramienta debe seguir el trazo: rectas con LIN y arcos con CIR. PTP se usa para acercarse y alejarse.' },
]

const FICHA: Fija[] = [
  { p: 'En la ficha técnica de un robot, ¿qué es la repetibilidad?', ok: 'Cuánto se aleja al volver una y otra vez al mismo punto', mal: ['Cuántas veces puede repetir un programa por hora', 'La distancia máxima a la que llega', 'El peso que puede levantar'], porque: 'La repetibilidad (p. ej. ± 0,05 mm) mide cuánto varía al volver al mismo punto.' },
  { p: 'En la ficha técnica de un robot, ¿qué es la carga?', ok: 'El peso máximo en el flange, incluida la herramienta', mal: ['El peso del robot', 'La potencia de los motores', 'La corriente que consume'], porque: 'La carga nominal incluye la herramienta (el husillo, la pinza…) y la pieza que lleve.' },
  { p: 'En la ficha técnica de un robot, ¿qué define el alcance máximo?', ok: 'El campo de trabajo: hasta dónde llega el centro de la muñeca', mal: ['La velocidad máxima', 'El largo del cable', 'La altura del pedestal'], porque: 'El alcance es la distancia máxima al centro de la muñeca; define el campo de trabajo.' },
  { p: 'Al elegir el robot para un trabajo, ¿qué hay que revisar primero?', ok: 'Que la pieza quede dentro de su alcance y que soporte la herramienta', mal: ['Que sea el más grande disponible', 'Que tenga el menor número de ejes', 'Sólo el color'], porque: 'Se revisa el campo de trabajo (alcance) y la carga, y luego la repetibilidad que pide el trabajo.' },
]

const COMPONENTES: Fija[] = [
  { p: '¿Cómo se llama el brazo mecánico del robot, con sus eslabones y articulaciones?', ok: 'Manipulador', mal: ['Controlador', 'Efector final', 'Teach pendant'], porque: 'El manipulador es el brazo: eslabones unidos por articulaciones, movidos por servomotores.' },
  { p: '¿Qué parte del robot ejecuta el programa y maneja los motores?', ok: 'El controlador', mal: ['El manipulador', 'El efector final', 'El pedestal'], porque: 'El controlador es el computador del robot (el armario).' },
  { p: '¿Qué es el efector final?', ok: 'Lo que va en la punta: pinza, ventosa, husillo…', mal: ['El último eje del robot', 'El botón de parada de emergencia', 'El programa que termina el ciclo'], porque: 'El efector final es la herramienta en la punta del robot.' },
  { p: '¿Cómo se llama el mando portátil para mover el robot a mano y enseñar puntos (en KUKA, el smartPAD)?', ok: 'Interfaz de control (teach pendant)', mal: ['Controlador', 'Efector final', 'Encoder'], porque: 'Con el teach pendant se mueve el robot a mano, se enseñan puntos y se prueban programas.' },
]

export const PREGUNTAS_ROBOT = [
  { tema: 'Grados de libertad y ejes', generar: desde('Grados de libertad y ejes', GDL) },
  { tema: 'Movimientos', generar: desde('Movimientos', MOVIMIENTOS) },
  { tema: 'Ficha técnica', generar: desde('Ficha técnica', FICHA) },
  { tema: 'Componentes', generar: desde('Componentes', COMPONENTES) },
]
