import { croquisPieza, croquisPosicion } from './croquis'
import type { leerDXF } from './geometria'
import type { Plano } from './matematica'
import { PLACA_DEFECTO } from './movimiento'
import type { Herramienta, Programa, RobotVirtual } from './nodos'
import type { Previa } from './Robot3D'

/** Croquis (SVG en texto): la pieza acotada o el posicionamiento del robot. */
export function crearCroquisRobot(
  tipo: string,
  { nombre: nombreDef, dxf, previa, robotVista, baseVista, programa, placa, herrVista }: {
    nombre: string | undefined
    dxf: ReturnType<typeof leerDXF> | null
    previa: Previa
    robotVista: RobotVirtual
    baseVista: Plano
    programa: Programa | null
    placa: { x0: number; y0: number; x1: number; y1: number } | null
    herrVista: Herramienta
  },
): string {
  const nombre = nombreDef || 'robot'
  if (tipo === 'pieza') {
    const curvas = dxf?.curvas.length
      ? dxf.curvas.map((c) => ({ pts: c.pts, cerrada: c.cerrada }))
      : previa.curvas.map((pts) => ({ pts, cerrada: pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-3 }))
    if (!curvas.length) throw new Error('No hay geometría para el croquis: abre un DXF o arma curvas en la definición.')
    return croquisPieza(curvas, nombre)
  }
  return croquisPosicion(
    { modelo: robotVista.modelo, pedestal: robotVista.pedestal, base: baseVista, espesor: programa?.espesor ?? 5, placa: placa ?? PLACA_DEFECTO, herramienta: herrVista },
    nombre,
  )
}
