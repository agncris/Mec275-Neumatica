# Unidad 3 · CNC

(Detalle movido desde el README. Las reglas para quien edita el repositorio están en [`CLAUDE.md`](../CLAUDE.md).)

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

**Programas de un torno Fanuc real** (como el Prog 610 del laboratorio) se abren casi tal cual: `:610` es el número de programa, `/` es salto de bloque, `T0` sólo borra correctores, y `G83` sin `R` parte de donde está la herramienta (con `Q` en micras, `Q10000` = 10 mm). Lo propio de esa máquina (tope, puerta, `G50`) se avisa o se ignora; el tope `T0404` se tiene que quitar, porque en la app es una herramienta de corte.

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

**Tarea 3.** La sección **«★ Tarea 3»** (junto a Laboratorio) abre el centro de torneado con
latón y el programa nuevo del torno (N10–N40 y N900–N920), guardado aparte del Laboratorio. En el
panel de abajo, la pestaña **Plano** muestra el plano de la pieza (el del enunciado); la
**Preparación** del bruto queda en blanco para que el alumno determine sus dimensiones. No trae
soluciones, no se cambia de máquina y no hay ejemplos. **«Entregar Tarea CNC»** sólo aparece ahí y
da la trayectoria, la tabla de coordenadas, las herramientas, el bruto, el video y el `.json`
(`Nombre_Apellido[_Pareja]_Tarea-3`). Si el nombre ya está escrito, **Exportar › Trabajo (JSON)**
usa ese mismo nombre.

El `.json` guarda el programa, la preparación (material, bruto, garras, sobremetal y cero del
programa), la **torreta completa**, el nombre del alumno y la marca de la tarea; los `.json` anteriores
se siguen abriendo. Al abrir un `.json` con «Abrir…» se muestra su **revisión**: errores de
escritura, líneas sin comentario, alarmas y choques con las garras, pasadas de más de 5 mm,
ciclo completo, herramientas usadas y dimensiones del bruto. La revisión no califica. Un `.json` de
la tarea se abre siempre en «★ Tarea 3». La sección se puede ocultar con `TAREA_CNC_PUBLICADA = false`
en [`src/unidades.ts`](src/unidades.ts).

**Para el informe.** Vista 2D de la trayectoria (plano Z-X en el torno, vista superior
en la fresadora) con la silueta y los puntos de cada bloque; **tabla de coordenadas**
en absolutas e incrementales (se copia con un clic); descarga del programa como
`.cnc`, del **trabajo completo** (programa, preparación y máquina) como `.json` desde
Exportar o Entregar —se vuelve a abrir con «Abrir…»—, de la trayectoria como PNG y
**grabación en video** de la vista 3D.

**Pantalla completa.** La vista 3D de CNC y de Robótica tiene su botón «⤢ Pantalla completa» (Esc para salir), como el banco 3D de Neumática y la planta del PLC.

**En el celular.** Los botones miden al menos 44 px, las pestañas se desplazan, «＋ Nuevo»
queda a la vista y, acostado, las pestañas van en la misma fila de herramientas para
dejarle alto al programa. La vista 3D se gira con un dedo (y, con mouse, también con la
rueda apretada).

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
