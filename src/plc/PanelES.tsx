import { ENTRADAS, SALIDAS, areaDe, clonarPrograma, DIRECCIONES, type EstadoPLC, type ProgramaPLC } from './ladder'
import { type Mando } from './plantas'
import { formatear, type Notacion } from './notacion'
import { botonSuave } from './estilosPLC'

export type TipoLibre = 'interruptor' | 'NA' | 'NC'

/**
 * Simulador de E/S, como el de LogixPro: las 8 entradas y las 8 salidas del
 * PLC. Las entradas que usa la planta las mueve la planta (sus sensores) o sus
 * mandos; las demás quedan libres, con un interruptor o un pulsador NA / NC
 * para probar cualquier programa.
 */
export default function PanelES({
  mandos,
  simbolos,
  cableado,
  rotulos,
  estado,
  mandosActivos,
  pulsar,
  notacion,
  tiposLibres,
  onTipoLibre,
  forzados,
  onForzar,
  parte,
  editable,
  onSimbolo,
  onAgregar,
  onQuitar,
  onCambiarDir,
  ocultarPlanta,
}: {
  /** Sólo los mandos de la planta (bajo la vista 3D) o sólo la tabla de E/S. */
  parte: 'mandos' | 'tabla'
  mandos: Mando[]
  simbolos: ProgramaPLC['simbolos']
  cableado: string[]
  /** El rótulo de cada entrada y salida en la máquina (START, PROX, RUN…), si el alumno aún no le puso nombre. */
  rotulos: Record<string, string>
  estado: EstadoPLC
  mandosActivos: Record<string, boolean>
  pulsar: (dir: string, v: boolean) => void
  notacion: Notacion
  tiposLibres: Record<string, TipoLibre>
  onTipoLibre: (dir: string, tipo: TipoLibre) => void
  forzados: Record<string, boolean>
  onForzar: (dir: string, v: boolean | null) => void
  /** Se pueden editar el símbolo y la descripción (en STOP). */
  editable: boolean
  onSimbolo: (dir: string, campo: 'nombre' | 'descripcion', valor: string) => void
  /** Agrega una fila a la tabla de E/S (el alumno puso ahí un elemento de la máquina). */
  onAgregar: (dir: string) => void
  onQuitar: (dir: string) => void
  onCambiarDir: (antes: string, despues: string) => void
  /** En la tarea no se dice qué hay en cada dirección: el alumno lo identifica. */
  ocultarPlanta?: boolean
}) {
  /** Botón de forzado: sin forzar → forzar 1 → forzar 0 → sin forzar. */
  const forzar = (d: string) => {
    const f = forzados[d]
    const texto = f === undefined ? 'F' : f ? 'F1' : 'F0'
    return (
      <button
        onClick={() => onForzar(d, f === undefined ? true : f ? false : null)}
        title={f === undefined ? `Forzar ${formatear(d, notacion)} a 1 (y otra vez, a 0)` : `Forzada a ${f ? 1 : 0}: clic para ${f ? 'forzar a 0' : 'quitar el forzado'}`}
        data-forzar={d}
        style={{
          marginLeft: 'auto',
          border: `1px solid ${f === undefined ? '#c6ced6' : '#c62828'}`,
          background: f === undefined ? '#fff' : '#fdecea',
          color: f === undefined ? '#5f6b78' : '#c62828',
          borderRadius: 4,
          padding: '0 5px',
          minWidth: 28,
          minHeight: 26,
          fontSize: '0.72rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {texto}
      </button>
    )
  }
  const colores: Record<string, string> = { verde: '#0e7a43', rojo: '#c62828', negro: '#2b3036', amarillo: '#8a6500' }
  const nombre = (d: string) => simbolos.find((s) => s.dir === d)?.nombre || rotulos[d] || ''
  const fmt = (d: string) => formatear(d, notacion)
  const botonMando = (dir: string, texto: string, tipo: 'pulsador' | 'interruptor' | 'NC', color: string) => {
    const on = !!mandosActivos[dir]
    const pulsado = tipo === 'NC' ? !on : on
    return (
      <button
        key={dir}
        data-mando={dir}
        title={tipo === 'interruptor' ? `Cambia ${texto} (${fmt(dir)})` : `Mantén pulsado ${texto} (${fmt(dir)})`}
        style={{
          border: `2px solid ${color}`,
          background: pulsado ? color : '#fff',
          color: pulsado ? '#fff' : color,
          borderRadius: tipo === 'interruptor' ? 6 : 999,
          padding: '0.25rem 0.7rem',
          fontWeight: 700,
          cursor: 'pointer',
          userSelect: 'none',
          touchAction: 'none',
          fontSize: '0.82rem',
        }}
        onPointerDown={(e) => {
          if (tipo === 'interruptor') {
            pulsar(dir, !on)
            return
          }
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* puntero sintético */
          }
          pulsar(dir, tipo !== 'NC')
        }}
        onPointerUp={() => tipo !== 'interruptor' && pulsar(dir, tipo === 'NC')}
        onPointerCancel={() => tipo !== 'interruptor' && pulsar(dir, tipo === 'NC')}
      >
        {tipo === 'interruptor' ? (on ? '◉ ' : '○ ') : '● '}
        {texto}
      </button>
    )
  }
  const led = (d: string) => {
    const on = !!estado.bits[d]
    const esEntrada = d.startsWith('I')
    const color = esEntrada ? '#2ee06d' : '#ffa726'
    return (
      <span
        style={{
          width: 11,
          height: 11,
          borderRadius: 999,
          background: on ? color : '#c9ced4',
          boxShadow: on ? `0 0 6px ${color}` : 'none',
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
    )
  }
  /** Símbolo y descripción de la dirección, escritos ahí mismo, y debajo qué hay conectado en la planta. */
  const nombrar = (d: string, origen: React.ReactNode) => {
    const s = simbolos.find((x) => x.dir === d)
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
        <div className="campos-es">
          <input
            value={s?.nombre ?? ''}
            disabled={!editable}
            placeholder="Símbolo"
            aria-label={`Símbolo de ${fmt(d)}`}
            data-simbolo={d}
            onChange={(e) => onSimbolo(d, 'nombre', e.target.value)}
            className="campos-es__simbolo"
            style={{ ...campoES, fontWeight: 700 }}
          />
          <input
            value={s?.descripcion ?? ''}
            disabled={!editable}
            placeholder="Descripción"
            aria-label={`Descripción de ${fmt(d)}`}
            onChange={(e) => onSimbolo(d, 'descripcion', e.target.value)}
            style={{ ...campoES, flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        {origen && <span style={{ color: '#5f6b78', fontSize: '0.74rem', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{origen}</span>}
      </div>
    )
  }
  // Tabla de E/S que arma el alumno: agrega filas y elige la dirección de cada una.
  const orden = (d: string) => DIRECCIONES.indexOf(d)
  const enTabla = simbolos
    .map((x) => x.dir)
    .filter((d) => ['I', 'Q'].includes(areaDe(d) ?? ''))
    .sort((a, b) => orden(a) - orden(b))
  if (parte === 'mandos')
    return mandos.length > 0 ? (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: '#51606f' }}>Mandos de la planta:</span>
        {mandos.map((m) => botonMando(m.dir, m.nombre, m.tipo, colores[m.color]))}
      </div>
    ) : null
  return (
    <div>
      {Object.keys(forzados).length > 0 && (
        <p style={{ margin: '0 0 8px', padding: '4px 8px', background: '#fdecea', border: '1px solid #f1b0ab', borderRadius: 6, color: '#8e1c1c', fontSize: '0.8rem' }} data-aviso-forzado="si">
          ⚠ Hay E/S forzadas ({Object.entries(forzados).map(([d, v]) => `${formatear(d, notacion)}=${v ? 1 : 0}`).join(', ')}): valen eso sin importar el programa ni la planta. Úsalo sólo para probar y quítalo después.{' '}
          <button onClick={() => Object.keys(forzados).forEach((d) => onForzar(d, null))} style={{ border: '1px solid #c62828', background: '#fff', color: '#c62828', borderRadius: 4, cursor: 'pointer', fontSize: '0.76rem' }}>
            Quitar todos
          </button>
        </p>
      )}
      <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#51606f' }}>
        Identifica los elementos de la máquina: los que el PLC lee van en <strong>Entradas</strong> y los que acciona, en <strong>Salidas</strong>. Agrega una
        fila por elemento, elige su dirección y escribe su símbolo y su descripción: esos nombres aparecen en tu diagrama Ladder.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        {(['I', 'Q'] as const).map((zona) => {
          const todas = zona === 'I' ? ENTRADAS : SALIDAS
          const filas = enTabla.filter((d) => areaDe(d) === zona)
          const libres = todas.filter((d) => !enTabla.includes(d))
          return (
            <div key={zona} data-zona-es={zona}>
              <p style={subRotulo}>{zona === 'I' ? 'Entradas' : 'Salidas'}</p>
              {filas.length === 0 && <p style={{ margin: '2px 0 6px', fontSize: '0.78rem', color: '#5f6b78' }}>Todavía no agregas {zona === 'I' ? 'entradas' : 'salidas'}.</p>}
              {filas.map((d) => {
                const libre = !cableado.includes(d)
                const tipo = tiposLibres[d] ?? 'interruptor'
                return (
                  <div key={d} style={filaES} data-es={d} data-valor={estado.bits[d] ? 1 : 0}>
                    {led(d)}
                    <select
                      value={d}
                      disabled={!editable}
                      aria-label={`Dirección de la fila ${fmt(d)}`}
                      data-direccion-es={d}
                      onChange={(e) => onCambiarDir(d, e.target.value)}
                      style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.82rem', padding: '0.1rem', minWidth: 64 }}
                    >
                      {[d, ...libres].sort((a, b) => orden(a) - orden(b)).map((x) => (
                        <option key={x} value={x}>
                          {fmt(x)}
                        </option>
                      ))}
                    </select>
                    {nombrar(
                      d,
                      ocultarPlanta ? null : libre ? (
                        zona === 'I' ? (
                          <>
                            libre, para probar:
                            {botonMando(d, nombre(d) || 'libre', tipo === 'interruptor' ? 'interruptor' : tipo === 'NC' ? 'NC' : 'pulsador', '#1d5ea8')}
                            <select
                              value={tipo}
                              title="Qué elemento hay en esta entrada libre"
                              onChange={(e) => onTipoLibre(d, e.target.value as TipoLibre)}
                              style={{ fontSize: '0.76rem', padding: '0.1rem' }}
                            >
                              <option value="interruptor">interruptor</option>
                              <option value="NA">pulsador NA</option>
                              <option value="NC">pulsador NC</option>
                            </select>
                          </>
                        ) : (
                          'libre (sin nada conectado)'
                        )
                      ) : (
                        <span>
                          En la máquina: <strong>{rotulos[d]}</strong>
                        </span>
                      ),
                    )}
                    {forzar(d)}
                    {editable && (
                      <button
                        onClick={() => onQuitar(d)}
                        title="Quitar esta fila"
                        aria-label={`Quitar ${fmt(d)} de la tabla`}
                        style={{ border: 'none', background: 'transparent', color: '#8a4a45', cursor: 'pointer', padding: '0 4px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )
              })}
              {editable && libres.length > 0 && (
                <button onClick={() => onAgregar(libres[0])} data-agregar-es={zona} style={{ ...botonAgregarES, marginTop: 6 }}>
                  ＋ Agregar {zona === 'I' ? 'entrada' : 'salida'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const subRotulo: React.CSSProperties = { margin: '0 0 4px', fontSize: '0.8rem', color: '#5a6b7d', fontWeight: 700 }
const filaES: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#33475c', minHeight: 28, padding: '3px 0', borderBottom: '1px solid #eef1f4' }
const botonAgregarES: React.CSSProperties = { border: '1px dashed #1668c7', background: '#fff', color: '#1668c7', borderRadius: 6, padding: '0.3rem 0.7rem', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }
const campoES: React.CSSProperties = { padding: '0.2rem 0.35rem', border: '1px solid #d7dde3', borderRadius: 4, fontSize: '0.84rem', fontFamily: 'inherit' }

export function TablaSimbolos({
  programa,
  onCambiar,
  editable,
  notacion,
}: {
  programa: ProgramaPLC
  onCambiar: (p: ProgramaPLC) => void
  editable: boolean
  notacion: Notacion
}) {
  const cambiar = (m: (p: ProgramaPLC) => void) => {
    const p = clonarPrograma(programa)
    m(p)
    onCambiar(p)
  }
  const orden = (d: string) => DIRECCIONES.indexOf(d)
  // Las entradas y salidas se nombran en su propia fila, arriba: aquí van las marcas y demás.
  const filas = programa.simbolos
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !['I', 'Q'].includes(areaDe(s.dir) ?? ''))
    .sort((a, b) => orden(a.s.dir) - orden(b.s.dir))
  const celda: React.CSSProperties = { borderBottom: '1px solid #e0e5eb', padding: '3px 6px' }
  const campo: React.CSSProperties = { width: '100%', padding: '0.2rem 0.3rem', border: '1px solid #d7dde3', borderRadius: 4, fontSize: '0.86rem' }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.88rem' }}>
        <thead>
          <tr style={{ background: '#1d5ea8', color: '#fff', textAlign: 'left' }}>
            <th style={{ padding: '5px 6px', width: '22%' }}>Simbología</th>
            <th style={{ padding: '5px 6px', width: '18%' }}>Asignación</th>
            <th style={{ padding: '5px 6px' }}>Descripción</th>
            {editable && <th style={{ width: 28 }} />}
          </tr>
        </thead>
        <tbody>
          {filas.map(({ s, i }) => (
            <tr key={i}>
              <td style={celda}>
                <input
                  style={{ ...campo, fontWeight: 700 }}
                  disabled={!editable}
                  value={s.nombre}
                  onChange={(e) => cambiar((p) => (p.simbolos[i].nombre = e.target.value))}
                />
              </td>
              <td style={celda}>
                <select
                  style={campo}
                  disabled={!editable}
                  value={s.dir}
                  onChange={(e) => cambiar((p) => (p.simbolos[i].dir = e.target.value))}
                >
                  {DIRECCIONES.filter((d) => !['I', 'Q'].includes(areaDe(d) ?? '')).map((d) => (
                    <option key={d} value={d}>
                      {formatear(d, notacion)}
                    </option>
                  ))}
                </select>
              </td>
              <td style={celda}>
                <input
                  style={campo}
                  disabled={!editable}
                  value={s.descripcion}
                  onChange={(e) => cambiar((p) => (p.simbolos[i].descripcion = e.target.value))}
                />
              </td>
              {editable && (
                <td style={celda}>
                  <button
                    title="Quitar este símbolo"
                    onClick={() => cambiar((p) => p.simbolos.splice(i, 1))}
                    style={{ border: 'none', background: 'transparent', color: '#8a4a45', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <button
          onClick={() =>
            cambiar((p) => {
              const libre = ['M0.0', ...DIRECCIONES].find((d) => areaDe(d) === 'M' && !p.simbolos.some((s) => s.dir === d)) ?? 'M0.0'
              p.simbolos.push({ dir: libre, nombre: '', descripcion: '' })
            })
          }
          style={{ ...botonSuave, marginTop: 6 }}
        >
          ＋ Añadir símbolo
        </button>
      )}
      <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#5a6b7d' }}>
        Si usas marcas (por ejemplo una memoria de marcha), añádelas aquí con su símbolo y descripción.
      </p>
    </div>
  )
}
