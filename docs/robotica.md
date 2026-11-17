# Unidad 4 · Robótica

(Detalle movido desde el README. Las reglas para quien edita el repositorio están en [`CLAUDE.md`](../CLAUDE.md).)

## Unidad 4 · Robótica

**Tarea 4.** La sección **«★ Tarea Robótica»** (junto a Laboratorio) parte con robot, herramienta (fresa de 5 mm) y Core (plancha de 5 mm), con el **plano de la tarea ya cargado**: una pieza de soporte de motor de 250 x 250 mm, con el contorno en la capa CONTORNO y las nueve aberturas en la capa RANURAS (mm, `public/plano-tarea4-robotica.dxf`). «Abrir DXF» queda deshabilitado en la tarea. La pestaña **Plano** muestra la lámina del enunciado. No trae solución. **«Entregar Tarea Robótica»** sólo aparece ahí; su revisión (no califica) avisa si el plano está sin modificar, si la herramienta es la fresa de 5 mm, el espesor, si el husillo se enciende antes de cortar, si se acerca y se aleja con PTP, si la fresa atraviesa la plancha, cuántos de los 10 trazos recorre con la fresa compensada y si falta el nombre. El `.json` lleva la marca de la tarea y el nombre del alumno. Se muestra con `TAREA_ROBOTICA_PUBLICADA = true` en [`src/unidades.ts`](src/unidades.ts) (con `npm run dev` se ve siempre).

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

**Practicar** (en el mismo menú «Ejemplos…»): tres ejercicios de la Clase 2 (un arco con CIR, el orden con Command Weaver, AXIS y KRL a mano), cinco fallas para diagnosticar (A a E) y la figura de una pregunta del control (una definición mal conectada). Cada uno se abre con un clic y muestra una línea de enunciado; las fallas sólo dicen «Esta definición tiene un problema. Encuéntralo.» Dos de las fallas (C: el husillo nunca se enciende; D: una ranura sin compensar) la app no las marca: se encuentran leyendo el código KRL. En ★ Tarea Robótica sí hay un aviso naranjo si la fresa corta con el husillo apagado o si el husillo queda encendido al terminar (no en los ejercicios, para no regalar esas fallas). Las definiciones están en [`ejercicios-clase2/`](ejercicios-clase2/).

**Ejemplos** (de estudio): estructura básica en NeumaLab; acercarse y alejarse con PTP;
fresado de una placa desde un DXF de práctica (contorno compensado, taladrado de
agujeros con Command Weaver intercalado y husillo). El KRL de los ejemplos lleva una
frase por línea. **Teoría**: robot industrial (Devol, teach-in/playback), fabricación
en serie frente a robótica, tipos, componentes, grados de libertad y singularidades,
ficha técnica y programación paramétrica en NeumaLab (bloques Curve, LIN, PTP y Core).
En la tarea el KRL se exporta y no se sube a Aula: a Aula van el PDF, el json y el video.

La unidad no incluye enunciados, planos ni soluciones de evaluaciones.
