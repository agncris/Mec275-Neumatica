/**
 * Historial para deshacer y rehacer. Los cambios seguidos (arrastrar una
 * ficha, escribir en un campo) se agrupan en un solo paso: sólo se anota una
 * foto nueva si pasó un rato desde el cambio anterior.
 */
export class Historial<T> {
  private pasado: T[] = []
  private futuro: T[] = []
  private ultimo = -Infinity

  constructor(
    private readonly agrupacionMs = 600,
    private readonly maximo = 100,
    private readonly ahora: () => number = () => Date.now(),
  ) {}

  /** Llamar ANTES de cambiar, con el estado actual. */
  anotar(actual: T): void {
    const t = this.ahora()
    if (t - this.ultimo > this.agrupacionMs) {
      this.pasado.push(actual)
      if (this.pasado.length > this.maximo) this.pasado.shift()
      this.futuro = []
    }
    this.ultimo = t
  }

  /** Devuelve el estado anterior (o null) y guarda el actual para rehacer. */
  deshacer(actual: T): T | null {
    const previo = this.pasado.pop()
    if (previo === undefined) return null
    this.futuro.push(actual)
    this.ultimo = -Infinity
    return previo
  }

  rehacer(actual: T): T | null {
    const siguiente = this.futuro.pop()
    if (siguiente === undefined) return null
    this.pasado.push(actual)
    this.ultimo = -Infinity
    return siguiente
  }

  get puedeDeshacer() {
    return this.pasado.length > 0
  }
  get puedeRehacer() {
    return this.futuro.length > 0
  }

  vaciar(): void {
    this.pasado = []
    this.futuro = []
    this.ultimo = -Infinity
  }
}
