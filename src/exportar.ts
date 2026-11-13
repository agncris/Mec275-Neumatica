/**
 * Exportación de láminas: convierte un SVG de la aplicación (la pizarra o el
 * diagrama de fase) en un PNG descargable, para que el alumno lo pegue en su
 * informe. Es lo que sustituye a los archivos .ct / .bak de FluidSim, junto
 * con el .json del circuito, que sí se puede volver a abrir y corregir.
 */

const FUENTE =
  "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"

/** Prepara una copia del SVG con tamaño explícito y sin depender de CSS externo. */
function prepararCopia(svg: SVGSVGElement, escala: number): { texto: string; ancho: number; alto: number } {
  const viewBox = (svg.getAttribute('viewBox') ?? '0 0 800 600').split(/\s+/).map(Number)
  const ancho = Math.round((viewBox[2] || 800) * escala)
  const alto = Math.round((viewBox[3] || 600) * escala)

  const copia = svg.cloneNode(true) as SVGSVGElement
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copia.setAttribute('width', String(ancho))
  copia.setAttribute('height', String(alto))

  // Las animaciones de flujo se quedan congeladas en la lámina; el trazo
  // discontinuo sobraría, así que lo quitamos.
  copia.querySelectorAll('.manguera-flujo').forEach((n) => n.classList.remove('manguera-flujo'))
  // Los campos de formulario (foreignObject) hacen que algunos navegadores marquen el lienzo como
  // «contaminado» y no dejen exportarlo: se dibujan como formas SVG (el slider, como una pista con su perilla).
  const originales = Array.from(svg.querySelectorAll('foreignObject'))
  Array.from(copia.querySelectorAll('foreignObject')).forEach((fo, i) => {
    const NS = 'http://www.w3.org/2000/svg'
    const x = Number(fo.getAttribute('x') ?? 0)
    const y = Number(fo.getAttribute('y') ?? 0)
    const w = Number(fo.getAttribute('width') ?? 0)
    const h = Number(fo.getAttribute('height') ?? 0)
    const campo = originales[i]?.querySelector('input, select, textarea') as HTMLInputElement | null
    const g = document.createElementNS(NS, 'g')
    if (campo && campo.type === 'range') {
      const min = Number(campo.min || 0)
      const max = Number(campo.max || 100)
      const f = max > min ? Math.min(1, Math.max(0, (Number(campo.value) - min) / (max - min))) : 0
      const pista = document.createElementNS(NS, 'rect')
      pista.setAttribute('x', String(x + 4))
      pista.setAttribute('y', String(y + h / 2 - 2))
      pista.setAttribute('width', String(Math.max(0, w - 8)))
      pista.setAttribute('height', '4')
      pista.setAttribute('rx', '2')
      pista.setAttribute('fill', '#c6ced6')
      const perilla = document.createElementNS(NS, 'circle')
      perilla.setAttribute('cx', String(x + 4 + (w - 8) * f))
      perilla.setAttribute('cy', String(y + h / 2))
      perilla.setAttribute('r', '6')
      perilla.setAttribute('fill', '#1668c7')
      g.append(pista, perilla)
    } else {
      const texto = document.createElementNS(NS, 'text')
      texto.setAttribute('x', String(x + 2))
      texto.setAttribute('y', String(y + h * 0.7))
      texto.setAttribute('font-size', '11')
      texto.setAttribute('fill', '#1c2733')
      texto.textContent = campo ? ('value' in campo ? String(campo.value) : '') : (fo.textContent ?? '')
      g.append(texto)
    }
    fo.replaceWith(g)
  })
  // Ayudas de edición (lápiz, «agregar descripción»…) que no van en la imagen.
  copia.querySelectorAll('[data-no-exportar]').forEach((n) => n.remove())

  // Fondo blanco y tipografía embebida: el PNG debe verse igual fuera del navegador.
  const estilo = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  estilo.textContent = `text { font-family: ${FUENTE}; }`
  copia.insertBefore(estilo, copia.firstChild)
  const fondo = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  fondo.setAttribute('x', String(viewBox[0] || 0))
  fondo.setAttribute('y', String(viewBox[1] || 0))
  fondo.setAttribute('width', String(viewBox[2] || 800))
  fondo.setAttribute('height', String(viewBox[3] || 600))
  fondo.setAttribute('fill', '#ffffff')
  copia.insertBefore(fondo, estilo.nextSibling)

  return { texto: new XMLSerializer().serializeToString(copia), ancho, alto }
}

/** Dibuja el SVG en un lienzo (fondo blanco), listo para pasarlo a PNG. */
async function svgALienzo(svg: SVGSVGElement, escala: number): Promise<HTMLCanvasElement> {
  const { texto, ancho, alto } = prepararCopia(svg, escala)
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('No se pudo convertir el dibujo a imagen.'))
      img.src = url
    })
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const ctx = lienzo.getContext('2d')
    if (!ctx) throw new Error('El navegador no permite generar la imagen.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(imagen, 0, 0, ancho, alto)
    return lienzo
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Descarga el SVG indicado como PNG. */
export async function exportarPng(
  svg: SVGSVGElement,
  nombreArchivo: string,
  escala = 2,
): Promise<void> {
  const lienzo = await svgALienzo(svg, escala)
  const blob = await new Promise<Blob | null>((resolve) => lienzo.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('No se pudo generar el PNG.')
  descargarBlob(blob, nombreArchivo)
}

/** El SVG como imagen PNG embebida (data URL), para guardarla dentro de la entrega. */
export async function pngEmbebido(svg: SVGSVGElement, escala = 1.5): Promise<string> {
  const lienzo = await svgALienzo(svg, escala)
  return lienzo.toDataURL('image/png')
}

/** Descarga el SVG tal cual (vectorial, útil para imprimir sin perder nitidez). */
export function exportarSvg(svg: SVGSVGElement, nombreArchivo: string): void {
  const { texto } = prepararCopia(svg, 1)
  descargarBlob(new Blob([texto], { type: 'image/svg+xml;charset=utf-8' }), nombreArchivo)
}

function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Nombre de archivo seguro a partir de lo que escriba el alumno. */
export function nombreSeguro(base: string, extension: string): string {
  const limpio = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return `${limpio || 'circuito'}.${extension}`
}
