// Preparación de la máquina: material, bruto, cero del programa y herramientas.
import { almacenDe, COLORES_HERRAMIENTA, MATERIALES, torretaDe, type FormaFresa, type FormaTorno, type HerramientaFresa, type HerramientaTorno, type OrigenTorno, type ConfigCNC, material as materialDe } from './maquinas'
import { botonSuave, celda, rotulo, selector } from './estilos'

export default function Preparacion({
  config,
  setConfig,
  bloqueado,
  modoCero,
  addRegPart,
}: {
  config: ConfigCNC
  setConfig: (f: (c: ConfigCNC) => ConfigCNC) => void
  bloqueado: boolean
  modoCero: 'cara' | 'garras'
  addRegPart: number | null
}) {
  const torno = config.maquina === 'torno'
  const num = (valor: number, cambiar: (v: number) => void, min: number, max: number, etiqueta: string, ayuda?: string) => (
    <label style={{ ...rotulo, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} title={ayuda}>
      <span>{etiqueta}</span>
      <input
        type="number"
        value={valor}
        min={min}
        max={max}
        step={1}
        disabled={bloqueado}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) cambiar(Math.min(max, Math.max(min, v)))
        }}
        style={{ width: 80, padding: '3px 6px', border: '1px solid var(--borde)', borderRadius: 6 }}
      />
    </label>
  )
  const herramientas = torno ? torretaDe(config) : almacenDe(config)
  return (
    <section aria-label="Preparación">
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ ...rotulo, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <span>Material</span>
          <select value={config.material} disabled={bloqueado} onChange={(e) => setConfig((c) => ({ ...c, material: e.target.value }))} style={selector}>
            {MATERIALES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
        {torno ? (
          <>
            {num(config.torno.diametro, (v) => setConfig((c) => ({ ...c, torno: { ...c.torno, diametro: v } })), 5, 120, 'Diámetro bruto (mm)')}
            {num(config.torno.largo, (v) => setConfig((c) => ({ ...c, torno: { ...c.torno, largo: v } })), 20, 300, 'Largo bruto (mm)')}
            {num(config.torno.agarre, (v) => setConfig((c) => ({ ...c, torno: { ...c.torno, agarre: v } })), 10, 60, 'Toman las garras (mm)', 'Largo del material que queda dentro del plato')}
            {num(config.torno.sobremetal, (v) => setConfig((c) => ({ ...c, torno: { ...c.torno, sobremetal: v } })), 0, 10, 'Sobremetal en la cara (mm)', 'Material que sobresale delante de Z0, para refrentar')}
            <label style={{ ...rotulo, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} title="Dónde queda el cero (X0 Z0) del programa">
              <span>Cero del programa</span>
              <select
                value={config.torno.origen ?? 'auto'}
                disabled={bloqueado}
                onChange={(e) => setConfig((c) => ({ ...c, torno: { ...c.torno, origen: e.target.value as OrigenTorno } }))}
                style={selector}
                data-origen-torno="si"
              >
                <option value="auto">Automático</option>
                <option value="cara">En la cara de la pieza</option>
                <option value="garras">En las garras (CNC Simulator Pro)</option>
              </select>
            </label>
          </>
        ) : (
          <>
            {num(config.fresa.largo, (v) => setConfig((c) => ({ ...c, fresa: { ...c.fresa, largo: v } })), 10, 300, 'Largo X (mm)')}
            {num(config.fresa.ancho, (v) => setConfig((c) => ({ ...c, fresa: { ...c.fresa, ancho: v } })), 10, 300, 'Ancho Y (mm)')}
            {num(config.fresa.alto, (v) => setConfig((c) => ({ ...c, fresa: { ...c.fresa, alto: v } })), 3, 100, 'Alto Z (mm)')}
          </>
        )}
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--tinta-suave)', flex: '1 1 260px' }}>
          {torno
            ? modoCero === 'cara'
              ? `Cero del programa: en la cara frontal, sobre el eje. El bruto va de Z${config.torno.sobremetal} a Z${config.torno.sobremetal - config.torno.largo}; las garras llegan hasta Z${config.torno.sobremetal - config.torno.largo + config.torno.agarre}. X se programa en diámetro.`
              : `Cero del programa como en CNC Simulator Pro: Z0 en la cara de las garras. La cara del bruto queda en Z${config.torno.largo - config.torno.agarre} y las Z negativas entran al plato.${config.torno.agarre !== 23 ? ' (CNC Simulator Pro toma 23 mm en las garras.)' : ''} X se programa en diámetro. Con G92 puedes mover el cero.`
            : 'Cero pieza: esquina delantera izquierda de la cara superior. Z negativo corta hacia abajo.'}{' '}
          {addRegPart !== null && `El programa pide $AddRegPart ${addRegPart}: se usa el bruto de esta preparación. `}
          Avance orientativo para {materialDe(config.material).nombre.toLowerCase()}: {materialDe(config.material).avance.join('–')} mm/min.
        </p>
      </div>
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--tinta)', fontWeight: 600, fontSize: '0.9rem' }}>
          Herramientas {torno ? 'de la torreta' : 'del almacén'} ({herramientas.length}){(torno ? config.herramientasTorno : config.herramientasFresa) ? ' · propias' : ''}
        </summary>
        <EditorHerramientas config={config} setConfig={setConfig} bloqueado={bloqueado} />
      </details>
    </section>
  )
}

function EditorHerramientas({ config, setConfig, bloqueado }: { config: ConfigCNC; setConfig: (f: (c: ConfigCNC) => ConfigCNC) => void; bloqueado: boolean }) {
  const torno = config.maquina === 'torno'
  const lista: Array<HerramientaTorno | HerramientaFresa> = torno ? torretaDe(config) : almacenDe(config)
  const propias = torno ? !!config.herramientasTorno : !!config.herramientasFresa
  const guardar = (nueva: Array<HerramientaTorno | HerramientaFresa>) =>
    setConfig((c) => (torno ? { ...c, herramientasTorno: nueva as HerramientaTorno[] } : { ...c, herramientasFresa: nueva as HerramientaFresa[] }))
  const cambiar = (i: number, cambio: Partial<HerramientaTorno> & Partial<HerramientaFresa>) => guardar(lista.map((h, k) => (k === i ? ({ ...h, ...cambio } as HerramientaTorno | HerramientaFresa) : h)))
  const agregar = () => {
    const t = Math.max(0, ...lista.map((h) => h.t)) + 1
    const color = COLORES_HERRAMIENTA[t % COLORES_HERRAMIENTA.length]
    const nueva: HerramientaTorno | HerramientaFresa = torno
      ? { t, nombre: 'Herramienta nueva', forma: 'izquierda', angulo: 30, uso: 'Escribe para qué sirve.', color }
      : { t, nombre: 'Fresa nueva', forma: 'plana', diametro: 8, uso: 'Escribe para qué sirve.', color }
    guardar([...lista, nueva])
  }
  const repetidas = new Set(lista.map((h) => h.t).filter((t, i, a) => a.indexOf(t) !== i))
  const entrada: React.CSSProperties = { padding: '2px 4px', border: '1px solid #c6ced6', borderRadius: 4, fontSize: '0.82rem' }
  return (
    <div style={{ marginTop: 6 }} data-herramientas="si">
      <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: 'var(--tinta-tenue)' }}>
        Puedes cambiar las herramientas como en la máquina: el número T, el nombre, el tipo y sus medidas.
        {torno ? ' En el torno la medida es el ancho de la hoja (ranurado) o el diámetro (broca); el ángulo es el del filo secundario (el de roscado, el de la punta).' : ' El diámetro es el que usa la compensación de radio G41/G42 (radio = diámetro ÷ 2).'}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              {['T', 'Herramienta', 'Tipo', torno ? 'Medida / ángulo' : 'Diámetro', 'Para qué sirve', torno ? 'Cómo llamarla' : 'Cómo montarla', ''].map((h, i) => (
                <th key={i} style={{ textAlign: 'left', background: 'var(--tinta)', color: '#fff', padding: '4px 8px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((h, i) => {
              const ht = h as HerramientaTorno
              const hf = h as HerramientaFresa
              return (
                <tr key={i}>
                  <td style={{ ...celda, whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: `#${h.color.toString(16).padStart(6, '0')}`, marginRight: 5 }} />
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={h.t}
                      disabled={bloqueado}
                      onChange={(e) => cambiar(i, { t: Math.max(1, Math.min(99, Math.round(Number(e.target.value) || 1))) })}
                      style={{ ...entrada, width: 46, borderColor: repetidas.has(h.t) ? '#d93025' : 'var(--borde)' }}
                      aria-label="Número T"
                    />
                  </td>
                  <td style={celda}>
                    <input value={h.nombre} disabled={bloqueado} onChange={(e) => cambiar(i, { nombre: e.target.value })} style={{ ...entrada, width: 150 }} aria-label="Nombre" />
                  </td>
                  <td style={celda}>
                    <select value={h.forma} disabled={bloqueado} onChange={(e) => cambiar(i, { forma: e.target.value as FormaTorno & FormaFresa })} style={entrada}>
                      {(torno ? FORMAS_TORNO : FORMAS_FRESA).map(([v, t]) => (
                        <option key={v} value={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...celda, whiteSpace: 'nowrap' }}>
                    {torno ? (
                      ht.forma === 'ranurado' || ht.forma === 'broca' ? (
                        <label>
                          {ht.forma === 'broca' ? 'Ø' : 'ancho'}{' '}
                          <input type="number" min={0.5} max={40} step={0.5} value={ht.medida ?? 4} disabled={bloqueado} onChange={(e) => cambiar(i, { medida: Math.max(0.5, Number(e.target.value) || 1) })} style={{ ...entrada, width: 58 }} /> mm
                        </label>
                      ) : (
                        <label>
                          <input type="number" min={1} max={85} step={1} value={ht.angulo ?? (ht.forma === 'roscado' ? 60 : 5)} disabled={bloqueado} onChange={(e) => cambiar(i, { angulo: Math.max(1, Math.min(85, Number(e.target.value) || 5)) })} style={{ ...entrada, width: 52 }} />°
                        </label>
                      )
                    ) : (
                      <label>
                        Ø <input type="number" min={0.5} max={80} step={0.5} value={hf.diametro} disabled={bloqueado} onChange={(e) => cambiar(i, { diametro: Math.max(0.5, Math.min(80, Number(e.target.value) || 1)) })} style={{ ...entrada, width: 58 }} /> mm
                      </label>
                    )}
                  </td>
                  <td style={celda}>
                    <input value={h.uso} disabled={bloqueado} onChange={(e) => cambiar(i, { uso: e.target.value })} style={{ ...entrada, width: '100%', minWidth: 180 }} aria-label="Para qué sirve" />
                  </td>
                  <td style={{ ...celda, fontFamily: 'ui-monospace, Menlo, monospace' }}>{torno ? `T${String(h.t).padStart(2, '0')}${String(h.t).padStart(2, '0')}` : `T${h.t} M06`}</td>
                  <td style={celda}>
                    <button onClick={() => guardar(lista.filter((_, k) => k !== i))} disabled={bloqueado || lista.length <= 1} title="Quitar esta herramienta" style={{ ...entrada, cursor: 'pointer', background: '#fff' }}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {repetidas.size > 0 && <p style={{ margin: '4px 0 0', color: '#d93025', fontSize: '0.8rem' }}>Hay números T repetidos: la máquina usa la primera herramienta con ese número.</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <button onClick={agregar} disabled={bloqueado} style={{ ...botonSuave }} data-agregar-herramienta="si">
          + Agregar herramienta
        </button>
        {propias && (
          <button onClick={() => setConfig((c) => (torno ? { ...c, herramientasTorno: undefined } : { ...c, herramientasFresa: undefined }))} disabled={bloqueado} style={{ ...botonSuave }}>
            Volver a las de fábrica
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Herramientas propias: se pueden editar, agregar y quitar
// ---------------------------------------------------------------------------
const FORMAS_TORNO: Array<[FormaTorno, string]> = [
  ['izquierda', 'Cilindrar hacia el plato (Z−)'],
  ['derecha', 'Cilindrar hacia la cara (Z+)'],
  ['ranurado', 'Ranurado / tronzado'],
  ['roscado', 'Roscado'],
  ['broca', 'Broca (en el eje)'],
]
const FORMAS_FRESA: Array<[FormaFresa, string]> = [
  ['plana', 'Fresa plana'],
  ['bola', 'Fresa bola'],
  ['broca', 'Broca'],
  ['grabado', 'Grabado en V'],
]
