# La entrega

(Detalle movido desde el README. Las reglas para quien edita el repositorio están en [`CLAUDE.md`](../CLAUDE.md).)

## La entrega

La aplicación no trae enunciados ni soluciones: el enunciado y la plantilla (PPT) los
reparte el profesor. El alumno responde en la plantilla, la guarda como PDF y la sube
en Aula junto con el archivo `.json` de su trabajo. En PLC y CNC la tarea tiene su propia
sección (**«★ Tarea 2»** con la planta del silo, **«★ Tarea 3»** con el torno y el plano de la pieza;
junto a Laboratorio); los botones **«Entregar Tarea PLC»** y **«Entregar Tarea CNC»** aparecen
sólo dentro de ellas. El botón de entrega (arriba a la
derecha) abre un cajón con cuatro pasos:

1. **Tus datos**: nombre (y el de la pareja, si hay) y el trabajo. Todos los archivos
   salen con el nombre que piden los enunciados: `Nombre_Apellido_Tarea-2`.
2. **Revisa tu trabajo**: avisa de lo que conviene arreglar antes de entregar (piezas
   sueltas, líneas de código sin comentario, alarmas, E/S forzadas…). No corrige ni
   califica.
3. **Para pegar en tu presentación**: imágenes en PNG y tablas que se copian y se pegan
   en PowerPoint como tabla.
4. **Archivos que subes junto con tu PDF**: el archivo de la app (que se vuelve a abrir
   y a simular) y, en CNC y Robótica, el video de la simulación.

| Unidad | Para la presentación | Archivos |
|---|---|---|
| Neumática | Diagrama VDI 2860 (se arma en el mismo cajón), diagrama espacio-fase, elementos del circuito, imagen del circuito | Circuito `.json` |
| PLC (Tarea 2) | Diagrama Ladder, tabla de entradas y salidas | Programa `.json` |
| CNC (Tarea 3) | Trayectoria con los puntos, tabla de coordenadas, herramientas usadas, bruto | Trabajo `.json` (programa, preparación y torreta), video; el programa `.cnc` es opcional (se abre también en CNC Simulator Pro) |
| Robótica (Tarea 4) | Croquis de la pieza, posicionamiento, definición de nodos, ficha técnica (se pegan en la plantilla PPT) | Definición `.json` y video. El PDF es la plantilla completada. El KRL queda en Exportar y no se sube |

Las entregas `.json` de semestres anteriores (con respuestas escritas) se siguen
abriendo.

Para informes con imágenes, la barra superior descarga:

| Botón | Qué produce |
|-------|-------------|
| **Circuito (PNG / SVG)** | La imagen del circuito, en mapa de bits o vectorial |
| **Diagrama de fase (PNG)** | El recorrido-tiempo con la secuencia A+ / A− ya marcada |
| **Guardar** | El `.json` sólo del circuito, sin respuestas |
| **Compartir** | Un enlace con el circuito dentro, para consultar dudas |
