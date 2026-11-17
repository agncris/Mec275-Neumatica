# Unidad 1 · Neumática: guía y detalle

(Detalle movido desde el README. Las reglas para quien edita el repositorio están en [`CLAUDE.md`](../CLAUDE.md).)

## Guía rápida para el alumno

1. **Empieza.** **＋ Nuevo diagrama** deja la pizarra en blanco (si había un circuito,
   pregunta antes de borrarlo); también puedes partir de un ejemplo.
2. **Coloca las fichas.** Arrastra los componentes desde la paleta de la izquierda a la
   pizarra (o haz clic en ellos). Se imantan a la rejilla.
3. **Cablea.** Haz clic *cerca* de un puerto y luego cerca de otro: los puertos son
   magnéticos, no hace falta acertar al punto exacto. La manguera se enruta sola.
4. **Ajusta.** Selecciona una ficha y usa el panel *Propiedades*: presión del FRL,
   NC/NA, mono/biestable, apertura del regulador, cilindro que pisa cada rodillo…
5. **Simula.** Pulsa **▶ Simular** (o la barra espaciadora). Mantén pulsadas las
   válvulas de pulsador, haz clic en una biestable para conmutarla, y clic en la fuente
   para cortar el aire.
6. **Observa.** Mientras simula tienes varias lecturas del mismo circuito:
   - la **pizarra**, que se puede ver como **Esquema** (simbología ISO) o como **Taller**
     (cada componente dibujado como es en realidad, con el aire coloreado por dentro).
     El botón **Ver en paralelo** muestra las dos a la vez, sincronizadas, para relacionar
     el símbolo con el objeto; se desactiva con el mismo botón.
   - la **vista en corte**, que amplía el interior de la pieza que elijas,
   - el **diagrama de fase**, por **pasos** (desplazamiento-paso, como en la guía) o por
     tiempo, con la secuencia A+ / A− de cada actuador.
7. **Amplía si hace falta.** El botón **Pantalla completa** de la pizarra la abre a
   toda la pantalla, con sus mismos controles de zoom; se sale con el mismo botón o
   con `Esc`. Va bien para proyectar el circuito en clase y para trabajar un plano
   grande sin el resto de la página alrededor.
8. **Guarda o comparte.** *Guardar* descarga un `.json`, *Abrir* lo recupera y
   *Compartir* copia un enlace con el circuito dentro (no necesita servidor ni cuenta).
   Además la pizarra se conserva sola en el navegador entre sesiones.

**Para partir**, cada unidad muestra una guía de inicio de cuatro pasos la primera vez
que se abre; se vuelve a ver con el botón **?**.

**Mis trabajos** (menú Archivo, en las cuatro unidades) guarda varios trabajos con nombre
en el navegador; el **respaldo** los lleva todos en un solo archivo a otro computador.

**Sin conexión:** después de la primera visita la app funciona sin internet (se puede
instalar como aplicación desde el navegador). Cada unidad guarda sola lo que tiene
abierto.

**Atajos:** `Espacio` simular/detener · `Supr` borrar lo seleccionado · `Esc` cancelar cableado · `Ctrl+Z` deshacer · `Ctrl+Shift+Z` (o `Ctrl+Y`) rehacer. En la unidad de PLC: `Espacio` RUN/STOP y los mismos atajos de deshacer en el programa Ladder.


## Secciones de estudio

Cada unidad tiene su página **Estudiar** (arriba a la derecha), con índice y enlaces
directos. Las cuatro empiezan con una **autoevaluación** de preguntas
generadas al azar (no son las de los controles ni de las tareas), con la respuesta
explicada; las cuatro unidades tienen una **ficha de repaso** de una página para
imprimir o guardar como PDF. En Neumática:

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
| 7 | Cascada de 3 grupos (control): A+ B+ \| B− A− C+ \| C− | Método cascada con tres líneas de grupo, actuador giratorio y marcha M |

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

## Banco 3D: el experimento montado

La vista **Banco 3D** monta el circuito en una placa perfilada de laboratorio, con luz,
sombras y materiales físicos (aluminio anodizado, cromo, racores de latón, tubo de
poliuretano), y la mueve el mismo motor que la pizarra: al simular, los vástagos
salen, la leva del vástago pisa el rodillo, la brida del actuador giratorio gira y el
manómetro del FRL marca la presión. Con **Ver el aire**, las mangueras que tienen
presión se aclaran, así se sigue el recorrido de la señal por el banco, y se ven
las bocanadas de aire que salen por los escapes.

**Y se oye como el laboratorio** (botón 🔊 Sonido, sintetizado en el navegador, sin
grabaciones): el «chac» de la corredera de cada válvula al conmutar, el clic del
rodillo cuando la leva lo pisa, el golpe del émbolo contra la culata al final de la
carrera y el soplido del aire. El soplido sale **por el silenciador por donde sale de
verdad**: la aplicación sigue, en cada instante, el camino abierto desde la cámara que
se vacía (o la línea que se ventea) hasta el escape, así que al avanzar un cilindro
sopla el escape 3 de su 5/2 y al retornar el 5; con un escape rápido sopla el escape
rápido, y al cerrar la llave del FRL se descarga el FRL. Cada sonido suena a la
izquierda o a la derecha según dónde esté la pieza en pantalla. Con un regulador de
caudal el soplido es más débil y dura más, como el movimiento.

**Cada ficha de la paleta tiene su pieza en el banco**, y las que tienen algo que
mirar lo muestran:

| Pieza | Qué se ve al simular |
|---|---|
| Cilindros | el vástago sale y entra, con la leva que pisa los rodillos |
| Actuador giratorio / motor | la brida gira; el disco del motor lleva la leva del sensor de paso |
| Válvulas 3/2, 4/2, 5/2 | pulsador o cabezas de pilotaje; el indicador rojo marca hacia dónde conmutó |
| Final de carrera / sensor de paso | la palanca del rodillo se inclina cuando la pisan |
| Regulador de caudal | la perilla gira sobre su escala según la apertura; la flecha marca el sentido que estrangula |
| Temporizador | el depósito transparente se va llenando de aire; al llenarse, la válvula conmuta |
| Escape rápido | por la mirilla se ve saltar el obturador al purgar; lleva un silenciador grande |
| Válvulas «O» / «Y» | por la mirilla se ve la bola («O») o la corredera («Y») irse al lado de la entrada que queda cerrada |
| FRL y manómetro | la aguja marca la presión |

- Las piezas se colocan siguiendo el plano ordenado, salvo las que **se montan donde
  trabajan**: los finales de carrera sobre el vástago de su cilindro, en el punto de
  la carrera que vigilan, y el sensor de paso frente al eje de su motor, sobre una
  escuadra, en el punto de la vuelta en que dispara.
- Se gira arrastrando, se acerca con la rueda (hacia donde apunta el ratón) y tiene
  pantalla completa.
- Los pulsadores se accionan manteniendo pulsado su botón del panel **Mandos** o
  directamente sobre la pieza.
- Los escapes libres llevan su silenciador de bronce sinterizado, como en el banco.
- No descarga nada: los modelos y los sonidos se generan en el navegador, y three.js sólo se carga
  cuando alguien abre esta vista.


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
  (memoria), con accionamiento por pulsador o pilotaje neumático (12 / 14; 10 en la 3/2 NA).
- **Válvula de inicio:** 3/2 con pulsador con enclavamiento, que queda accionada hasta
  volver a pulsarla (para dejar corriendo un ciclo automático).
- **Rótulos:** cada pieza puede llevar su nombre en la máquina («Elevador») y cada
  actuador su letra en la secuencia (A, B…); los finales de carrera muestran su señal
  (a0, a1) y el diagrama de fase usa esas letras y nombres.
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
