import { componente, describirDato, paramsIniciales, type Definicion, type evaluar } from './nodos'
import type { robotPorId } from './robots'

export function Propiedades({
  nodo,
  evaluacion,
  onParam,
  onBorrar,
  onDuplicar,
  capas,
  enfocar,
  cables = [],
  onDesconectar,
}: {
  nodo: Definicion['nodos'][number] | null
  evaluacion: ReturnType<typeof evaluar>
  onParam: (clave: string, valor: number | string | boolean) => void
  onBorrar: () => void
  onDuplicar: () => void
  capas: string[]
  /** Clave del parámetro que el paso actual pide cambiar. */
  enfocar?: string
  /** Cables que llegan a este componente. */
  cables?: Definicion['cables']
  onDesconectar?: (c: Definicion['cables'][number]) => void
}) {
  if (!nodo)
    return (
      <p style={{ margin: '8px 0 0', fontSize: '0.84rem', color: 'var(--tinta-tenue)' }} data-propiedades="vacio">
        Elige un bloque para ver qué hace y cambiar sus valores. En el lienzo, conecta la salida (derecha) con la entrada (izquierda). Con la rueda, o con − y +, acercas y alejas.
      </p>
    )
  const comp = componente(nodo.tipo)
  if (!comp) return null
  const ev = evaluacion.nodos[nodo.id]
  const params = { ...paramsIniciales(comp), ...nodo.params }
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid var(--borde-suave)', paddingTop: 8 }} data-propiedades={nodo.tipo}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--tinta)' }}>
          {comp.nombre} ({comp.corto})
        </strong>
        <span style={{ fontSize: '0.78rem', color: 'var(--tinta-gris)' }}>
          {comp.pestana} › {comp.grupo}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button onClick={onDuplicar} style={botonSuave}>
            Duplicar
          </button>
          <button onClick={onBorrar} style={{ ...botonSuave, color: 'var(--rojo)', borderColor: '#e0a0a0' }}>
            Eliminar
          </button>
        </span>
      </div>
      <p style={{ margin: '4px 0 6px', fontSize: '0.86rem', lineHeight: 1.45 }}>{comp.descripcion}</p>
      {ev?.mensajes.map((m, i) => (
        <p key={i} style={{ margin: '2px 0', fontSize: '0.84rem', color: ev.estado === 'error' ? 'var(--rojo)' : 'var(--naranjo-aviso)' }}>
          {ev.estado === 'error' ? '✕' : '⚠'} {m}
        </p>
      ))}
      {comp.params.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '6px 0' }}>
          {comp.params.filter((p) => !p.si || p.si(params)).map((p) => {
            const valor = params[p.clave]
            return (
              <label key={p.clave} data-param={p.clave} style={{ ...rotulo, flexDirection: p.tipo === 'bool' ? 'row' : 'column', alignItems: p.tipo === 'bool' ? 'center' : 'flex-start', gap: 2, outline: enfocar === p.clave ? '2px solid var(--azul)' : undefined, background: enfocar === p.clave ? '#e8f2fb' : undefined, borderRadius: 6, padding: enfocar === p.clave ? '2px 6px' : undefined }}>
                {p.tipo !== 'bool' && <span>{p.etiqueta}</span>}
                {p.tipo === 'numero' && (
                  <input
                    type="number"
                    value={Number(valor)}
                    step={p.paso ?? 'any'}
                    onChange={(e) => {
                      const x = Number(e.target.value)
                      if (Number.isFinite(x)) onParam(p.clave, x)
                    }}
                    style={{ width: 100, padding: '3px 6px', border: '1px solid var(--borde)', borderRadius: 6 }}
                  />
                )}
                {p.tipo === 'texto' &&
                  (p.clave === 'capa' && capas.length ? (
                    <select value={String(valor)} onChange={(e) => onParam(p.clave, e.target.value)} style={{ padding: '3px 4px' }}>
                      <option value="">Todas las capas</option>
                      {capas.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={String(valor)} onChange={(e) => onParam(p.clave, e.target.value)} style={{ width: 180, padding: '3px 6px', border: '1px solid var(--borde)', borderRadius: 6 }} />
                  ))}
                {p.tipo === 'opcion' && (
                  <select value={String(valor)} onChange={(e) => onParam(p.clave, e.target.value)} style={{ padding: '3px 4px', maxWidth: 260 }}>
                    {p.opciones?.map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
                {p.tipo === 'bool' && (
                  <>
                    <input type="checkbox" checked={valor !== false} onChange={(e) => onParam(p.clave, e.target.checked)} /> {p.etiqueta}
                  </>
                )}
              </label>
            )
          })}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, fontSize: '0.8rem' }}>
        {comp.entradas.length > 0 && (
          <div>
            <strong>Entradas</strong>
            <ul style={{ margin: '2px 0', paddingLeft: 16 }}>
              {comp.entradas.map((e, i) => {
                const llegan = cables.filter((c) => c.entrada === i)
                return (
                  <li key={e.corto}>
                    <code>{e.corto}</code> {e.nombre}: {e.descripcion}
                    {llegan.map((c) => (
                      <span key={`${c.de}-${c.salida}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
                        <span style={{ color: 'var(--tinta-suave)' }}>← {c.de}</span>
                        {onDesconectar && (
                          <button onClick={() => onDesconectar(c)} style={{ ...botonSuave, padding: '1px 8px', fontSize: '0.76rem', minHeight: 28 }} title="Quitar este cable">
                            Desconectar
                          </button>
                        )}
                      </span>
                    ))}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {comp.salidas.length > 0 && (
          <div>
            <strong>Salidas</strong>
            <ul style={{ margin: '2px 0', paddingLeft: 16 }}>
              {comp.salidas.map((s, j) => {
                const datos = ev?.salidas[j] ?? []
                return (
                  <li key={s.corto}>
                    <code>{s.corto}</code> {s.nombre}: {datos.length} elemento(s)
                    {datos.length > 0 && <span style={{ color: 'var(--tinta-tenue)' }}> — {datos.slice(0, 2).map(describirDato).join('; ')}{datos.length > 2 ? '…' : ''}</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export function Ejes({ modelo, q, uso, onQ }: { modelo: ReturnType<typeof robotPorId>; q: number[]; uso: Array<[number, number]> | null; onQ?: (q: number[]) => void }) {
  return (
    <div className="escena-ejes" data-ejes="si" aria-label="Ángulos de los ejes">
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--tinta-suave)', flex: 'none' }}>Ejes</span>
      {q.map((x, k) => {
        const [lo, hi] = modelo.limites[k]
        const cerca = x < lo + 5 || x > hi - 5
        const recorrido = uso ? ` · el programa usa ${uso[k][0].toFixed(0)}° a ${uso[k][1].toFixed(0)}°` : ''
        return (
          <label key={k} title={`A${k + 1}: ${lo}° a ${hi}°${recorrido}${cerca ? ' · cerca del límite' : ''}`}>
            <strong>A{k + 1}</strong>
            <input
              type="range"
              min={lo}
              max={hi}
              step={0.5}
              value={Math.min(hi, Math.max(lo, x))}
              disabled={!onQ}
              aria-label={`Eje A${k + 1}`}
              onChange={(e) => onQ?.(q.map((a, i) => (i === k ? Number(e.target.value) : a)))}
              style={{ flex: 1, accentColor: cerca ? 'var(--rojo)' : 'var(--tinta)' }}
            />
            <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: cerca ? 'var(--rojo)' : 'var(--tinta)', minWidth: 46, textAlign: 'right' }}>{x.toFixed(1)}°</span>
          </label>
        )
      })}
    </div>
  )
}



const botonSuave: React.CSSProperties = { border: '1px solid #c6ced6', background: '#fff', color: '#33475c', padding: '0.35rem 0.75rem', borderRadius: 7, fontSize: '0.85rem', cursor: 'pointer' }
const rotulo: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#5a6b7d' }
