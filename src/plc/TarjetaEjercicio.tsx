/**
 * Tarjeta de un ejercicio para resolver: enunciado, esquema de conexiones,
 * circuito de instalación y el botón que prueba el programa del alumno.
 */
import { useEffect, useState } from 'react'
import type { ProgramaPLC } from './ladder'
import type { EjercicioPLC, ResultadoVerificacion } from './ejercicios'
import { formatear, type Notacion } from './notacion'

const TINTA = '#6b5a3a'

export default function TarjetaEjercicio({
  ejercicio,
  programa,
  notacion,
}: {
  ejercicio: EjercicioPLC
  programa: ProgramaPLC
  notacion: Notacion
}) {
  const [resultado, setResultado] = useState<ResultadoVerificacion | null>(null)
  const [abierta, setAbierta] = useState(true)
  // Si el programa cambia, el resultado anterior ya no vale.
  useEffect(() => setResultado(null), [programa])
  const celda: React.CSSProperties = { border: '1px solid #d7dde3', padding: '4px 8px', fontSize: '0.86rem' }
  return (
    <section
      style={{
        background: '#fffdf6',
        border: '1px solid #ecdcae',
        borderRadius: 10,
        padding: '0.9rem 1.2rem',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.02rem', color: '#5c4b1f' }}>📝 Ejercicio para resolver · {ejercicio.titulo}</h2>
        <button
          onClick={() => setResultado(ejercicio.verificar(programa))}
          style={{ border: 'none', background: '#12a35a', color: '#fff', borderRadius: 8, padding: '0.4rem 0.9rem', fontWeight: 700, cursor: 'pointer' }}
          title="Prueba tu programa contra la planta simulada, paso por paso"
        >
          ✓ Verificar mi programa
        </button>
        <button
          onClick={() => setAbierta((a) => !a)}
          style={{ marginLeft: 'auto', border: '1px solid #d9c690', background: '#fff', borderRadius: 6, padding: '0.2rem 0.6rem', cursor: 'pointer', color: '#5c4b1f' }}
        >
          {abierta ? 'Ocultar enunciado' : 'Ver enunciado'}
        </button>
      </div>
      {resultado && (
        <div
          role="status"
          style={{
            marginTop: 10,
            padding: '0.6rem 0.8rem',
            borderRadius: 8,
            background: resultado.ok ? '#e7f7ef' : '#fff4e5',
            border: `1px solid ${resultado.ok ? '#a9dcc4' : '#f0c98a'}`,
          }}
        >
          <strong style={{ color: resultado.ok ? '#0a6b3c' : '#8a5b00' }}>
            {resultado.ok ? '¡Tu programa cumple el enunciado completo!' : 'Todavía no: revisa lo que falla.'}
          </strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: '1.1rem', lineHeight: 1.55, fontSize: '0.88rem' }}>
            {resultado.mensajes.map((m, i) => (
              <li key={i} style={{ color: m.ok ? '#0a6b3c' : '#8a3b00' }}>
                {m.ok ? '✓' : '✗'} {m.texto}
              </li>
            ))}
          </ul>
        </div>
      )}
      {abierta && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 16, marginTop: 10 }}>
          <div>
            <ol style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.55, fontSize: '0.9rem', color: '#26323f' }}>
              {ejercicio.enunciado.map((t, i) => (
                <li key={i} style={{ marginBottom: 3 }}>
                  {t}
                </li>
              ))}
            </ol>
            <p style={{ margin: '10px 0 4px', fontWeight: 700, color: '#5c4b1f', fontSize: '0.9rem' }}>Qué tienes que hacer</p>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.5, fontSize: '0.88rem' }}>
              {ejercicio.consigna.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#5c4b1f', fontSize: '0.9rem' }}>Esquema de conexiones</p>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: '#f1ead6' }}>
                  <th style={celda}>Símbolo</th>
                  <th style={celda}>Circuito</th>
                  <th style={celda}>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {ejercicio.simbolos.map((s) => (
                  <tr key={s.dir}>
                    <td style={{ ...celda, textAlign: 'center', fontWeight: 700 }}>{s.nombre}</td>
                    <td style={{ ...celda, textAlign: 'center', fontFamily: 'ui-monospace, monospace' }}>{formatear(s.dir, notacion)}</td>
                    <td style={celda}>{s.descripcion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ejercicio.id === 'ejercicio2' && <CircuitoInstalacion notacion={notacion} />}
          </div>
        </div>
      )}
    </section>
  )
}

/** Circuito de instalación del ejercicio 2: cilindros, electroválvulas y PLC. */
function CircuitoInstalacion({ notacion }: { notacion: Notacion }) {
  const f = (d: string) => formatear(d, notacion)
  const linea = { stroke: TINTA, strokeWidth: 1.6, fill: 'none' }
  const cilindro = (x: number, nombre: string, sA: string, sB: string) => (
    <g>
      <rect x={x} y={34} width={130} height={36} fill="#e7e1cf" stroke={TINTA} strokeWidth={1.6} />
      <rect x={x + 12} y={34} width={10} height={36} fill="#d8cfb6" stroke={TINTA} strokeWidth={1.4} />
      <line x1={x + 22} y1={52} x2={x + 150} y2={52} stroke={TINTA} strokeWidth={3} />
      <text x={x - 6} y={57} textAnchor="end" fontSize={12} fontWeight={700} fill={TINTA}>{nombre}</text>
      <text x={x + 14} y={26} fontSize={11} fontWeight={700} fill={TINTA}>{sA}</text>
      <text x={x + 120} y={26} fontSize={11} fontWeight={700} fill={TINTA}>{sB}</text>
      {/* Puertos A (atrás) y B (adelante) bajan a la válvula. */}
      <path d={`M ${x + 8} 70 V 92 H ${x + 70} V 122`} {...linea} />
      <path d={`M ${x + 122} 70 V 122`} {...linea} />
    </g>
  )
  const valvula = (x: number, nombre: string) => (
    <g>
      <rect x={x + 40} y={122} width={100} height={34} fill="#e7e1cf" stroke={TINTA} strokeWidth={1.6} />
      <line x1={x + 90} y1={122} x2={x + 90} y2={156} stroke={TINTA} strokeWidth={1.4} />
      {/* Flechas simplificadas de la 5/2. */}
      <path d={`M ${x + 52} 150 L ${x + 62} 128 M ${x + 72} 128 L ${x + 82} 150 M ${x + 100} 150 L ${x + 110} 128 M ${x + 120} 128 L ${x + 130} 150`} stroke={TINTA} strokeWidth={1.3} />
      {/* Solenoide a la izquierda, muelle a la derecha. */}
      <rect x={x + 18} y={128} width={22} height={22} fill="#fff" stroke={TINTA} strokeWidth={1.4} />
      <line x1={x + 20} y1={148} x2={x + 38} y2={130} stroke={TINTA} strokeWidth={1.4} />
      <path d={`M ${x + 140} 139 l 5 -7 l 5 14 l 5 -14 l 5 14 l 5 -7`} {...linea} />
      <text x={x + 29} y={120} textAnchor="middle" fontSize={12} fontWeight={700} fill={TINTA}>{nombre}</text>
      <text x={x + 68} y={118} fontSize={10} fill={TINTA}>4</text>
      <text x={x + 118} y={118} fontSize={10} fill={TINTA}>2</text>
      <text x={x + 60} y={168} fontSize={10} fill={TINTA}>5  1  3</text>
    </g>
  )
  const entradas = ['I0.0', 'I0.1', 'I0.2', 'I0.3', 'I0.4']
  const sensores = ['S0', 'S1', 'S2', 'S3', 'S4']
  return (
    <svg viewBox="0 0 470 330" width="100%" style={{ maxWidth: 520, display: 'block', margin: '12px auto 0' }} role="img" aria-label="Circuito de instalación del ejercicio 2">
      <text x={235} y={12} textAnchor="middle" fontSize={11.5} fill="#5c4b1f" fontWeight={700}>Circuito de instalación</text>
      {cilindro(40, 'Z1', 'S1', 'S2')}
      {cilindro(270, 'Z2', 'S3', 'S4')}
      {valvula(10, 'Y1')}
      {valvula(240, 'Y2')}
      {/* PLC */}
      <rect x={300} y={196} width={140} height={128} fill="#fff" stroke={TINTA} strokeWidth={1.6} />
      <text x={370} y={190} textAnchor="middle" fontSize={12} fontWeight={700} fill={TINTA}>PLC</text>
      {[f('Q0.1'), f('Q0.0'), ...entradas.map(f), '+24', '0V'].map((t, i) => (
        <text key={t} x={308} y={212 + i * 14} fontSize={10.5} fontFamily="ui-monospace, monospace" fill={TINTA}>
          {t}
        </text>
      ))}
      {/* Y1 → Q0.0 y Y2 → Q0.1 */}
      <path d="M 39 139 H 20 V 222 H 300" {...linea} />
      <path d="M 269 139 H 250 V 180 H 230 V 208 H 300" {...linea} />
      {sensores.map((s, i) => (
        <g key={s}>
          <line x1={220} y1={236 + i * 14} x2={300} y2={236 + i * 14} {...linea} />
          <text x={214} y={240 + i * 14} textAnchor="end" fontSize={10.5} fontWeight={700} fill={TINTA}>{s}</text>
        </g>
      ))}
    </svg>
  )
}
