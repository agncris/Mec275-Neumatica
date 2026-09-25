/**
 * Paleta de componentes del banco (como la bandeja de fichas del laboratorio):
 * agrupada por función, con buscador, filas compactas y la opción de plegarla
 * a una tira de íconos. Se arrastra una ficha al tablero, o se hace clic (o
 * se toca) para agregarla en un lugar libre a la vista.
 */
import { useMemo, useState } from 'react'
import type { Params } from '../engine'
import { SimboloPieza } from '../symbols/Simbolos'
import { DESCRIPTORES } from './descriptores'
import { useStore } from '../store'
import { usePersistente } from './ui'

interface Entrada {
  tipo: string
  etiqueta: string
  params: Params
}

interface Grupo {
  id: string
  titulo: string
  entradas: Entrada[]
}

export const GRUPOS: Grupo[] = [
  {
    id: 'alimentacion',
    titulo: 'Alimentación',
    entradas: [
      { tipo: 'fuente', etiqueta: 'Compresor + FRL', params: { presion: 6, encendida: true } },
      { tipo: 'manometro', etiqueta: 'Manómetro', params: {} },
    ],
  },
  {
    id: 'valvulas',
    titulo: 'Válvulas distribuidoras',
    entradas: [
      { tipo: 'valvula32', etiqueta: 'Válvula 3/2 NC (pulsador)', params: { reposo: 'NC', accionamiento: 'pulsador' } },
      { tipo: 'valvula32', etiqueta: 'Válvula 3/2 NA (pulsador)', params: { reposo: 'NA', accionamiento: 'pulsador' } },
      { tipo: 'valvula42', etiqueta: 'Válvula 4/2 monoestable', params: { modo: 'monoestable', accionamiento: 'pulsador' } },
      { tipo: 'valvula52', etiqueta: 'Válvula 5/2 monoestable', params: { modo: 'monoestable', accionamiento: 'pulsador' } },
      { tipo: 'valvula52', etiqueta: 'Válvula 5/2 biestable', params: { modo: 'biestable' } },
    ],
  },
  {
    id: 'actuadores',
    titulo: 'Actuadores',
    entradas: [
      { tipo: 'cilindroSimpleEfecto', etiqueta: 'Cilindro simple efecto', params: {} },
      { tipo: 'cilindroDobleEfecto', etiqueta: 'Cilindro doble efecto', params: {} },
      { tipo: 'actuadorGiratorio', etiqueta: 'Actuador giratorio', params: { angulo: 180 } },
      { tipo: 'motorNeumatico', etiqueta: 'Motor neumático (giro continuo)', params: { velocidad: 0.4 } },
    ],
  },
  {
    id: 'sensores',
    titulo: 'Sensores y señales',
    entradas: [
      { tipo: 'finalCarrera', etiqueta: 'Final de carrera (rodillo)', params: { reposo: 'NC', puntoDisparo: 1 } },
      { tipo: 'sensorGiro', etiqueta: 'Sensor de paso (motor)', params: { puntoDisparo: 0, duracionPulso: 0.3 } },
    ],
  },
  {
    id: 'logica',
    titulo: 'Lógica y regulación',
    entradas: [
      { tipo: 'valvulaO', etiqueta: 'Selectora «O»', params: {} },
      { tipo: 'valvulaY', etiqueta: 'Simultaneidad «Y»', params: {} },
      { tipo: 'reguladorCaudal', etiqueta: 'Regulador de caudal', params: { apertura: 0.5 } },
      { tipo: 'escapeRapido', etiqueta: 'Escape rápido', params: {} },
      { tipo: 'temporizador', etiqueta: 'Temporizador', params: { retardo: 2 } },
    ],
  },
]

/** Sin tildes ni mayúsculas, para buscar. */
const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

interface Props {
  /** Plegada a una tira de íconos. */
  plegada?: boolean
  onPlegar?: (plegada: boolean) => void
  /** Mientras se simula no se puede editar. */
  deshabilitada?: boolean
  /** En la bandeja del celular: al elegir una ficha se cierra la bandeja. */
  onElegida?: () => void
}

export default function Paleta({ plegada = false, onPlegar, deshabilitada = false, onElegida }: Props) {
  const agregarPieza = useStore((s) => s.agregarPieza)
  const iniciarColocacion = useStore((s) => s.iniciarColocacion)
  const [texto, setTexto] = useState('')
  const [abiertos, setAbiertos] = usePersistente<Record<string, boolean>>('neumalab.paleta.grupos', {
    alimentacion: true,
    valvulas: true,
    actuadores: true,
    sensores: false,
    logica: false,
  })

  const buscado = normal(texto.trim())
  const grupos = useMemo(
    () =>
      GRUPOS.map((g) => ({
        ...g,
        entradas: buscado ? g.entradas.filter((e) => normal(`${e.etiqueta} ${g.titulo} ${DESCRIPTORES[e.tipo]?.nombre ?? ''}`).includes(buscado)) : g.entradas,
      })).filter((g) => g.entradas.length),
    [buscado],
  )

  const ficha = (e: Entrada, mini: boolean) => {
    const desc = DESCRIPTORES[e.tipo]
    return (
      <button
        key={`${e.tipo}-${e.etiqueta}`}
        className="ficha-paleta"
        disabled={deshabilitada}
        onPointerDown={(ev) => {
          if (deshabilitada) return
          iniciarColocacion(e.tipo, { ...e.params }, { x: ev.clientX, y: ev.clientY })
        }}
        onClick={(ev) => {
          // Sólo teclado (Enter/Espacio): el puntero ya se maneja en la colocación.
          if (ev.detail === 0) agregarPieza(e.tipo, { ...e.params })
          onElegida?.()
        }}
        title={`${e.etiqueta}: arrástrala al tablero, o haz clic para agregarla`}
        aria-label={e.etiqueta}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          minHeight: 44,
          padding: mini ? 4 : '4px 8px',
          justifyContent: mini ? 'center' : 'flex-start',
          border: '1px solid transparent',
          borderRadius: 6,
          background: 'transparent',
          cursor: deshabilitada ? 'not-allowed' : 'grab',
          textAlign: 'left',
          touchAction: 'pan-y',
          color: '#1c2733',
        }}
      >
        <svg viewBox={`-6 -6 ${desc.ancho + 12} ${desc.alto + 12}`} style={{ width: 32, height: 32, flex: 'none', background: '#fffefa', border: '1px solid #e2ddd0', borderRadius: 4 }} aria-hidden>
          <SimboloPieza tipo={e.tipo} params={e.params} vivo={null} />
        </svg>
        {!mini && <span style={{ fontSize: '0.84rem', lineHeight: 1.2 }}>{e.etiqueta}</span>}
      </button>
    )
  }

  if (plegada) {
    return (
      <aside aria-label="Componentes" className="banco-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 3px', overflowY: 'auto', opacity: deshabilitada ? 0.5 : 1 }}>
        <button onClick={() => onPlegar?.(false)} className="boton-icono" title="Mostrar la paleta completa" aria-label="Mostrar la paleta completa">
          »
        </button>
        {GRUPOS.flatMap((g) => g.entradas).map((e) => ficha(e, true))}
      </aside>
    )
  }

  return (
    <aside aria-label="Componentes" className="banco-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '6px 6px 4px' }}>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar componente…"
          aria-label="Buscar componente"
          disabled={deshabilitada}
          style={{ flex: 1, minWidth: 0, padding: '0.35rem 0.5rem', border: '1px solid #b8c1ca', borderRadius: 6, fontSize: '0.85rem', minHeight: 32 }}
        />
        {onPlegar && (
          <button onClick={() => onPlegar(true)} className="boton-icono" title="Plegar la paleta a una tira de íconos" aria-label="Plegar la paleta">
            «
          </button>
        )}
      </div>
      <div style={{ overflowY: 'auto', minHeight: 0, flex: 1, padding: '0 4px 6px', opacity: deshabilitada ? 0.45 : 1 }}>
        {grupos.map((g) => {
          const abierto = buscado ? true : abiertos[g.id] !== false
          return (
            <section key={g.id} style={{ marginTop: 2 }}>
              <button
                onClick={() => setAbiertos((a) => ({ ...a, [g.id]: !abierto }))}
                aria-expanded={abierto}
                className="cabeza-grupo"
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', border: 'none', background: 'transparent', padding: '6px 4px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', color: '#33475c', textTransform: 'uppercase', letterSpacing: '0.03em', minHeight: 32, textAlign: 'left' }}
              >
                <span aria-hidden style={{ width: 10 }}>{abierto ? '▾' : '▸'}</span>
                {g.titulo}
                <span style={{ marginLeft: 'auto', fontWeight: 500, color: '#51606f' }}>{g.entradas.length}</span>
              </button>
              {abierto && g.entradas.map((e) => ficha(e, false))}
            </section>
          )
        })}
        {!grupos.length && <p style={{ fontSize: '0.84rem', color: '#51606f', padding: '6px 8px', margin: 0 }}>No hay componentes con «{texto}».</p>}
      </div>
      {deshabilitada && (
        <p role="note" style={{ position: 'absolute', left: 8, right: 8, top: 44, margin: 0, padding: '0.5rem 0.6rem', background: '#fff', border: '1px solid #c6ced6', borderRadius: 8, fontSize: '0.84rem', color: '#33475c', boxShadow: '0 4px 12px rgba(28,39,51,0.12)', textAlign: 'center' }}>
          Detén la simulación para editar el circuito.
        </p>
      )}
    </aside>
  )
}
