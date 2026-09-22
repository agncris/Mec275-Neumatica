# NeumaLab — Laboratorio virtual de neumática

**MEC275 · Neumática industrial** — Aplicación web para armar, modificar y simular
circuitos neumáticos con simbología **ISO 1219-1**, pensada como gemelo digital del
banco de prácticas. Todo el contenido y la interfaz están en español.

---

## Guía rápida para el alumno

1. **Coloca las fichas.** Arrastra los componentes desde la paleta de la izquierda a la
   pizarra (o haz clic en ellos). Se imantan a la rejilla.
2. **Cablea.** Haz clic *cerca* de un puerto y luego cerca de otro: los puertos son
   magnéticos, no hace falta acertar al punto exacto. La manguera se enruta sola.
3. **Ajusta.** Selecciona una ficha y usa el panel *Propiedades*: presión del FRL,
   NC/NA, mono/biestable, apertura del regulador, cilindro que pisa cada rodillo…
4. **Simula.** Pulsa **▶ Simular** (o la barra espaciadora). Mantén pulsadas las
   válvulas de pulsador, haz clic en una biestable para conmutarla, y clic en la fuente
   para cortar el aire.
5. **Observa.** Mientras simula tienes varias lecturas del mismo circuito:
   - la **pizarra**, que se puede ver como **Esquema** (simbología ISO) o como **Taller**
     (cada componente dibujado como es en realidad, con el aire coloreado por dentro).
     El botón **Ver en paralelo** muestra las dos a la vez, sincronizadas, para relacionar
     el símbolo con el objeto; se desactiva con el mismo botón.
   - la **vista en corte**, que amplía el interior de la pieza que elijas,
   - el **diagrama de fase**, por **pasos** (desplazamiento-paso, como en la guía) o por
     tiempo, con la secuencia A+ / A− de cada actuador.
6. **Amplía si hace falta.** El botón **Pantalla completa** de la pizarra la abre a
   toda la pantalla, con sus mismos controles de zoom; se sale con el mismo botón o
   con `Esc`. Va bien para proyectar el circuito en clase y para trabajar un plano
   grande sin el resto de la página alrededor.
7. **Guarda o comparte.** *Guardar* descarga un `.json`, *Abrir* lo recupera y
   *Compartir* copia un enlace con el circuito dentro (no necesita servidor ni cuenta).
   Además la pizarra se conserva sola en el navegador entre sesiones.

**Atajos:** `Espacio` simular/detener · `Supr` borrar lo seleccionado · `Esc` cancelar cableado.

## La entrega

La aplicación no trae enunciados: esos se reparten aparte. Lo que sí trae es todo lo
necesario para resolverlos y entregarlos.

En la sección **«Mi entrega»** se rellenan los datos, se pone título al trabajo y se
responde lo que pida el enunciado:

| Apartado | Cómo se responde |
|---|---|
| Diagrama de funcionamiento VDI 2860 | Se arma con los símbolos de la norma, ordenables y anotables |
| Secuencia, grupos y activadores | Al escribir la secuencia, la aplicación divide los grupos y dice cuántas válvulas de cascada hacen falta |
| Elementos necesarios | Se rellena solo con el inventario del circuito montado, y se puede editar |
| Diagrama de fase | Se dibuja solo al simular; se descarga en PNG |
| Circuito neumático | El banco |

**Comprobar mi trabajo** simula el circuito y contrasta lo escrito con lo que de verdad
hace: si está bien montado, si se mueve, si hay señales bloqueantes, si el ciclo se
cierra y si la secuencia declarada coincide con la que ejecuta. No corrige ni califica.

**Descargar mi entrega** produce un único `.json` con las respuestas y el circuito
dentro. Sustituye al par PDF + `.ct`/`.bak`, con la ventaja de que el circuito sigue
siendo ejecutable: quien lo abra con **Abrir** puede simularlo.

Para informes con imágenes, la barra superior descarga:

| Botón | Qué produce |
|-------|-------------|
| **Circuito (PNG / SVG)** | La imagen del circuito, en mapa de bits o vectorial |
| **Diagrama de fase (PNG)** | El recorrido-tiempo con la secuencia A+ / A− ya marcada |
| **Guardar** | El `.json` sólo del circuito, sin respuestas |
| **Compartir** | Un enlace con el circuito dentro, para consultar dudas |

## Secciones de estudio

Bajo el banco hay secciones plegables con el material de apoyo:

- **Método cascada** — explicador animado paso a paso, divisor de grupos interactivo
  para cualquier secuencia, y dos circuitos de demostración: el que se bloquea por
  señales bloqueantes y el mismo resuelto por cascada.
- **Simbología VDI 2860** — los 24 símbolos de funciones de manipulación, con modo de
  práctica tipo control (símbolo → nombre).
- **Simbología ISO 1219-1** — actuadores, válvulas y la unidad de mantenimiento (FRL),
  con el mismo modo de práctica.
- **Nº de vías y posiciones** — nomenclatura de orificios ISO 1219-1 / CETOP.

## Circuitos de ejemplo incluidos

| # | Circuito | Qué se practica |
|---|----------|-----------------|
| 1 | Cilindro de simple efecto con 3/2 | Mando directo, retorno por muelle |
| 2 | Doble efecto con 5/2 y regulador | Control de velocidad (estrangulación del escape) |
| 3 | 5/2 biestable con dos pulsadores | Memoria neumática, pilotaje 12/14 |
| 4 | Ciclo automático ida-vuelta | Finales de carrera de rodillo |
| 5 | Mando bimanual | Válvula de simultaneidad «Y», seguridad |
| 6 | Encadenar dos cilindros | Final de carrera que pilota otra válvula |

## Sección «Método cascada»

Una sección didáctica desplegable, aparte de los ejemplos, dedicada a resolver secuencias
con **señales bloqueantes**:

1. **Un explicador animado** con dos modos, *sin cascada* y *con cascada*, que se puede
   reproducir solo o recorrer paso a paso. Enseña la única idea que hay que entender:
   un rodillo verde (pisado) cuya bajante está gris (sin aire) **no manda nada**. En el
   modo sin cascada se ven las dos órdenes opuestas chocando en rojo sobre la misma
   válvula; en el modo con cascada se ve cómo, al morir la línea L1, la señal de `a1`
   desaparece sola y el ciclo puede continuar.
2. **Los dos circuitos reales** para cargar en el banco y simular: el que se bloquea y
   el mismo resuelto por cascada.
3. **Un divisor de grupos interactivo**: escribes cualquier secuencia
   (`A+ A- B+ B-`, `A+ B+ C+ C- B- A-`…) y la aplicación la parte en grupos y dice cuántas
   válvulas de cascada hacen falta (siempre una menos que grupos).
4. **Las tres reglas de cableado** y **los tiempos del ejemplo resuelto**.

Ni el dibujo ni las órdenes del explicador están escritos a mano: se calculan a partir del
estado de cada paso con la misma regla que el circuito real (*señal = pisado Y con aire*),
y hay pruebas que lo verifican, para que la animación no pueda contradecir a la teoría.

## Cómo ordena la aplicación el plano

Al abrir un circuito (o cargar un ejemplo) la aplicación lo redibuja como un plano
técnico, sin tocar la lógica: sólo mueve las fichas. Los criterios, de arriba abajo
—que es como se lee la cadena de mando, de la señal al actuador—, son:

1. **Un actuador por columna**, en el orden de la secuencia, bien separados.
2. **Su válvula de potencia justo debajo**, en el mismo eje. Lo que va en la línea
   de potencia (un regulador de caudal, un escape rápido) se intercala entre ambos.
3. **La lógica de señal** («O», «Y», temporizadores) bajo la válvula que pilota.
4. **Los emisores de señal** —finales de carrera y pulsadores— en una banda común,
   cada uno bajo la válvula a la que manda, para que su señal suba o baje en vertical.
5. **Las líneas de grupo**, en un pasillo libre reservado para ellas.
6. **Las válvulas de cascada**, encadenadas de izquierda a derecha, con el emisor que
   pilota cada lado (14 a la izquierda, 12 a la derecha) pegado a ella.
7. **La línea de presión** y, al pie, el compresor con su FRL.

Entre columnas queda siempre un canal libre por el que las mangueras bajan sin
atravesar ningún símbolo, y todo el trazado es ortogonal.

### Las líneas de grupo se dibujan como barras

La salida de una válvula de cascada alimenta a media instalación. Dibujarla como un
abanico de mangueras sueltas es ilegible, así que la aplicación la reconoce sola y la
dibuja como en el plano de clase: una **barra horizontal rotulada** (`G1`, `G2`, `G3`…,
y `P` para la de presión) de la que cuelgan en vertical sus ramales, con un nudo en
cada empalme. Los grupos se numeran siguiendo la cadena de cascada y se apilan en
orden, G1 arriba. La barra se pone azul cuando esa línea tiene aire, así que de un
vistazo se ve **qué grupo manda en cada instante**.

Hay pruebas que lo verifican sobre todos los circuitos de la aplicación: que ninguna
ficha se pise, que ninguna manguera pase por encima de un símbolo, que no haya
diagonales y que las barras queden en pasillos libres y en el orden correcto.

## Biblioteca de componentes

- **Fuente:** compresor + unidad de mantenimiento FRL, presión regulable 2–8 bar con manómetro.
- **Actuadores:** cilindro de simple efecto (retorno por muelle), de doble efecto y
  **actuador giratorio** (unidad de volteo, 90/180/270°).
- **Distribuidoras:** 3/2 NC y NA, 4/2 y 5/2 en versión monoestable (muelle) y biestable
  (memoria), con accionamiento por pulsador o pilotaje neumático (12 / 14).
- **Finales de carrera** de rodillo, accionados por el vástago del cilindro que se les asigne.
- **Auxiliares:** regulador de caudal unidireccional, válvula selectora «O», válvula de
  simultaneidad «Y», válvula de escape rápido y temporizador neumático.

## Nomenclatura de los símbolos

Los símbolos siguen **ISO 1219-1**, con los mismos criterios que FluidSim, porque es
lo que al alumno le van a pedir dibujar:

- **Cada posición de una válvula representa todos sus puertos.** Los que comunican
  llevan su vía con la flecha del sentido de flujo; los que no, el trazo de bloqueo
  en T. Una 5/2, por ejemplo, tiene dos vías y **un escape bloqueado** en cada
  posición: la de reposo bloquea el 3 y la accionada el 5.
- **El pilotaje neumático es un triángulo** hueco apuntando a la válvula, rotulado
  14 o 12. No es un rectángulo con una diagonal: eso es el accionamiento manual
  general y confunde una señal de aire con un mando de mano.
- **El pulsador** es el vástago con cabeza; **el muelle**, la línea en zigzag; **el
  final de carrera**, la palanca con rodillo y su muelle de retorno.
- **Los puertos se numeran** 1 (alimentación), 2 y 4 (trabajo), 3 y 5 (escapes),
  12 y 14 (pilotajes).
- **El compresor** es el círculo con el triángulo macizo apuntando hacia la salida.
- **Los puertos de los actuadores no se rotulan.** La vía se identifica por la de la
  válvula que los alimenta (4 y 2), y poner «A» y «B» en un cilindro se confunde con
  la designación de actuadores de ISO 1219-2.
- **El actuador giratorio** es la cúpula con su eje y su sentido de giro.

Hay pruebas que lo verifican símbolo a símbolo (`src/__tests__/simbolos.test.tsx`):
cuentan las vías y los bloqueos de cada válvula y comprueban que los accionamientos
son los que corresponden.

> Dos diferencias deliberadas con FluidSim: los escapes 3 y 5 no llevan silenciador
> dibujado, porque en la aplicación son puertos que el alumno puede cablear; y el
> explicador animado del método cascada usa un esquema simplificado a propósito, no
> simbología normalizada.

## Vistas en corte

Cada válvula y cada cilindro se pueden ver en sección, al estilo de las láminas de clase:
cuerpo gris de fundición (naranja en los cilindros), **aire azul intenso = a presión**,
**celeste = comunicado con la atmósfera**, juntas rojas, muelles helicoidales y partes
móviles animadas. Los colores salen de las presiones reales del motor, así que el corte
nunca puede contradecir a la simulación. En modo *Editar* cada pieza se puede accionar
por separado para explorarla antes de montar nada.

---

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

### Estructura del repositorio

```
/src
  /engine        # grafo, solver, componentes y validación (lógica pura, con tests)
  /components    # interfaz React: pizarra, paleta, propiedades, diagrama, cortes
  /symbols       # símbolos ISO 1219-1 animados
  /realistic     # vistas en corte de válvulas y cilindros
  persistencia.ts# guardar, abrir y compartir circuitos
/server.js       # servidor Express para producción
Dockerfile
```

## Poner en marcha

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm test           # 194 pruebas: motor, análisis, entregas, plano, símbolos y utilidades
npm run typecheck  # comprobación de tipos
npm run build      # compila a /dist
```

## Publicarlo para la clase

**Railway / Render (con el Dockerfile):** crea el proyecto desde el repositorio de GitHub;
detecta el `Dockerfile` solo. El servidor respeta `process.env.PORT` y expone `/salud`
para las comprobaciones de estado.

```bash
docker build -t neumalab .
docker run -p 3000:3000 neumalab
```

**Vercel (la vía más simple):** al ser una SPA sin backend basta con publicar el
resultado de la compilación. Importa el repositorio en Vercel y acepta lo que propone;
el `vercel.json` del proyecto ya fija la configuración:

| Ajuste | Valor |
|--------|-------|
| Framework Preset | **Vite** |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

No hace falta `server.js` ni variables de entorno. Netlify funciona igual publicando
`dist` con el comando `npm run build`.

> Como los circuitos viajan dentro del propio enlace y se guardan en el navegador, no hay
> base de datos, ni cuentas, ni datos personales de los alumnos que administrar.

## Estado y siguientes pasos

Terminado: motor con tests, editor de pizarra, vistas en corte, diagrama espacio-fase,
guardado/compartir, despliegue y adaptación a tablet.

Pendiente: modo *Aprender* con lecciones guiadas paso a paso, modo *Desafío* con
enunciados verificados automáticamente, y sonido (Web Audio).
