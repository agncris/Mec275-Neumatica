/**
 * Borde que se arrastra para cambiar el ancho de una columna (la paleta o el
 * inspector de neumática). La zona que se puede agarrar es bastante más ancha
 * que la línea que se ve, para no tener que apuntarle al píxel. Doble clic
 * vuelve al ancho original; con el teclado, ← y →.
 *
 * El ancho `null` es el de la hoja de estilos (cambia según la pantalla).
 */
interface Props {
  ancho: number | null
  onAncho: (a: number | null) => void
  min: number
  max: number
  /** 1 si la columna está a la izquierda del borde (crece al arrastrar a la derecha); −1 si está a la derecha. */
  lado: 1 | -1
  etiqueta: string
}

export default function BordeAncho({ ancho, onAncho, min, max, lado, etiqueta }: Props) {
  const limitar = (a: number) => Math.round(Math.max(min, Math.min(max, a)))
  /** La columna que controla: la de antes del borde o la de después. */
  const columna = (el: HTMLElement) => (lado === 1 ? el.previousElementSibling : el.nextElementSibling) as HTMLElement | null
  const actual = (el: HTMLElement) => ancho ?? Math.round(columna(el)?.getBoundingClientRect().width ?? min)

  const arrastrar = (e: React.PointerEvent) => {
    e.preventDefault()
    const x0 = e.clientX
    const a0 = actual(e.currentTarget as HTMLElement)
    const mover = (ev: PointerEvent) => onAncho(limitar(a0 + lado * (ev.clientX - x0)))
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      document.body.classList.remove('arrastrando-borde')
    }
    document.body.classList.add('arrastrando-borde')
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={etiqueta}
      aria-valuenow={ancho ?? undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      className="borde-ancho"
      onPointerDown={arrastrar}
      onDoubleClick={() => onAncho(null)}
      onKeyDown={(e) => {
        const a = actual(e.currentTarget as HTMLElement)
        if (e.key === 'ArrowLeft') onAncho(limitar(a - lado * 20))
        if (e.key === 'ArrowRight') onAncho(limitar(a + lado * 20))
      }}
      title="Arrastra para cambiar el ancho · doble clic: ancho original"
      data-borde-ancho={lado === 1 ? 'izquierda' : 'derecha'}
    />
  )
}
