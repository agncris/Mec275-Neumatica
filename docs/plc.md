# Unidad 2 · PLC

(Detalle movido desde el README. Las reglas para quien edita el repositorio están en [`CLAUDE.md`](../CLAUDE.md).)

## Unidad 2 · PLC

La pestaña **Unidad 2 · PLC** es un laboratorio de controladores lógicos
programables: se escribe el programa en Ladder, se pasa el PLC a **RUN** y el
programa mueve una planta en 3D, con sonido. Los sensores de la planta vuelven a las
entradas del PLC, así que un programa mal hecho se nota como en el laboratorio: el
estanque rebalsa, la plataforma choca con el vástago.

**Editor Ladder.** Las dos barras de tensión y los escalones, numerados como en el
apunte (000, 001…). Se elige una herramienta y se hace clic en la casilla: contacto
NA ┤ ├, NC ┤/├, cable, rama (une dos filas en un nodo para hacer un paralelo) y, en la
columna de la derecha, las bobinas de la tabla del apunte: normal ( ), inversa (/),
transición positiva (↑) y negativa (↓), Set (L) y Reset (U). La paleta trae sólo lo
que se ve en el curso (clases, tareas y controles): contactos y bobinas. El simulador
todavía entiende otras instrucciones (temporizadores, contadores, ONS, comparaciones,
MOV y operaciones) para abrir programas que ya las tengan, pero no se ofrecen.
Cada elemento lleva su dirección (`I0.0…I0.7`, `Q0.0…Q0.7`, marcas `M0.0…M1.7`) y se
muestra con su símbolo. Los símbolos se escriben en la pestaña **Entradas y salidas**:
con «＋ Agregar entrada» / «＋ Agregar salida» el alumno suma una fila, elige su dirección y
escribe su símbolo y su descripción. En la Tarea 2 la tabla parte vacía y la app no dice qué
hay en cada dirección: el alumno lo identifica en la máquina.
Ahí mismo se ve el estado en vivo de cada punto y se puede forzar. Las marcas se agregan
debajo. Con el PLC en RUN se ve la corriente: tramos con tensión en verde,
contactos cerrados rellenos y bobinas activas encendidas. La aplicación avisa de los errores típicos: un contacto
sin dirección, una bobina sobre una entrada, la misma salida con bobina en dos
escalones (manda la última).

**Notación de direcciones.** Por defecto, la del apunte y de las clases (`I0.3`, `Q0.1`,
`M0.1`); la autoevaluación y la ficha de repaso usan sólo esa. Quien use el
simulador LogixPro puede cambiarla en **Archivo** a la de **LogixPro / RSLogix** (`I:1/03`, `O:2/01`, `B3:0/1`,
`T4:0/DN`, `C5:0.ACC`); en esa notación las bobinas se rotulan L / U y RES. Cambia
todo a la vez: el diagrama, la tabla de entradas y salidas y los rótulos
de la planta 3D.

**Simulador de E/S.** Siempre están las 8
entradas y las 8 salidas: las que no usa la planta quedan libres, cada una con un
interruptor o un pulsador NA / NC para probar cualquier programa. Cada entrada o salida se puede **forzar** (F1 / F0),
como en el PLC real, con un aviso mientras haya algo forzado.

**Ciclo de scan.** El programa se ejecuta como en un PLC real, ~50 barridos por
segundo: lee las entradas, resuelve los escalones de arriba abajo (lo que escribe un
escalón ya lo lee el siguiente) y actualiza las salidas. En STOP las salidas quedan a 0.
Con el PLC en RUN, **❚❚ Pausar** congela el PLC y la planta y **⏭ Un barrido** ejecuta
un solo barrido: se cambian las entradas y se ve, escalón por escalón, qué resuelve el
PLC en ese barrido (el título muestra el número de barrido).

**Plantas** (el cableado es fijo, como en el banco; el alumno programa). La del
semáforo sigue en el código pero no se ofrece, porque necesita temporizadores:

| Planta | Entradas | Salidas |
|---|---|---|
| Tablero de pruebas | 4 pulsadores y 4 selectores (`I0.0…I0.7`) | 6 pilotos, zumbador y ventilador (`Q0.0…Q0.7`) |
| Estanque con dos electroválvulas | START, STOP y los flotadores S1 (abajo) y S2 (arriba) | V1 llenado, V2 vaciado |
| Elevador de piezas | S0 (pieza en la plataforma) y los finales de carrera S1…S4 de Z1 y Z2 | Y1 y Y2 (electroválvulas de Z1 y Z2) |
| Silo que llena cajas (Tarea 2) | START, STOP, PROX, LEVEL | MOTOR de la cinta, SOLENOID, pilotos RUN / FILL / FULL |
| Portón automático (como el *Door Simulator* de LogixPro) | ABRIR, CERRAR, PARO, finales de carrera arriba y abajo, fotocelda | SUBIR, BAJAR, pilotos abierto / cerrado / moviendo |

El silo no trae programa: es la planta para que la programes tú, en la sección
«Tarea 2» (no aparece en el selector de plantas del Laboratorio). Las plantas avisan
de los errores típicos: la caja que rebalsa o pasa sin llenar, el material que cae
sobre la cinta, el motor del portón con las dos
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
marcha y paro con autorretención y Set y Reset; además el portón con enclavamiento y
fotocelda. **＋ Nuevo programa** deja el editor en blanco con el cableado de la
planta elegida; el programa se guarda solo en el navegador y se puede descargar,
abrir y exportar como imagen para el informe.

**Teoría** (secciones plegables): qué es un PLC y para qué se usa, sus componentes,
entradas / salidas y direcciones, cómo elegirlo, los sensores, los símbolos Ladder
(contactos y bobinas, como en la tabla del apunte) y el ciclo de scan.

La unidad no incluye soluciones de evaluaciones: el silo viene como planta, sin programa.
