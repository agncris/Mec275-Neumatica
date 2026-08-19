/**
 * Paleta de componentes: fichas en miniatura (como la bandeja de imanes del
 * banco real). Clic para colocar en la pizarra.
 */
import type { Params } from '../engine'
import { SimboloPieza } from '../symbols/Simbolos'
import { DESCRIPTORES } from './descriptores'
import { useStore } from '../store'

interface Entrada {
  tipo: string
  etiqueta: string
  params: Params
}

const ENTRADAS: Entrada[] = [
  { tipo: 'fuente', etiqueta: 'Compresor + FRL', params: { presion: 6, encendida: true } },
  { tipo: 'valvula32', etiqueta: 'Válvula 3/2 NC (pulsador)', params: { reposo: 'NC', accionamiento: 'pulsador' } },
  { tipo: 'valvula32', etiqueta: 'Válvula 3/2 NA (pulsador)', params: { reposo: 'NA', accionamiento: 'pulsador' } },
  { tipo: 'valvula42', etiqueta: 'Válvula 4/2 monoestable', params: { modo: 'monoestable', accionamiento: 'pulsador' } },
  { tipo: 'valvula52', etiqueta: 'Válvula 5/2 monoestable', params: { modo: 'monoestable', accionamiento: 'pulsador' } },
  { tipo: 'valvula52', etiqueta: 'Válvula 5/2 biestable', params: { modo: 'biestable' } },
  { tipo: 'cilindroSimpleEfecto', etiqueta: 'Cilindro simple efecto', params: {} },
  { tipo: 'cilindroDobleEfecto', etiqueta: 'Cilindro doble efecto', params: {} },
  { tipo: 'reguladorCaudal', etiqueta: 'Regulador de caudal', params: { apertura: 0.5 } },
  { tipo: 'finalCarrera', etiqueta: 'Final de carrera (rodillo)', params: { reposo: 'NC', puntoDisparo: 1 } },
  { tipo: 'valvulaO', etiqueta: 'Selectora «O»', params: {} },
  { tipo: 'valvulaY', etiqueta: 'Simultaneidad «Y»', params: {} },
  { tipo: 'escapeRapido', etiqueta: 'Escape rápido', params: {} },
  { tipo: 'temporizador', etiqueta: 'Temporizador', params: { retardo: 2 } },
]

export default function Paleta({ horizontal = false }: { horizontal?: boolean }) {
  const agregarPieza = useStore((s) => s.agregarPieza)
  const iniciarColocacion = useStore((s) => s.iniciarColocacion)
  return (
    <aside
      style={
        horizontal
          ? {
              // En tablet la paleta es una bandeja que se desliza en horizontal
              width: '100%',
              display: 'flex',
              flexDirection: 'row',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 6,
            }
          : {
              width: 190,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: 620,
              overflowY: 'auto',
            }
      }
    >
      {!horizontal && (
        <h3 style={{ margin: '0 0 2px', fontSize: '0.85rem', color: '#33475c' }}>Componentes</h3>
      )}
      {ENTRADAS.map((entrada, i) => {
        const desc = DESCRIPTORES[entrada.tipo]
        return (
          <button
            key={i}
            onPointerDown={(e) =>
              iniciarColocacion(entrada.tipo, { ...entrada.params }, { x: e.clientX, y: e.clientY })
            }
            onClick={(e) => {
              // Solo teclado (Enter/Espacio): el puntero ya se maneja en la colocación
              if (e.detail === 0) agregarPieza(entrada.tipo, { ...entrada.params })
            }}
            title={`Arrastra a la pizarra o haz clic para añadir: ${entrada.etiqueta}`}
            style={{
              background: '#fffefa',
              border: '1px solid #d8d3c6',
              borderRadius: 8,
              padding: '6px 8px',
              cursor: 'grab',
              textAlign: 'center',
              boxShadow: '0 1px 2px rgba(28,39,51,0.1)',
              touchAction: horizontal ? 'pan-x' : 'pan-y',
              flex: horizontal ? '0 0 120px' : undefined,
            }}
          >
            <svg
              viewBox={`-6 -6 ${desc.ancho + 12} ${desc.alto + 12}`}
              style={{ width: '100%', height: horizontal ? 44 : 56 }}
            >
              <SimboloPieza tipo={entrada.tipo} params={entrada.params} vivo={null} />
            </svg>
            <div style={{ fontSize: horizontal ? '0.66rem' : '0.72rem', color: '#33475c', marginTop: 2 }}>
              {entrada.etiqueta}
            </div>
          </button>
        )
      })}
    </aside>
  )
}
