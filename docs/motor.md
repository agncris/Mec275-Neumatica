# Cómo funciona el motor neumático por dentro

(Detalle movido desde el README. Las reglas para quien edita el repositorio están en [`CLAUDE.md`](../CLAUDE.md).)

## Cómo funciona por dentro

El circuito se modela como un **grafo dirigido**: los nodos son los puertos (numeración
CETOP 1, 2, 3, 4, 5, 12, 14) y las aristas son las mangueras más los caminos internos de
cada componente, que dependen de su estado. Cada tick (30 Hz):

1. **Se resuelve** la propagación de presión desde las fuentes y el factor de caudal
   hasta cada nodo y desde cada nodo hasta la atmósfera (algoritmo de *camino más ancho*:
   manda el cuello de botella).
2. **Se asienta la lógica**: las válvulas que eligen camino según la presión (lógicas,
   pilotadas, escape rápido) y los finales de carrera se recolocan y se vuelve a resolver
   hasta que nadie cambia. Sin esta fase, un mando bimanual daría una señal falsa de un
   tick al pulsar una sola mano.
3. **Se integra la física**: velocidad de vástago proporcional al caudal efectivo,
   limitada por el menor entre el aire que entra y el que puede escapar.

De ahí sale la causalidad correcta que se busca enseñar: si la válvula no conmuta el
cilindro no se mueve; si se estrangula el escape el vástago sale más lento; si el aire
queda atrapado el vástago se bloquea; y un cortocircuito presión-escape no hace trabajo.
