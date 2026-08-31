import { CASCADA_ABC } from '../src/circuitos/cascada-abc'
import { autoLayout } from '../src/layout'
import { DESCRIPTORES } from '../src/components/descriptores'

const { piezas, ok } = autoLayout(CASCADA_ABC.piezas, CASCADA_ABC.mangueras)
const caja = (p: { x: number; y: number; tipo: string }) => {
  const d = DESCRIPTORES[p.tipo]
  return { x: p.x, y: p.y, w: (d?.ancho ?? 60) + 8, h: (d?.alto ?? 40) + 8 }
}
const sup = (a: any, b: any, g = 0) =>
  a.x - g < b.x + b.w && a.x + a.w + g > b.x && a.y - g < b.y + b.h && a.y + a.h + g > b.y

console.log('ok:', ok)
for (let i = 0; i < piezas.length; i++)
  for (let j = i + 1; j < piezas.length; j++)
    if (sup(caja(piezas[i]), caja(piezas[j]), 4))
      console.log('CHOCAN:', piezas[i].id, '[x,y=]', piezas[i].x, piezas[i].y, 'vs', piezas[j].id, piezas[j].x, piezas[j].y)
piezas.forEach((p: any) => console.log(p.id, Math.round(p.x), Math.round(p.y)))
