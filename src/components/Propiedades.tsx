/**
 * Panel de propiedades de la pieza seleccionada (modo editar).
 */
import { esActuador } from '../engine'
import { DESCRIPTORES } from './descriptores'
import { useStore } from '../store'
import { letraDe, rotuloPieza } from '../rotulos'

export default function Propiedades() {
  const seleccion = useStore((s) => s.seleccion)
  const piezas = useStore((s) => s.piezas)
  const setParamPieza = useStore((s) => s.setParamPieza)
  const borrarSeleccion = useStore((s) => s.borrarSeleccion)

  if (!seleccion) {
    return (
      <p style={{ color: '#5a6b7d', margin: 0 }}>
        Selecciona una ficha o una manguera del tablero para ver y cambiar sus propiedades. Para
        cablear, haz clic en un puerto y luego en el puerto de destino.
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }} data-propiedades={pieza.id}>
      <strong>
        {pieza.id} — {desc?.nombre}
      </strong>

      <label style={etiqueta}>
        Nombre en la máquina:
        <input
          value={String(pieza.params.nombre ?? '')}
          onChange={(e) => setParamPieza(pieza.id, 'nombre', e.target.value)}
          placeholder={esActuador(pieza.tipo) ? 'Ej.: Elevador' : pieza.tipo === 'valvula32' ? 'Ej.: Inicio' : 'Opcional'}
          maxLength={24}
          style={{ padding: '0.3rem 0.45rem', border: '1px solid #b8c1ca', borderRadius: 6, minHeight: 32 }}
          data-nombre-pieza={pieza.id}
        />
      </label>

      {esActuador(pieza.tipo) && (
        <label style={etiqueta} title="La letra con que aparece en la secuencia (A+ B+ …), en el diagrama de fase y en las señales de sus finales de carrera (a0, a1)">
          Letra en la secuencia:
          <select value={letraDe(pieza.id, piezas)} onChange={(e) => setParamPieza(pieza.id, 'letra', e.target.value)} data-letra-pieza={pieza.id}>
            {'ABCDEFGHIJ'.split('').map((l) => (
              <option key={l} value={l}>
                {l}
                {piezas.some((q) => q.id !== pieza.id && esActuador(q.tipo) && letraDe(q.id, piezas) === l) ? ' (la usa otro actuador)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

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
      {pieza.tipo === 'valvula32' && (
        <label style={etiqueta}>
          Accionamiento:
          <select
            value={String(pieza.params.accionamiento ?? 'pulsador')}
            onChange={(e) => setParamPieza(pieza.id, 'accionamiento', e.target.value)}
            data-accionamiento={pieza.id}
          >
            <option value="pulsador">Pulsador (vuelve al soltarlo)</option>
            <option value="enclavamiento">Pulsador con enclavamiento (queda accionada: inicio de ciclo)</option>
            <option value="pilotaje">Pilotaje neumático ({pieza.params.reposo === 'NA' ? '10' : '12'})</option>
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
                .filter((p) => esActuador(p.tipo) && p.tipo !== 'motorNeumatico')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {rotuloPieza(c, piezas)}
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

      {pieza.tipo === 'actuadorGiratorio' && (
        <label style={etiqueta}>
          Ángulo de giro:
          <select
            value={String(pieza.params.angulo ?? 180)}
            onChange={(e) => setParamPieza(pieza.id, 'angulo', Number(e.target.value))}
          >
            <option value="90">90°</option>
            <option value="180">180°</option>
            <option value="270">270°</option>
          </select>
        </label>
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

      {pieza.tipo === 'motorNeumatico' && (
        <label style={etiqueta}>
          Velocidad: <strong>{Number(pieza.params.velocidad ?? 0.4).toFixed(2)} vueltas/s</strong>
          <input
            type="range"
            min={0.1}
            max={1.5}
            step={0.05}
            value={Number(pieza.params.velocidad ?? 0.4)}
            onChange={(e) => setParamPieza(pieza.id, 'velocidad', Number(e.target.value))}
          />
        </label>
      )}

      {pieza.tipo === 'sensorGiro' && (
        <>
          <label style={etiqueta}>
            Lo acciona:
            <select
              value={String(pieza.params.motor ?? '')}
              onChange={(e) => setParamPieza(pieza.id, 'motor', e.target.value)}
            >
              <option value="">— elige un motor —</option>
              {piezas
                .filter((p) => p.tipo === 'motorNeumatico')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
            </select>
          </label>
          <label style={etiqueta}>
            Punto de la vuelta:
            <select
              value={String(pieza.params.puntoDisparo ?? 0)}
              onChange={(e) => setParamPieza(pieza.id, 'puntoDisparo', Number(e.target.value))}
            >
              <option value="0">0% (inicio de vuelta)</option>
              <option value="0.25">25%</option>
              <option value="0.5">50%</option>
              <option value="0.75">75%</option>
            </select>
          </label>
          <label style={etiqueta}>
            Duración del pulso: <strong>{Number(pieza.params.duracionPulso ?? 0.3).toFixed(2)} s</strong>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={Number(pieza.params.duracionPulso ?? 0.3)}
              onChange={(e) => setParamPieza(pieza.id, 'duracionPulso', Number(e.target.value))}
            />
          </label>
        </>
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
  flexWrap: 'wrap',
  gap: '4px 8px',
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
