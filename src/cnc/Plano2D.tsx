/**
 * Vista 2D de la trayectoria, como el plano con la silueta y los puntos que
 * se dibuja en clases: en el torno el plano Z-X (X en radio hacia arriba,
 * reflejado abajo) y en la fresadora la vista desde arriba (X-Y).
 *
 * Muestra el bruto, la pieza tal como va quedando, la trayectoria (rápidos
 * en naranja discontinuo, cortes en azul) y cada punto programado con su
 * número de bloque; al pasar el mouse sobre un punto se ven sus coordenadas.
 */
import { useMemo } from 'react'
import type { PuntoPrograma, ResultadoGcode, Vec3 } from './gcode'
import type { ConfigCNC } from './maquinas'
import { PiezaFresa, PiezaTorno, type SimuladorCNC } from './simulador'

const fmt = (v: number) => (Math.round(v * 1000) / 1000).toString()

export function textoPunto(p: Vec3, torno: boolean): string {
  return torno ? `X${fmt(p.x)} Z${fmt(p.z)}` : `X${fmt(p.x)} Y${fmt(p.y)} Z${fmt(p.z)}`
}

export default function Plano2D({
  programa,
  sim,
  config,
  lineas,
  seleccionada,
  onElegirLinea,
}: {
  programa: ResultadoGcode
  sim: SimuladorCNC
  config: ConfigCNC
  lineas: string[]
  seleccionada: number | null
  onElegirLinea: (n: number) => void
}) {
  const torno = config.maquina === 'torno'
  // Coordenadas de dibujo: en el torno (Z, radio); en la fresadora (X, Y).
  const aPlano = (p: Vec3): [number, number] => (torno ? [p.z, p.x / 2] : [p.x, p.y])

  const caja = useMemo(() => {
    let x0: number, x1: number, y0: number, y1: number
    if (torno) {
      const b = config.torno
      x0 = b.sobremetal - b.largo
      x1 = b.sobremetal + 5
      y0 = -b.diametro / 2 - 4
      y1 = b.diametro / 2 + 4
    } else {
      x0 = -5
      x1 = config.fresa.largo + 5
      y0 = -5
      y1 = config.fresa.ancho + 5
    }
    // Incluye la trayectoria, pero sin irse hasta la posición de referencia.
    for (const p of programa.puntos) {
      const [a, b] = aPlano(p.pos)
      if (p.codigo === 'G28') continue
      x0 = Math.min(x0, a - 3)
      x1 = Math.max(x1, a + 3)
      y1 = Math.max(y1, b + 3)
      if (!torno) y0 = Math.min(y0, b - 3)
    }
    x0 = Math.max(x0, torno ? config.torno.sobremetal - config.torno.largo - 10 : -60)
    x1 = Math.min(x1, torno ? 80 : config.fresa.largo + 60)
    y1 = Math.min(y1, torno ? config.torno.diametro / 2 + 60 : config.fresa.ancho + 60)
    if (torno) y0 = -y1
    return { x0, x1, y0, y1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programa, config])

  const W = caja.x1 - caja.x0
  const H = caja.y1 - caja.y0
  // SVG con Y hacia arriba: se invierte con la transformación.
  const tx = (a: number) => a - caja.x0
  const ty = (b: number) => caja.y1 - b
  const escalaTexto = Math.max(W, H) / 70

  const trazos = useMemo(() => {
    const rap: string[] = []
    const cor: string[] = []
    for (const p of programa.pasos) {
      if (p.puntos.length < 2) continue
      const d = p.puntos
        .map((q, i) => {
          const [a, b] = aPlano(q)
          return `${i ? 'L' : 'M'}${tx(a).toFixed(2)},${ty(b).toFixed(2)}`
        })
        .join('')
      ;(p.tipo === 'rapido' ? rap : cor).push(d)
    }
    return { rap: rap.join(''), cor: cor.join('') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programa, caja])

  // Silueta de la pieza tal como va (torno) o mapa de profundidad (fresa).
  const pz = sim.pieza
  let silueta: JSX.Element | null = null
  if (pz instanceof PiezaTorno) {
    const arriba: string[] = []
    const abajo: string[] = []
    for (let i = 0; i < pz.n; i += 2) {
      const z = pz.zDe(i)
      arriba.push(`${tx(z).toFixed(2)},${ty(pz.ext[i]).toFixed(2)}`)
      abajo.push(`${tx(z).toFixed(2)},${ty(-pz.ext[i]).toFixed(2)}`)
    }
    const agujero: string[] = []
    const agujeroAbajo: string[] = []
    for (let i = 0; i < pz.n; i += 2) {
      const z = pz.zDe(i)
      agujero.push(`${tx(z).toFixed(2)},${ty(pz.int[i]).toFixed(2)}`)
      agujeroAbajo.push(`${tx(z).toFixed(2)},${ty(-pz.int[i]).toFixed(2)}`)
    }
    // La parte tronzada se dibuja donde estaba, más clara.
    let tronzada: JSX.Element | null = null
    if (pz.tronzada) {
      const t = pz.tronzada
      const a1: string[] = []
      const a2: string[] = []
      for (let i = 0; i < t.ext.length; i += 2) {
        const z = t.z0 + i * 0.1
        a1.push(`${tx(z).toFixed(2)},${ty(t.ext[i]).toFixed(2)}`)
        a2.push(`${tx(z).toFixed(2)},${ty(-t.ext[i]).toFixed(2)}`)
      }
      tronzada = (
        <polygon points={[...a1, ...a2.reverse()].join(' ')} fill="#f3e6bf" stroke="#9c7a24" strokeWidth={0.25} strokeDasharray="1 0.6">
          <title>Pieza tronzada (separada del material del plato)</title>
        </polygon>
      )
    }
    silueta = (
      <g>
        {tronzada}
        <polygon points={[...arriba, ...abajo.reverse()].join(' ')} fill="#e7cf8c" stroke="#9c7a24" strokeWidth={0.25} />
        <polygon points={[...agujero, ...agujeroAbajo.reverse()].join(' ')} fill="#fff" stroke="#9c7a24" strokeWidth={0.2} />
        {/* Garras */}
        {[1, -1].map((s) => (
          <rect
            key={s}
            x={tx(pz.z0)}
            y={s > 0 ? ty(config.torno.diametro / 2 + 10) : ty(-config.torno.diametro / 2)}
            width={config.torno.agarre}
            height={10}
            fill="#8e979f"
          />
        ))}
      </g>
    )
  } else if (pz instanceof PiezaFresa) {
    silueta = <MapaFresa pz={pz} x={tx(0)} y={ty(config.fresa.ancho)} />
  }

  const puntos = programa.puntos.filter((p) => p.codigo !== 'G28')
  const pos = aPlano(sim.pos)

  return (
    <div>
      <svg
        viewBox={`0 0 ${W.toFixed(2)} ${H.toFixed(2)}`}
        width="100%"
        style={{ maxHeight: 420, background: '#fbfcfd', border: '1px solid #e0e5eb', borderRadius: 8, display: 'block' }}
        role="img"
        aria-label={torno ? 'Plano Z-X de la trayectoria' : 'Vista superior X-Y de la trayectoria'}
        data-plano2d="si"
      >
        <Grilla caja={caja} tx={tx} ty={ty} esc={escalaTexto} torno={torno} />
        {silueta}
        <path d={trazos.rap} fill="none" stroke="#ff7a00" strokeWidth={escalaTexto * 0.18} strokeDasharray={`${escalaTexto * 0.8} ${escalaTexto * 0.6}`} />
        <path d={trazos.cor} fill="none" stroke="#1668c7" strokeWidth={escalaTexto * 0.22} />
        {puntos.map((p, k) => (
          <Punto
            key={k}
            p={p}
            a={tx(aPlano(p.pos)[0])}
            b={ty(aPlano(p.pos)[1])}
            r={escalaTexto * (seleccionada === p.linea ? 0.7 : 0.42)}
            activo={seleccionada === p.linea}
            texto={`${bloque(lineas[p.linea]) ?? `Línea ${p.linea + 1}`}: ${textoPunto(p.pos, torno)}`}
            onClick={() => onElegirLinea(p.linea)}
          />
        ))}
        <circle cx={tx(pos[0])} cy={ty(pos[1])} r={escalaTexto * 0.6} fill="none" stroke="#ff2d55" strokeWidth={escalaTexto * 0.25} />
      </svg>
      <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#5a6b7d' }}>
        <span style={{ color: '#ff7a00', fontWeight: 700 }}>- - -</span> rápido (G00) ·{' '}
        <span style={{ color: '#1668c7', fontWeight: 700 }}>——</span> corte (G01/G02/G03) · puntos: fin de cada bloque (pasa el
        mouse para ver sus coordenadas; clic para ir a la línea) ·{' '}
        {torno ? 'Z hacia la derecha, X (radio) hacia arriba; cero pieza en la cara, sobre el eje.' : 'X a la derecha, Y hacia arriba; cero pieza en la esquina delantera izquierda.'}
      </p>
    </div>
  )
}

function bloque(linea: string | undefined): string | null {
  const m = /^\s*N(\d+)/i.exec(linea ?? '')
  return m ? `N${m[1]}` : null
}

function Punto({ p, a, b, r, activo, texto, onClick }: { p: PuntoPrograma; a: number; b: number; r: number; activo: boolean; texto: string; onClick: () => void }) {
  return (
    <circle cx={a} cy={b} r={r} fill={activo ? '#ff2d55' : p.codigo === 'G00' ? '#ff7a00' : '#1668c7'} stroke="#fff" strokeWidth={r * 0.3} style={{ cursor: 'pointer' }} onClick={onClick}>
      <title>{texto}</title>
    </circle>
  )
}

function Grilla({
  caja,
  tx,
  ty,
  esc,
  torno,
}: {
  caja: { x0: number; x1: number; y0: number; y1: number }
  tx: (a: number) => number
  ty: (b: number) => number
  esc: number
  torno: boolean
}) {
  const span = Math.max(caja.x1 - caja.x0, caja.y1 - caja.y0)
  const paso = span > 200 ? 20 : span > 90 ? 10 : 5
  const lineas: JSX.Element[] = []
  for (let a = Math.ceil(caja.x0 / paso) * paso; a <= caja.x1; a += paso) {
    lineas.push(<line key={`v${a}`} x1={tx(a)} x2={tx(a)} y1={0} y2={ty(caja.y0)} stroke={a === 0 ? '#9aa6b2' : '#eef1f4'} strokeWidth={a === 0 ? esc * 0.12 : esc * 0.06} />)
    lineas.push(
      <text key={`tv${a}`} x={tx(a) + esc * 0.2} y={ty(caja.y0) - esc * 0.3} fontSize={esc * 0.9} fill="#8a97a5">
        {a}
      </text>,
    )
  }
  for (let b = Math.ceil(caja.y0 / paso) * paso; b <= caja.y1; b += paso) {
    lineas.push(<line key={`h${b}`} x1={0} x2={tx(caja.x1)} y1={ty(b)} y2={ty(b)} stroke={b === 0 ? '#9aa6b2' : '#eef1f4'} strokeWidth={b === 0 ? esc * 0.12 : esc * 0.06} strokeDasharray={b === 0 && torno ? `${esc} ${esc * 0.5}` : undefined} />)
    lineas.push(
      <text key={`th${b}`} x={esc * 0.3} y={ty(b) - esc * 0.25} fontSize={esc * 0.9} fill="#8a97a5">
        {torno ? `Ø${Math.abs(b * 2)}` : b}
      </text>,
    )
  }
  return (
    <g>
      {lineas}
      <text x={tx(caja.x1) - esc * 1.5} y={ty(0) - esc * 0.4} fontSize={esc * 1.1} fontWeight={700} fill="#33475c">
        {torno ? 'Z' : 'X'}
      </text>
      <text x={tx(0) + esc * 0.4} y={esc * 1.3} fontSize={esc * 1.1} fontWeight={700} fill="#33475c">
        {torno ? 'X' : 'Y'}
      </text>
    </g>
  )
}

/** Mapa de profundidad de la fresadora: más oscuro cuanto más hondo. */
function MapaFresa({ pz, x, y }: { pz: PiezaFresa; x: number; y: number }) {
  const url = useMemo(() => {
    if (typeof document === 'undefined') return ''
    const c = document.createElement('canvas')
    c.width = pz.nx
    c.height = pz.ny
    const g = c.getContext('2d')
    if (!g) return ''
    const img = g.createImageData(pz.nx, pz.ny)
    const H = pz.bruto.alto
    for (let j = 0; j < pz.ny; j++) {
      for (let i = 0; i < pz.nx; i++) {
        const h = pz.h[j * pz.nx + i]
        const f = h > -1e-4 ? 0 : Math.min(1, -h / H)
        const k = ((pz.ny - 1 - j) * pz.nx + i) * 4
        img.data[k] = 205 - 150 * f
        img.data[k + 1] = 213 - 140 * f
        img.data[k + 2] = 222 - 100 * f
        img.data[k + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
    return c.toDataURL()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pz, pz.version])
  return <image href={url} x={x} y={y} width={pz.bruto.largo} height={pz.bruto.ancho} preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} />
}
