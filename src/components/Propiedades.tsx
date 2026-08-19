/**
 * Panel de propiedades de la pieza seleccionada (modo editar).
 */
import { DESCRIPTORES } from './descriptores'
import { useStore } from '../store'

export default function Propiedades() {
  const seleccion = useStore((s) => s.seleccion)
  const piezas = useStore((s) => s.piezas)
  const setParamPieza = useStore((s) => s.setParamPieza)
  const borrarSeleccion = useStore((s) => s.borrarSeleccion)

  if (!seleccion) {
    return (
      <p style={{ color: '#5a6b7d', margin: 0 }}>
        Selecciona una ficha o una manguera para ver sus propiedades. Para cablear, haz clic en un
        puerto y luego en el puerto de destino.
      </p>
    )
  }

  if (seleccion.clase === 'manguera') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>
          Manguera <strong>{seleccion.id}</strong>
        </span>
        <button onClick={borrarSeleccion} style={botonPeligro}>
          Quitar manguera (Supr)
        </button>
      </div>
    )
  }

  const pieza = piezas.find((p) => p.id === seleccion.id)
  if (!pieza) return null
  const desc = DESCRIPTORES[pieza.tipo]

  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <strong>
        {pieza.id} — {desc?.nombre}
      </strong>

      {pieza.tipo === 'fuente' && (
        <label style={etiqueta}>
          Presión: <strong>{Number(pieza.params.presion ?? 6).toFixed(1)} bar</strong>
          <input
            type="range"
            min={2}
            max={8}
            step={0.5}
            value={Number(pieza.params.presion ?? 6)}
            onChange={(e) => setParamPieza(pieza.id, 'presion', Number(e.target.value))}
          />
        </label>
      )}

      {pieza.tipo === 'valvula32' && (
        <label style={etiqueta}>
          Reposo:
          <select
            value={String(pieza.params.reposo ?? 'NC')}
            onChange={(e) => setParamPieza(pieza.id, 'reposo', e.target.value)}
          >
            <option value="NC">Normalmente cerrada (NC)</option>
            <option value="NA">Normalmente abierta (NA)</option>
          </select>
        </label>
      )}

      {(pieza.tipo === 'valvula52' || pieza.tipo === 'valvula42') && (
        <>
          <label style={etiqueta}>
            Modo:
            <select
              value={String(pieza.params.modo ?? 'monoestable')}
              onChange={(e) => setParamPieza(pieza.id, 'modo', e.target.value)}
            >
              <option value="monoestable">Monoestable (muelle)</option>
              <option value="biestable">Biestable (memoria)</option>
            </select>
          </label>
          {pieza.params.modo !== 'biestable' && (
            <label style={etiqueta}>
              Accionamiento:
              <select
                value={String(pieza.params.accionamiento ?? 'pulsador')}
                onChange={(e) => setParamPieza(pieza.id, 'accionamiento', e.target.value)}
              >
                <option value="pulsador">Pulsador</option>
                <option value="pilotaje">Pilotaje neumático (14)</option>
              </select>
            </label>
          )}
        </>
      )}

      {pieza.tipo === 'finalCarrera' && (
        <>
          <label style={etiqueta}>
            Lo acciona:
            <select
              value={String(pieza.params.cilindro ?? '')}
              onChange={(e) => setParamPieza(pieza.id, 'cilindro', e.target.value)}
            >
              <option value="">— elige un cilindro —</option>
              {piezas
                .filter((p) => p.tipo.startsWith('cilindro'))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
            </select>
          </label>
          <label style={etiqueta}>
            Punto de disparo:
            <select
              value={Number(pieza.params.puntoDisparo ?? 1) >= 0.5 ? '1' : '0'}
              onChange={(e) => setParamPieza(pieza.id, 'puntoDisparo', Number(e.target.value))}
            >
              <option value="1">Vástago extendido (final de carrera)</option>
              <option value="0">Vástago retraído (posición inicial)</option>
            </select>
          </label>
          <label style={etiqueta}>
            Reposo:
            <select
              value={String(pieza.params.reposo ?? 'NC')}
              onChange={(e) => setParamPieza(pieza.id, 'reposo', e.target.value)}
            >
              <option value="NC">Normalmente cerrada (NC)</option>
              <option value="NA">Normalmente abierta (NA)</option>
            </select>
          </label>
        </>
      )}

      {pieza.tipo === 'temporizador' && (
        <label style={etiqueta}>
          Retardo: <strong>{Number(pieza.params.retardo ?? 2).toFixed(1)} s</strong>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={Number(pieza.params.retardo ?? 2)}
            onChange={(e) => setParamPieza(pieza.id, 'retardo', Number(e.target.value))}
          />
        </label>
      )}

      {pieza.tipo === 'reguladorCaudal' && (
        <label style={etiqueta}>
          Apertura: <strong>{Math.round(Number(pieza.params.apertura ?? 0.5) * 100)}%</strong>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={Number(pieza.params.apertura ?? 0.5)}
            onChange={(e) => setParamPieza(pieza.id, 'apertura', Number(e.target.value))}
          />
        </label>
      )}

      <button onClick={borrarSeleccion} style={botonPeligro}>
        Quitar pieza (Supr)
      </button>
    </div>
  )
}

const etiqueta: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: '0.9rem',
}

const botonPeligro: React.CSSProperties = {
  border: '1px solid #d9b1ae',
  background: '#fdf2f1',
  color: '#b3261e',
  borderRadius: 6,
  padding: '0.3rem 0.7rem',
  cursor: 'pointer',
  fontSize: '0.85rem',
}
