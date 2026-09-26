# NeumaLab — Laboratorio virtual de neumática, PLC, CNC y robótica

**MEC275** — Aplicación web para el laboratorio del curso, con una pestaña por unidad:

- **Unidad 1 · Neumática**: armar, modificar y simular circuitos neumáticos con
  simbología **ISO 1219-1**, pensada como gemelo digital del banco de prácticas.
- **Unidad 2 · PLC**: programar en **Ladder** y probar el programa contra una planta
  del laboratorio en 3D (ver [Unidad 2 · PLC](#unidad-2--plc)).
- **Unidad 3 · CNC**: escribir programas en **código G** y simular el mecanizado en
  un centro de torneado o una fresadora en 3D, sin instalar CNC Simulator Pro (ver
  [Unidad 3 · CNC](#unidad-3--cnc)).
- **Unidad 4 · Robótica**: programar un robot KUKA con nodos, como Grasshopper +
  KUKA|prc, o con un mando manual, y simularlo en 3D con análisis y código KRL, sin
  Windows ni licencias (ver [Unidad 4 · Robótica](#unidad-4--robótica)).

Todo el contenido y la interfaz están en español.

---

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

## La entrega

La aplicación no trae enunciados ni soluciones: el enunciado y la plantilla (PPT) los
reparte el profesor. El alumno responde en la plantilla, la guarda como PDF y la sube
junto con el archivo de su trabajo. Cada unidad tiene un botón **«Entregar»** (arriba a
la derecha) que abre un cajón con cuatro pasos:

1. **Tus datos**: nombre (y el de la pareja, si hay) y el trabajo. Todos los archivos
   salen con el nombre que piden los enunciados: `Nombre_Apellido_Trabajo-2`.
2. **Revisa tu trabajo**: avisa de lo que conviene arreglar antes de entregar (piezas
   sueltas, líneas de código sin comentario, alarmas, E/S forzadas…). No corrige ni
   califica.
3. **Para pegar en tu presentación**: imágenes en PNG y tablas que se copian y se pegan
   en PowerPoint como tabla.
4. **Archivos que subes junto con tu PDF**: el archivo de la app (que se vuelve a abrir
   y a simular), el video de la simulación y, en PLC, CNC y Robótica, un enlace que
   abre el trabajo en la app.

| Unidad | Para la presentación | Archivos |
|---|---|---|
| Neumática | Diagrama VDI 2860 (se arma en el mismo cajón), diagrama espacio-fase, elementos del circuito, imagen del circuito | Circuito `.json` |
| PLC | Diagrama Ladder, tabla de entradas y salidas | Enlace al programa, programa `.json` |
| CNC | Trayectoria con los puntos, tabla de coordenadas, herramientas usadas, bruto | Programa `.cnc` (se abre también en CNC Simulator Pro), video, enlace |
| Robótica | Croquis de la pieza, posicionamiento, definición de nodos, ficha técnica | Definición `.json`, programa KRL `.src`, video, enlace |

Las entregas `.json` de semestres anteriores (con respuestas escritas) se siguen
abriendo.

Para informes con imágenes, la barra superior descarga:

| Botón | Qué produce |
|-------|-------------|
| **Circuito (PNG / SVG)** | La imagen del circuito, en mapa de bits o vectorial |
| **Diagrama de fase (PNG)** | El recorrido-tiempo con la secuencia A+ / A− ya marcada |
| **Guardar** | El `.json` sólo del circuito, sin respuestas |
| **Compartir** | Un enlace con el circuito dentro, para consultar dudas |

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

## Unidad 2 · PLC

La pestaña **Unidad 2 · PLC** es un laboratorio de controladores lógicos
programables: se escribe el programa en Ladder, se pasa el PLC a **RUN** y el
programa mueve una planta en 3D, con sonido. Los sensores de la planta vuelven a las
entradas del PLC, así que un programa mal hecho se nota como en el laboratorio: el
estanque rebalsa, la plataforma choca con el vástago.

**Editor Ladder.** Las dos barras de tensión y los escalones, numerados como en el
apunte (000, 001…). Se elige una herramienta y se hace clic en la casilla: contacto
NA ┤ ├, NC ┤/├, cable, rama (une dos filas en un nodo para hacer un paralelo) y, en la
columna de la derecha, bobinas ( ), (/), Set (S / OTL), Reset (R / OTU / RES),
flancos (P) y (N), temporizadores **TON / TOF / RTO** y contadores **CTU / CTD**;
además **ONS** (un solo pulso) y **comparaciones** EQU, NEQ, GRT, LES, GEQ, LEQ sobre
el acumulado de un temporizador o contador, una constante o un registro. Las
**instrucciones de datos** MOV, ADD, SUB, MUL y DIV trabajan con 16 registros enteros
`N0…N15` (`N7:0…` en LogixPro, `MW0…` en Siemens), con aviso de desborde y de división
por cero. Los temporizadores y contadores tienen
sus bits como en LogixPro (`.EN`, `.TT`, `.DN`, `.CU`), que se usan como contactos.
Cada elemento lleva su dirección (`I0.0…I0.7`, `Q0.0…Q0.7`, marcas `M0.0…M1.7`,
`T0…T7`, `C0…C7`) y se
muestra con el nombre de la **tabla de símbolos** (simbología · asignación ·
descripción). Con el PLC en RUN se ve la corriente: tramos con tensión en verde,
contactos cerrados rellenos, bobinas activas encendidas y el tiempo o la cuenta de
cada temporizador y contador. La aplicación avisa de los errores típicos: un contacto
sin dirección, una bobina sobre una entrada, la misma salida con bobina en dos
escalones (manda la última).

**Notación de direcciones.** Se elige en la barra: la del apunte (`I0.3`, `Q0.1`,
`M0.1`, `T0`) o la de **LogixPro / RSLogix** (`I:1/03`, `O:2/01`, `B3:0/1`,
`T4:0/DN`, `C5:0.ACC`); en esa notación las bobinas se rotulan L / U y RES. Cambia
todo a la vez: el diagrama, la tabla de símbolos, el simulador de E/S, la tabla de
datos y los rótulos de la planta 3D.

**Simulador de E/S y tabla de datos** (como en LogixPro). Siempre están las 8
entradas y las 8 salidas: las que no usa la planta quedan libres, cada una con un
interruptor o un pulsador NA / NC para probar cualquier programa. La **tabla de
datos** muestra la memoria del PLC en vivo: los bits de E/S y marcas, y cada
temporizador (PRE, ACC, EN, TT, DN) y contador (PRE, ACC, CU, DN), y los registros
N, que se pueden escribir a mano. Cada entrada o salida se puede **forzar** (F1 / F0),
como en el PLC real, con un aviso mientras haya algo forzado.

**Ciclo de scan.** El programa se ejecuta como en un PLC real, ~50 barridos por
segundo: lee las entradas, resuelve los escalones de arriba abajo (lo que escribe un
escalón ya lo lee el siguiente) y actualiza las salidas. En STOP las salidas quedan a 0.
Con el PLC en RUN, **❚❚ Pausar** congela el PLC y la planta y **⏭ Un barrido** ejecuta
un solo barrido: se cambian las entradas y se ve, escalón por escalón, qué resuelve el
PLC en ese barrido (el título muestra el número de barrido).

**Plantas** (el cableado es fijo, como en el banco; el alumno programa):

| Planta | Entradas | Salidas |
|---|---|---|
| Tablero de pruebas | 4 pulsadores y 4 selectores (`I0.0…I0.7`) | 6 pilotos, zumbador y ventilador (`Q0.0…Q0.7`) |
| Estanque con dos electroválvulas | START, STOP y los flotadores S1 (abajo) y S2 (arriba) | V1 llenado, V2 vaciado |
| Elevador de piezas | S0 (pieza en la plataforma) y los finales de carrera S1…S4 de Z1 y Z2 | Y1 y Y2 (electroválvulas de Z1 y Z2) |
| Silo que llena cajas (como el *Silo Simulator* de LogixPro) | START, STOP (NC), PROX, LEVEL | MOTOR de la cinta, SOLENOID, pilotos RUN / FILL / FULL |
| Semáforos de un cruce | MARCHA, PARO, botón de peatón | rojo / amarillo / verde Norte-Sur y Este-Oeste |
| Portón automático (como el *Door Simulator* de LogixPro) | ABRIR, CERRAR, PARO, finales de carrera arriba y abajo, fotocelda | SUBIR, BAJAR, pilotos abierto / cerrado / moviendo |

El silo no trae programa: es la planta para que la programes tú. Las plantas avisan
de los errores típicos: la caja que rebalsa o pasa sin llenar, el material que cae
sobre la cinta, las dos calles con paso a la vez, el motor del portón con las dos
órdenes, forzando contra el tope o bajando sobre un obstáculo.

En 3D se ve el PLC en su riel, con fuente, CPU (memoria y puerto de comunicación) y
módulos de entradas y salidas con un LED por borne; y la máquina: el agua que sube y
baja con los flotadores, los cilindros que suben y empujan la pieza a la segunda banda,
los pilotos del tablero. Suenan los relés de salida, las electroválvulas, el agua, los
topes de los cilindros y el zumbador. Los mandos se pulsan en la escena o en el panel.

**Ejercicios para resolver** (📝 en el menú, sin solución): el **Ejercicio 2 · Elevador
de piezas** trae el enunciado paso a paso, el esquema de conexiones, el circuito de
instalación, la planta 3D y el programa en blanco. El botón **Verificar mi programa**
prueba el programa del alumno contra la planta simulada y le dice qué pasos del
enunciado cumple y en cuál falla, sin mostrar cómo resolverlo.

**Ejemplos resueltos:** el ejercicio 1 del apunte (llenado y vaciado de tanque) y una
serie de programas básicos en el tablero: Y / O / NO,
marcha y paro con autorretención, Set y Reset, temporizador TON, intermitente con dos
TON, contador CTU, y ONS con comparaciones y RTO; además el semáforo con temporizadores
encadenados y el portón con enclavamiento y fotocelda. **＋ Nuevo programa** deja el editor en blanco con el cableado de la
planta elegida; el programa se guarda solo en el navegador y se puede descargar,
abrir y exportar como imagen para el informe.

**Teoría** (secciones plegables): qué es un PLC y para qué se usa, sus componentes,
entradas / salidas y direcciones, cómo elegirlo, los sensores, los símbolos Ladder
(contactos, bobinas, temporizadores, contadores) y el ciclo de scan.

La unidad no incluye soluciones de evaluaciones: el silo viene como planta, sin programa.

## Unidad 3 · CNC

La pestaña **Unidad 3 · CNC** reemplaza a CNC Simulator Pro para el trabajo del curso:
se escribe el programa en código G, se prepara la máquina y se ve en 3D cómo la
herramienta arranca el material.

**Máquinas.** *Centro de torneado* (ejes X en diámetro y Z; cero pieza en la cara,
sobre el eje; plato de tres garras) y *fresadora de 3 ejes* (cero pieza en la esquina
delantera izquierda de la cara superior; prensa y mesa). Se elige con «Máquina ▾», que
muestra cómo trabaja cada una y sus ejemplos; cada máquina guarda su propio programa.
En **Preparación** se elige
el material (latón, aluminio, acero, acrílico, madera) y las medidas del bruto (en el
torno también lo que toman las garras y el sobremetal de la cara); la lista de
herramientas muestra la torreta del torno (desbaste y afinado izquierda/derecha,
perfilado 35°, ranurado, tronzado 4 mm, roscado, brocas) y el almacén de la fresadora
(fresas planas, de bola, brocas, grabado en V, planeadora). Las herramientas se pueden
editar, agregar y quitar (número T, nombre, tipo y medidas), como al armar la torreta.

**Código G.** Bloques con `N`, `G`, `X Y Z`, `U V W` (incrementales), `I J K` / `R`,
`F`, `S`, `T`, `M` y comentarios `( … )` o `;`. Movimientos G00/G01/G02/G03, G04, G17–G19,
G20/G21 (y G70/G71 como en el apunte), G28, G33 (roscado), G90/G91, G94/G95, G96/G97,
ciclos G81/G83 con G98/G99 y G80; M00–M09 y M30. En el torno `T0101` elige la herramienta;
en la fresadora `T1 M06`. **Compensación de radio** G41/G42 con `D` y G40 en la fresadora
(el contorno se programa con las medidas de la pieza; avisa si la fresa no cabe en un
rincón). **Ciclos del torno** (Fanuc) `G71 U… R…` + `G71 P… Q… U… W… F…` para desbastar
un perfil y `G70 P… Q…` para afinarlo (sin P y Q, G70/G71 siguen siendo pulgadas y
milímetros). **Subprogramas** `O…` … `M99` llamados con `M98 P… L…` (o `M98 P31000`).

**Compatibilidad con CNC Simulator Pro.** Los programas escritos para ese simulador se
abren tal cual: `$Millimeter`/`$Inch` fijan las unidades y `$AddRegPart n` pone en el
plato el bruto de la preparación; con `$AddRegPart` el cero del torno pasa a la cara de
las garras, como allá (bruto de 100 mm con 23 mm en las garras → cara en Z77), y también
se puede elegir a mano («Cero del programa»). `G92 X… Z…` mueve el cero, `ET n` llama
una herramienta como `T n`, `T… M6` la monta, `G81`/`G83` taladran en el eje del torno
(como `G81 Z60 R78` del tutorial, con la broca T17) y `G76` rosca en dos bloques
(`P` repasos/ángulo, `Q` en micrones). El resto de las instrucciones `$` se ignora.

**Editor y revisión.** Editor con colores y números de línea; mientras se escribe se
revisa el programa y los errores salen en rojo con su línea y una explicación (arco
que no cierra, falta el avance F, eje que la máquina no tiene…). Poniendo el cursor en
una línea, **Explicar el bloque** dice qué hace cada palabra según el modo vigente.

**Simulación.** ▶ Ciclo, ⏭ Bloque a bloque, ⏮ Bloque anterior, ⟲ Reiniciar, ⏩ Al final
y velocidad de ×0,5 a ×60; en el torno, vista en corte. El material se arranca según la forma de cada herramienta (una herramienta
mal elegida se come los resaltes, como en la máquina). La simulación se detiene con
**alarma** si se entra al material en rápido, si se corta con el husillo detenido, si
se choca con las garras, el plato o la mesa, o si la broca se mueve de lado; los
consejos (pasadas de más de 5 mm en diámetro, fresado más hondo que el diámetro)
no la detienen. Al tronzar, la pieza cae a la bandeja. Hay viruta, refrigerante (M08),
sonido del husillo y del corte, y un visor de cotas (DRO) con herramienta, husillo,
avance, tiempo de ciclo y material quitado.

**Para el informe.** Vista 2D de la trayectoria (plano Z-X en el torno, vista superior
en la fresadora) con la silueta y los puntos de cada bloque; **tabla de coordenadas**
en absolutas e incrementales (se copia con un clic); descarga del programa como
`.cnc`, de la trayectoria como PNG y **grabación en video** de la vista 3D.

**Ejemplos** (comentados línea a línea): refrentado y cilindrado; eje escalonado con
ranura y tronzado; pomo con arcos G02/G03; buje taladrado; contorno cuadrado (el de la
guía); un programa en formato CNC Simulator Pro (cero en las garras, G81 y rosca G76);
ciclos G71/G70 sobre un perfil; círculo y arcos; agujeros en línea con G91; cajera en
dos niveles; ciclos G81/G83; grabado de letras; contorno con G41 repetido por un
subprograma.

**Teoría** (secciones plegables): qué es el CNC, ventajas y aplicaciones, cómo
organizar la programación, coordenadas absolutas e incrementales con una **práctica
autocorregida**, estructura de un bloque, códigos G y M, arcos, el torno y sus
operaciones, código de los insertos (ISO 1832) y cómo usar el simulador.

La unidad no incluye enunciados ni soluciones de evaluaciones.

## Unidad 4 · Robótica

La pestaña **Unidad 4 · Robótica** reemplaza, para estudiar y practicar, a Rhino 8 +
Grasshopper + KUKA|prc: corre en el navegador (Windows, Mac, Linux o tablet) y no
necesita licencias.

**Programación visual.** Un lienzo de nodos como el de Grasshopper: componentes con
entradas a la izquierda y salidas a la derecha, cables arrastrando de una salida a una
entrada (Mayús agrega un cable más; clic derecho desconecta), buscador con doble clic,
deslizadores (Number Slider), paneles que muestran los datos y los colores de estado de
Grasshopper (gris bien, naranjo faltan datos, rojo error, verde seleccionado). Las
pestañas y los nombres siguen a Grasshopper y KUKA|prc:

- *Params*: Curve (del plano DXF, por capa), Number Slider, Point, Panel.
- *Curve*: Rectangle, Circle, Polygon, Divide Length, Divide Curve, Discontinuity, Area,
  Offset Curve (para compensar el radio de la fresa).
- *Vector*: XY Plane, Rotate Plane, Move. *Sets*: Merge, List Item, Reverse List.
- *KUKA|prc*: LIN, PTP, CIR y AXIS Movement, Custom KRL, **Core**, Robot (KR 6 R900,
  KR 10 R1100, KR 16-2, KR 50 R2100 y KR 120 R2700, con los datos de sus fichas, o uno
  **personalizado** con las medidas de sus eslabones), Tool (husillo, taladro, ventosa,
  portalápiz, personalizada), Divide Curve (planos orientados), Set Digital Out, Wait y
  Command Weaver (en secuencia o intercalado).

**Plano DXF.** «Abrir DXF» lee líneas, arcos, círculos, polilíneas (con arcos) y splines
aproximadas, une los tramos sueltos en curvas continuas y respeta las unidades y las
capas del archivo. La definición guarda el plano, así que viaja completa en el .json.

**Simulación y análisis.** Brazos KUKA de 6 ejes con cinemática directa e inversa real
(muñeca esférica, codo arriba, la solución más cercana), mesón y plancha en la base que
se fija en el Core (X, Y, altura del mesón, giro, espesor), herramienta montada y
reproductor como KUKA|play. La trayectoria se pinta verde, naranja o roja según el
análisis: fuera de alcance, eje fuera de su rango, cerca de un límite, singularidad de
muñeca (A5 ≈ 0 con A4/A6 girando), salto brusco de configuración o **choque** del
brazo o la herramienta con el mesón o la plancha (la herramienta puede entrar a la
plancha, pero no enterrarse en el mesón); cada problema se
puede cliquear para ir a ese momento. Barras con el rango usado por cada eje, ficha
técnica del robot, esfera de alcance, huella de la herramienta sobre la plancha y
husillo que gira con la salida digital. **Exportar KRL** descarga el programa .src
($BASE, $TOOL, PTP con ejes, LIN/CIR con X Y Z A B C, $OUT, WAIT); también se graba video.
**Croquis** para el informe (PNG o SVG): la pieza acotada en planta, con el cero de la
pieza, y el posicionamiento del robot (planta y elevación con las distancias a la base,
la altura del mesón y si la plancha queda al alcance).

**Mando manual (teach-in).** Como el smartPAD: mover eje por eje o en X/Y/Z/A/B/C,
dejar la herramienta vertical, grabar puntos PTP o LIN (con la salida de la pinza) y
reproducirlos: el *teach-in/playback* de Devol. También exporta KRL.

**Tipos de robots en 3D.** SCARA, cilíndrico, esférico, cartesiano, angular y delta,
cada uno con sus articulaciones R/P movibles, grados de libertad y usos.

**Ejemplos** (de estudio): estructura básica de KUKA|prc; acercarse y alejarse con PTP;
fresado de una placa desde un DXF de práctica (contorno compensado, taladrado de
agujeros con Command Weaver intercalado y husillo). **Teoría**: robot industrial (Devol,
teach-in/playback), fabricación en serie frente a robótica, tipos, componentes,
grados de libertad y singularidades, ficha técnica, programación paramétrica
(Rhino → Grasshopper → KUKA|prc → KRL) y cómo instalar el software del curso de forma
legal (evaluación de Rhino 8, KUKA|prc educativo).

La unidad no incluye enunciados, planos ni soluciones de evaluaciones.

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
  /vista3d       # banco 3D de neumática: modelos, sonido y oído del banco
  /plc           # unidad 2: motor Ladder (scan), plantas, editor, planta 3D y teoría
  /cnc           # unidad 3: intérprete de código G, simulador de mecanizado, máquina 3D, editor y teoría
  /robot         # unidad 4: cinemática KUKA, nodos tipo Grasshopper/KUKA|prc, DXF, simulación, KRL, mando y teoría
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
npm test           # 349 pruebas: motor, análisis, entregas, trabajos, autoevaluaciones, plano, símbolos, banco 3D, PLC, CNC, robótica y utilidades
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

Terminado: motor con tests, editor de pizarra, vistas en corte, banco 3D con sonido,
unidad de PLC (Ladder, ciclo de scan, plantas 3D y teoría), unidad de CNC (código G,
torno y fresadora en 3D, trayectoria y video), unidad de robótica (nodos tipo
Grasshopper/KUKA|prc, robots KUKA en 3D, KRL y mando), diagrama espacio-fase,
guardado/compartir, despliegue y adaptación a tablet.

Pendiente: modo *Aprender* con lecciones guiadas paso a paso, modo *Desafío* con
enunciados verificados automáticamente.
