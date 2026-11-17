/**
 * Figuras animadas de Estudiar. El movimiento es SMIL dentro del SVG:
 * pausar llama a pauseAnimations y, si el sistema pide menos movimiento,
 * arrancan ya detenidas en el primer fotograma.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

const TINTA = '#33475c'
const NARANJA = '#f06a14'
const HOMBRO = '#d85a0e'
const VERDE = '#0e7a43'
const AZUL = '#1668c7'

function menosMovimiento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function FiguraSvg({
  viewBox,
  etiqueta,
  ariaLabel,
  children,
}: {
  viewBox: string
  etiqueta: string
  ariaLabel: string
  children: ReactNode
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [pausa, setPausa] = useState(menosMovimiento)
  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    // El reloj SMIL queda quieto en algunas vistas embebidas. Se pausa y se
    // adelanta a mano, así Pausar deja el fotograma donde está.
    svg.pauseAnimations()
    if (pausa) return
    let cuadro = 0
    const origen = performance.now() - svg.getCurrentTime() * 1000
    const tick = (ahora: number) => {
      svg.setCurrentTime((ahora - origen) / 1000)
      cuadro = requestAnimationFrame(tick)
    }
    cuadro = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(cuadro)
  }, [pausa])
  return (
    <figure style={{ margin: '0 0 12px' }}>
      <svg ref={ref} viewBox={viewBox} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block', maxWidth: 680, margin: '0 auto', background: '#f7f9fb', border: '1px solid #e0e5eb', borderRadius: 8 }}>
        {children}
      </svg>
      <figcaption style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 6 }}>
        <button
          type="button"
          onClick={() => setPausa((v) => !v)}
          style={{ flex: 'none', border: '1px solid var(--borde)', background: '#fff', color: TINTA, fontWeight: 650, borderRadius: 8, padding: '0.25rem 0.7rem', cursor: 'pointer', fontSize: '0.82rem' }}
        >
          {pausa ? 'Reanudar' : 'Pausar'}
        </button>
        <span style={{ fontSize: '0.86rem', lineHeight: 1.45, color: 'var(--tinta-oscura)' }}>{etiqueta}</span>
      </figcaption>
    </figure>
  )
}

function fase(texto: string, x: number, y: number, tiempos: string, opacidades: string) {
  return (
    <text x={x} y={y} fill={TINTA} fontSize={14} fontWeight={700} opacity={opacidades.startsWith('1') ? 1 : 0}>
      {texto}
      <animate attributeName="opacity" values={opacidades} keyTimes={tiempos} dur="12s" repeatCount="indefinite" />
    </text>
  )
}

/** A2, A3 y A5 se mueven de a uno. Al final el brazo queda estirado y A4 y A6 giran al revés, sin mover la herramienta. */
export function FiguraGrados() {
  return (
    <FiguraSvg viewBox="0 0 680 250" ariaLabel="Un brazo de seis ejes mueve el hombro, el codo y la muñeca, y después muestra una singularidad" etiqueta="A1, A2 y A3 ponen la muñeca en un punto. A4, A5 y A6 orientan la herramienta. Con A5 en 0° los anillos de A4 y A6 giran y la herramienta no cambia: eso es una singularidad.">
      <rect x={40} y={188} width={130} height={16} rx={4} fill="#2b3036" />
      <rect x={88} y={140} width={24} height={52} rx={6} fill={NARANJA} />
      <g transform="translate(100 138)">
        <g>
          <animateTransform attributeName="transform" type="rotate" values="8;-28;-28;8;8" keyTimes="0;0.16;0.5;0.66;1" dur="12s" repeatCount="indefinite" />
          <rect x={0} y={-11} width={90} height={22} rx={11} fill={NARANJA} />
          <circle r={14} fill={HOMBRO} />
          <text x={-4} y={4} fill="#fff" fontSize={11} fontWeight={700}>2</text>
          <g transform="translate(90 0)">
            <g>
              <animateTransform attributeName="transform" type="rotate" values="20;20;64;64;0;0" keyTimes="0;0.16;0.34;0.5;0.66;1" dur="12s" repeatCount="indefinite" />
              <rect x={0} y={-8} width={74} height={16} rx={8} fill={NARANJA} />
              <circle r={11} fill={HOMBRO} />
              <text x={-4} y={4} fill="#fff" fontSize={11} fontWeight={700}>3</text>
              <g transform="translate(74 0)">
                <g>
                  <animateTransform attributeName="transform" type="rotate" values="0;0;0;-48;0;0" keyTimes="0;0.34;0.4;0.52;0.66;1" dur="12s" repeatCount="indefinite" />
                  <rect x={0} y={-5} width={30} height={10} rx={2} fill="#5c656e" />
                  <circle r={8} fill={HOMBRO} />
                  <text x={-3} y={3} fill="#fff" fontSize={10} fontWeight={700}>5</text>
                  <g>
                    <animateTransform attributeName="transform" type="rotate" values="0;0;340" keyTimes="0;0.66;1" dur="12s" repeatCount="indefinite" />
                    <circle r={16} fill="none" stroke={AZUL} strokeWidth={2} />
                    <line x1={0} y1={-16} x2={0} y2={-10} stroke={AZUL} strokeWidth={2} />
                  </g>
                  <g>
                    <animateTransform attributeName="transform" type="rotate" values="0;0;-340" keyTimes="0;0.66;1" dur="12s" repeatCount="indefinite" />
                    <circle r={7} fill="none" stroke="#c45c26" strokeWidth={2} />
                    <line x1={7} y1={0} x2={3} y2={0} stroke="#c45c26" strokeWidth={2} />
                  </g>
                  <rect x={30} y={-3} width={22} height={6} rx={1} fill="#2b3036" />
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
      {fase('A2 gira el hombro', 340, 78, '0;0.16;0.2;1', '1;1;0;0')}
      {fase('A3 dobla el codo', 340, 108, '0;0.16;0.2;0.34;0.38;1', '0;0;1;1;0;0')}
      {fase('A5 inclina la herramienta', 340, 138, '0;0.38;0.42;0.52;0.56;1', '0;0;1;1;0;0')}
      {fase('El brazo queda estirado', 340, 168, '0;0.54;0.58;0.64;0.68;1', '0;0;1;1;0;0')}
      {fase('Singularidad: A4 y A6 giran', 340, 198, '0;0.66;0.7;1', '0;0;1;1')}
      <text x={340} y={40} fill={TINTA} fontSize={13} fontWeight={700}>Qué eje se mueve</text>
      <text x={340} y={228} fill="#51606f" fontSize={12}>El anillo azul es A4 y el naranjo es A6.</text>
    </FiguraSvg>
  )
}

/** El arco es el alcance hasta la muñeca. La herramienta sigue más allá. */
export function FiguraAlcance() {
  return (
    <FiguraSvg viewBox="0 0 640 250" ariaLabel="Un brazo barre su alcance. Un punto queda dentro del arco y otro fuera. La herramienta pasa el arco." etiqueta="El arco es el alcance de la ficha: llega hasta el centro de la muñeca. La herramienta sigue de largo, así que un punto que parece dentro puede no alcanzarse. La simulación es la que lo decide.">
      <rect x={48} y={198} width={84} height={14} rx={3} fill="#2b3036" />
      <rect x={80} y={170} width={20} height={32} rx={4} fill={NARANJA} />
      <path d="M 167 94 A 120 120 0 0 1 206 217" fill="none" stroke={AZUL} strokeWidth={1.5} strokeDasharray="5 4" />
      <circle cx={158} cy={168} r={5} fill={VERDE} />
      <text x={168} y={164} fill={VERDE} fontSize={12} fontWeight={700}>dentro</text>
      <circle cx={520} cy={150} r={5} fill="#a15c00" />
      <text x={448} y={172} fill="#a15c00" fontSize={12} fontWeight={700}>fuera de alcance</text>
      <g transform="translate(90 186)">
        <g>
          <animateTransform attributeName="transform" type="rotate" values="-50;15;-50" keyTimes="0;0.5;1" dur="6s" repeatCount="indefinite" />
          <line x1={0} y1={0} x2={120} y2={0} stroke={NARANJA} strokeWidth={16} strokeLinecap="round" />
          <circle r={8} fill={HOMBRO} />
          <circle cx={120} cy={0} r={5} fill={AZUL} />
          <rect x={120} y={-3} width={42} height={6} rx={1} fill="#2b3036" />
        </g>
      </g>
      <text x={300} y={36} fill={TINTA} fontSize={13} fontWeight={700}>Alcance hasta la muñeca</text>
      <text x={300} y={56} fill="#51606f" fontSize={12}>El punto azul es el centro de la muñeca.</text>
      <text x={300} y={74} fill="#51606f" fontSize={12}>La barra negra es la herramienta.</text>
    </FiguraSvg>
  )
}

const INICIO = 'M 70 150'
const FIN = '300 150'

/** PTP, LIN y CIR salen y llegan al mismo sitio, con recorridos distintos. */
export function FiguraMovimientos() {
  const lin = `${INICIO} L ${FIN}`
  const cir = `${INICIO} Q 185 -40 ${FIN}`
  const ptp = `${INICIO} Q 185 200 ${FIN}`
  return (
    <FiguraSvg viewBox="0 0 640 230" ariaLabel="Tres recorridos entre los mismos dos puntos: PTP se curva, LIN va recto y CIR pasa por un punto auxiliar" etiqueta="Los tres salen del mismo punto y llegan al mismo. PTP no va en línea recta: sirve para acercarse y alejarse en el aire. LIN corta en recta. CIR corta en arco y necesita un punto auxiliar.">
      <path d={ptp} fill="none" stroke={NARANJA} strokeWidth={2} />
      <path d={lin} fill="none" stroke={VERDE} strokeWidth={2} />
      <path d={cir} fill="none" stroke={AZUL} strokeWidth={2} />
      <circle cx={185} cy={55} r={4} fill={AZUL} />
      <text x={196} y={50} fill={AZUL} fontSize={12} fontWeight={700}>punto auxiliar</text>
      <circle r={6} fill={VERDE}><animateMotion dur="4.5s" repeatCount="indefinite" path={lin} /></circle>
      <circle r={6} fill={AZUL}><animateMotion dur="4.5s" repeatCount="indefinite" path={cir} /></circle>
      <circle r={6} fill={NARANJA}><animateMotion dur="4.5s" repeatCount="indefinite" path={ptp} /></circle>
      <circle cx={70} cy={150} r={4} fill={TINTA} />
      <circle cx={300} cy={150} r={4} fill={TINTA} />
      <text x={48} y={170} fill={TINTA} fontSize={12} fontWeight={700}>inicio</text>
      <text x={286} y={170} fill={TINTA} fontSize={12} fontWeight={700}>fin</text>
      <text x={360} y={70} fill={NARANJA} fontSize={14} fontWeight={700}>PTP</text>
      <text x={360} y={92} fill="#51606f" fontSize={12}>el camino lo arman los ejes</text>
      <text x={360} y={122} fill={VERDE} fontSize={14} fontWeight={700}>LIN</text>
      <text x={360} y={144} fill="#51606f" fontSize={12}>recta de la herramienta</text>
      <text x={360} y={174} fill={AZUL} fontSize={14} fontWeight={700}>CIR</text>
      <text x={360} y={196} fill="#51606f" fontSize={12}>arco por un punto auxiliar</text>
    </FiguraSvg>
  )
}
