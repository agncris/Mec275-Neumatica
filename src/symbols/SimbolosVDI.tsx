/**
 * Simbología VDI 2860 (funciones de manipulación), dibujada en SVG.
 *
 * Los 24 símbolos se construyen sobre tres marcos: cuadrado (manipular),
 * círculo (fabricar) y triángulo invertido (controlar). Todos comparten el
 * mismo lienzo 100×100 para que se puedan alinear en tablas.
 */

const T = {
  stroke: '#14181d',
  strokeWidth: 2.4,
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}
const FINO = { ...T, strokeWidth: 1.7 }

export interface FuncionVDI {
  n: number
  nombre: string
  /** Familia: manipular (cuadrado), fabricar (círculo) o controlar (triángulo). */
  familia: 'manipular' | 'fabricar' | 'controlar'
}

export const FUNCIONES_VDI: FuncionVDI[] = [
  { n: 1, nombre: 'Manipular (símbolo básico)', familia: 'manipular' },
  { n: 2, nombre: 'Almacenamiento ordenado', familia: 'manipular' },
  { n: 3, nombre: 'Almacenamiento sin orden definido', familia: 'manipular' },
  { n: 4, nombre: 'Almacenamiento parcialmente ordenado (apilar)', familia: 'manipular' },
  { n: 5, nombre: 'Bifurcar', familia: 'manipular' },
  { n: 6, nombre: 'Unir', familia: 'manipular' },
  { n: 7, nombre: 'Fijar', familia: 'manipular' },
  { n: 8, nombre: 'Soltar', familia: 'manipular' },
  { n: 9, nombre: 'Sujetar (sin aplicación de fuerza)', familia: 'manipular' },
  { n: 10, nombre: 'Girar', familia: 'manipular' },
  { n: 11, nombre: 'Bascular', familia: 'manipular' },
  { n: 12, nombre: 'Asignar (n cantidad de piezas)', familia: 'manipular' },
  { n: 13, nombre: 'Posicionar', familia: 'manipular' },
  { n: 14, nombre: 'Desplazar', familia: 'manipular' },
  { n: 15, nombre: 'Ordenar', familia: 'manipular' },
  { n: 16, nombre: 'Entregar', familia: 'manipular' },
  { n: 17, nombre: 'Guiar (manteniendo la orientación de la pieza)', familia: 'manipular' },
  { n: 18, nombre: 'Verificar', familia: 'manipular' },
  { n: 19, nombre: 'Método de fabricación (símbolo básico)', familia: 'fabricar' },
  { n: 20, nombre: 'Modificar la forma (deformar, separar)', familia: 'fabricar' },
  { n: 21, nombre: 'Procesar (aplicar capas, modificar propiedades)', familia: 'fabricar' },
  { n: 22, nombre: 'Juntar (montar)', familia: 'fabricar' },
  { n: 23, nombre: 'Dar forma (formas originales)', familia: 'fabricar' },
  { n: 24, nombre: 'Controlar (símbolo básico)', familia: 'controlar' },
]

const Cuadro = () => <rect x={12} y={12} width={76} height={76} {...T} />
const Rombo = () => <polygon points="50,12 88,50 50,88 12,50" {...FINO} />

/** Barra negra de agarre, con su soporte en corchete. */
const Mordaza = () => (
  <>
    <path d="M26,40 L22,40 L22,60 L26,60" {...FINO} />
    <path d="M74,40 L78,40 L78,60 L74,60" {...FINO} />
    <rect x={26} y={44} width={48} height={12} fill="#14181d" />
  </>
)

const Punta = ({ x, y, a }: { x: number; y: number; a: number }) => (
  <polygon points="0,0 -13,-6 -13,6" transform={`translate(${x} ${y}) rotate(${a})`} fill="#14181d" />
)

/** Hexágono inscrito, con vértices a izquierda y derecha. */
const hexagono = (r: number) =>
  [0, 60, 120, 180, 240, 300]
    .map((g) => {
      const rad = (g * Math.PI) / 180
      return `${(50 + r * Math.cos(rad)).toFixed(1)},${(50 + r * Math.sin(rad)).toFixed(1)}`
    })
    .join(' ')

/** Símbolo VDI 2860 nº `n`. Con `grupo`, sólo el dibujo (0–100) para meterlo en otro SVG. */
export function SimboloVDI({ n, grupo = false }: { n: number; grupo?: boolean }) {
  const contenido = () => {
    switch (n) {
      case 1:
        return <Cuadro />
      case 2:
        return (
          <>
            <Cuadro />
            <Rombo />
            {[38, 45, 52, 59, 66].map((y, i) => (
              <line key={i} x1={26} y1={y} x2={74} y2={y} {...FINO} />
            ))}
          </>
        )
      case 3:
        return (
          <>
            <Cuadro />
            <Rombo />
            {[
              [26, 34, 46, 30], [52, 30, 72, 38], [24, 46, 44, 42],
              [50, 44, 70, 50], [28, 58, 48, 62], [52, 62, 72, 56],
            ].map(([x1, y1, x2, y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} {...FINO} />
            ))}
          </>
        )
      case 4:
        return (
          <>
            <Cuadro />
            <Rombo />
            {[36, 43, 50].map((y, i) => (
              <line key={i} x1={26} y1={y} x2={74} y2={y} {...FINO} />
            ))}
            {[58, 65].map((y, i) => (
              <line key={`c${i}`} x1={26} y1={y} x2={56} y2={y} {...FINO} />
            ))}
          </>
        )
      case 5: // bifurcar
        return (
          <>
            <Cuadro />
            <line x1={20} y1={50} x2={48} y2={50} {...FINO} />
            <Punta x={54} y={50} a={0} />
            <line x1={54} y1={48} x2={76} y2={28} {...FINO} />
            <Punta x={79} y={25} a={-42} />
            <line x1={54} y1={52} x2={76} y2={72} {...FINO} />
            <Punta x={79} y={75} a={42} />
          </>
        )
      case 6: // unir
        return (
          <>
            <Cuadro />
            <line x1={22} y1={26} x2={46} y2={46} {...FINO} />
            <line x1={22} y1={74} x2={46} y2={54} {...FINO} />
            <Punta x={56} y={50} a={0} />
            <line x1={56} y1={50} x2={80} y2={50} {...FINO} />
          </>
        )
      case 7: // fijar: la fuerza entra
        return (
          <>
            <Cuadro />
            <Mordaza />
            <line x1={50} y1={20} x2={50} y2={38} {...FINO} />
            <Punta x={50} y={42} a={90} />
            <line x1={50} y1={80} x2={50} y2={62} {...FINO} />
            <Punta x={50} y={58} a={-90} />
          </>
        )
      case 8: // soltar: la fuerza sale
        return (
          <>
            <Cuadro />
            <Mordaza />
            <line x1={50} y1={40} x2={50} y2={24} {...FINO} />
            <Punta x={50} y={20} a={-90} />
            <line x1={50} y1={60} x2={50} y2={76} {...FINO} />
            <Punta x={50} y={80} a={90} />
          </>
        )
      case 9: // sujetar sin fuerza
        return (
          <>
            <Cuadro />
            <Mordaza />
          </>
        )
      case 10: // girar
        return (
          <>
            <Cuadro />
            <path d="M62,66 A22,22 0 1 1 66,36" {...T} strokeWidth={2} />
            <Punta x={68} y={32} a={-55} />
            <line x1={62} y1={66} x2={70} y2={66} {...FINO} />
          </>
        )
      case 11: // bascular
        return (
          <>
            <Cuadro />
            <path d="M30,74 A44,44 0 0 1 70,32" {...T} strokeWidth={2} />
            <Punta x={74} y={31} a={-12} />
            <line x1={24} y1={74} x2={36} y2={74} {...FINO} />
            <line x1={78} y1={24} x2={78} y2={38} {...FINO} />
          </>
        )
      case 12: // asignar
        return (
          <>
            <Cuadro />
            {[28, 35, 42].map((y, i) => (
              <line key={i} x1={22} y1={y} x2={78} y2={y} {...FINO} />
            ))}
            <line x1={18} y1={50} x2={82} y2={50} {...FINO} />
            <path d="M26,74 L26,60 L40,60 L40,74" {...FINO} />
            <line x1={50} y1={62} x2={70} y2={62} {...FINO} />
            <line x1={50} y1={70} x2={70} y2={70} {...FINO} />
          </>
        )
      case 13: // posicionar
        return (
          <>
            <Cuadro />
            <line x1={20} y1={50} x2={56} y2={50} {...FINO} />
            <Punta x={62} y={50} a={0} />
            <line x1={72} y1={40} x2={72} y2={60} {...FINO} />
          </>
        )
      case 14: // desplazar
        return (
          <>
            <Cuadro />
            <line x1={22} y1={40} x2={22} y2={60} {...FINO} />
            <line x1={22} y1={50} x2={54} y2={50} {...FINO} />
            <Punta x={60} y={50} a={0} />
            <line x1={72} y1={40} x2={72} y2={60} {...FINO} />
          </>
        )
      case 15: // ordenar
        return (
          <>
            <Cuadro />
            <path d="M20,70 A24,24 0 1 1 60,52" {...T} strokeWidth={2} />
            <Punta x={60} y={58} a={90} />
            <line x1={66} y1={44} x2={66} y2={74} {...FINO} />
            {[48, 58, 68].map((y, i) => (
              <line key={i} x1={66} y1={y} x2={84} y2={y} {...FINO} />
            ))}
          </>
        )
      case 16: // entregar
        return (
          <>
            <Cuadro />
            <path d="M26,72 C40,64 44,50 62,40" {...T} strokeWidth={2} />
            <line x1={20} y1={78} x2={30} y2={68} {...FINO} />
            <Punta x={68} y={36} a={-32} />
            <line x1={66} y1={26} x2={74} y2={40} {...FINO} />
          </>
        )
      case 17: // guiar
        return (
          <>
            <Cuadro />
            <path d="M26,72 C40,64 44,50 62,40" {...T} strokeWidth={2} />
            <path d="M32,62 C42,56 46,48 58,42" {...FINO} />
            <path d="M34,52 C44,48 48,42 58,36" {...FINO} />
            <line x1={20} y1={78} x2={30} y2={68} {...FINO} />
            <Punta x={68} y={36} a={-32} />
            <line x1={66} y1={26} x2={74} y2={40} {...FINO} />
          </>
        )
      case 18: // verificar
        return (
          <>
            <Cuadro />
            <line x1={14} y1={14} x2={62} y2={86} {...FINO} />
            <line x1={86} y1={14} x2={62} y2={86} {...FINO} />
            <rect x={22} y={80} width={34} height={7} fill="#14181d" />
          </>
        )
      case 19:
        return <circle cx={50} cy={50} r={38} {...T} />
      case 20:
        return (
          <>
            <circle cx={50} cy={50} r={38} {...T} />
            <polygon points={hexagono(36)} {...FINO} />
          </>
        )
      case 21:
        return (
          <>
            <circle cx={50} cy={50} r={38} {...T} />
            <polygon points={hexagono(36)} {...FINO} />
            <polygon points={hexagono(24)} {...FINO} />
          </>
        )
      case 22:
        return (
          <>
            <circle cx={50} cy={50} r={38} {...T} />
            <polygon points={hexagono(36)} {...FINO} />
            <line x1={14} y1={50} x2={86} y2={50} {...FINO} />
          </>
        )
      case 23:
        return (
          <>
            <circle cx={50} cy={50} r={38} {...T} />
            <rect x={24} y={24} width={52} height={52} {...FINO} />
          </>
        )
      case 24:
        return <polygon points="10,18 90,18 50,88" {...T} />
      default:
        return null
    }
  }

  if (grupo) return <>{contenido()}</>
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', display: 'block' }}>
      {contenido()}
    </svg>
  )
}
