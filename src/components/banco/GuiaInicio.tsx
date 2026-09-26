/**
 * Guía de inicio: tres o cuatro pasos para partir en una unidad. Aparece la
 * primera vez que se abre la unidad (en este navegador) y se vuelve a abrir
 * con el botón «?». Se puede saltar en cualquier momento.
 */
import { useState } from 'react'
import { usePersistente } from '../ui'

export interface PasoGuia {
  titulo: string
  texto: string
}

/** Estado de la guía de una unidad: visible la primera vez; `abrir` la muestra de nuevo. */
export function useGuia(unidad: string) {
  const [vista, setVista] = usePersistente(`neumalab.guia.${unidad}`, false)
  const [forzada, setForzada] = useState(false)
  return {
    visible: !vista || forzada,
    abrir: () => setForzada(true),
    cerrar: () => {
      setVista(true)
      setForzada(false)
    },
  }
}

export default function GuiaInicio({ unidad, pasos, onCerrar }: { unidad: string; pasos: PasoGuia[]; onCerrar: () => void }) {
  const [i, setI] = useState(0)
  const paso = pasos[i]
  const ultimo = i === pasos.length - 1
  return (
    <div role="dialog" aria-labelledby="titulo-guia" aria-describedby="texto-guia" className="guia-inicio" data-guia-inicio={unidad}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#51606f', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Para partir · {unidad} · {i + 1} de {pasos.length}
        </span>
        <button onClick={onCerrar} className="boton-icono" style={{ marginLeft: 'auto' }} aria-label="Cerrar la guía">
          ✕
        </button>
      </div>
      <h2 id="titulo-guia" style={{ margin: '2px 0 4px', fontSize: '1rem', color: '#1c2733' }}>
        {paso.titulo}
      </h2>
      <p id="texto-guia" style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, color: '#26323f' }}>
        {paso.texto}
      </p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}>
        <div aria-hidden style={{ display: 'flex', gap: 4 }}>
          {pasos.map((_, k) => (
            <span key={k} style={{ width: 7, height: 7, borderRadius: 99, background: k === i ? '#1668c7' : '#c6ced6' }} />
          ))}
        </div>
        {i > 0 && (
          <button onClick={() => setI(i - 1)} style={{ ...boton, marginLeft: 'auto' }}>
            ← Atrás
          </button>
        )}
        <button onClick={() => (ultimo ? onCerrar() : setI(i + 1))} style={{ ...boton, marginLeft: i > 0 ? 0 : 'auto', background: '#1668c7', color: '#fff', borderColor: '#1668c7' }} data-guia-siguiente="si">
          {ultimo ? 'Listo' : 'Siguiente →'}
        </button>
      </div>
      {!ultimo && (
        <button onClick={onCerrar} style={{ border: 'none', background: 'transparent', color: '#51606f', fontSize: '0.8rem', marginTop: 6, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
          Saltar la guía (la vuelves a ver con «?»)
        </button>
      )}
    </div>
  )
}

const boton: React.CSSProperties = { border: '1px solid #c6ced6', background: '#fff', color: '#33475c', borderRadius: 8, padding: '0.3rem 0.8rem', fontWeight: 600, fontSize: '0.86rem', minHeight: 34, cursor: 'pointer' }

export const GUIA_NEUMATICA: PasoGuia[] = [
  { titulo: '1 · Arma tu circuito', texto: 'Arrastra fichas desde la paleta de la izquierda al tablero (o haz clic en una para agregarla). Empieza por el Compresor + FRL, que da el aire.' },
  { titulo: '2 · Conecta con mangueras', texto: 'Haz clic en un puerto (los círculos) y luego en otro: queda una manguera. Selecciona una ficha para ver sus propiedades a la derecha: su nombre, su letra (A, B…), el cilindro que pisa un final de carrera…' },
  { titulo: '3 · Simula', texto: 'Pulsa ▶ Simular (o Espacio). Mantén pulsado el botón de una válvula para accionarla; la de inicio con enclavamiento queda accionada. Abajo ves lo que va pasando y el diagrama espacio-fase.' },
  { titulo: '4 · Entrega', texto: '¿No sabes por dónde partir? Abre un ejemplo en la barra de arriba. Cuando tengas tu tarea, «Entregar» (arriba a la derecha) te da las imágenes para tu PPT y el archivo que subes.' },
]

export const GUIA_PLC: PasoGuia[] = [
  { titulo: '1 · Elige la planta', texto: 'Pulsa «Planta ▾» en la barra: eliges la máquina que vas a controlar (estanque, silo, semáforo…) y ahí mismo ves sus ejercicios para resolver y sus ejemplos resueltos.' },
  { titulo: '2 · Arma el programa Ladder', texto: 'Elige una herramienta (Contacto NA, Bobina, TON…) y haz clic en una casilla del escalón. Con «Elegir» seleccionas un elemento para cambiar su dirección (I0.1, Q0.0…).' },
  { titulo: '3 · Pásalo a RUN', texto: '▶ RUN (o Espacio) y acciona la planta con sus mandos (START, STOP) o con los botones de la máquina en 3D. Con ❚❚ Pausar puedes ir un barrido a la vez.' },
  { titulo: '4 · Revisa y entrega', texto: 'Abajo tienes las entradas y salidas, la tabla de símbolos y qué va pasando. «Entregar» te da el Ladder, la tabla de E/S y el enlace a tu programa.' },
]

export const GUIA_CNC: PasoGuia[] = [
  { titulo: '1 · Prepara la máquina', texto: 'Elige torno o fresadora. Abajo, en «Preparación», pon el material y las medidas del bruto (y cuánto toman las garras).' },
  { titulo: '2 · Escribe el programa', texto: 'Escribe el código G en el editor, con un comentario entre paréntesis en cada línea, o abre un ejemplo. Los errores se marcan en la misma línea.' },
  { titulo: '3 · Mecaniza', texto: '▶ Ciclo corre todo el programa; ⏭ avanza bloque a bloque. Si la herramienta choca o entra en rápido al material, salta una ALARMA con la línea.' },
  { titulo: '4 · Revisa y entrega', texto: 'Abajo: la trayectoria 2D con sus puntos, qué hace cada bloque y la tabla de coordenadas. «Entregar» te da todo eso, el .cnc y el video.' },
]

export const GUIA_ROBOT: PasoGuia[] = [
  { titulo: '1 · Trae tu pieza', texto: 'Abre un ejemplo o parte con una definición vacía. Con «Abrir DXF» traes las curvas del plano de tu pieza.' },
  { titulo: '2 · Arma la definición', texto: 'Agrega componentes desde las pestañas (Curve, KUKA|prc…) o con doble clic en el fondo, y une salidas (a la derecha) con entradas (a la izquierda). El Core junta los comandos, el robot y la herramienta.' },
  { titulo: '3 · Simula', texto: '▶ reproduce el recorrido en 3D. El análisis avisa si un eje llega a su límite, si el robot no alcanza o si pasa cerca de una singularidad.' },
  { titulo: '4 · Entrega', texto: '«Entregar» te da el croquis de la pieza, el posicionamiento, la ficha técnica, el programa KRL y el video.' },
]
