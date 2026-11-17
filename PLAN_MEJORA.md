# NeumaLab: diagnóstico y plan de mejora

Fecha del diagnóstico: 17 de noviembre de 2026, sobre `main` en `af53ea5`.
Este plan está escrito para que lo ejecute un agente (Sonnet) sin más contexto que este archivo y el repositorio.

## Reglas para quien ejecute el plan

1. Idioma: español de Chile, frases cortas. Sin guiones largos (— ni –) en textos, comentarios ni documentos.
2. Antes de cada push corre `npm run build` (incluye `tsc`) y `npm test`. Un error de tipos en un test ya rompió cuatro deploys seguidos de Vercel.
3. Después de cada push comprueba que el deploy de Vercel terminó bien (`gh api repos/:owner/:repo/deployments`).
4. Un commit por tarea del plan, subido a `main` al terminar (regla del repo en `.cursor/rules/pushear-cambios.mdc`).
5. No cambies comportamiento que ven los alumnos salvo que la tarea lo pida. Hay evaluaciones en curso (Control el 18-nov, Tarea 4 hasta el 23-nov). Las fases 1 y 2 son seguras para hacer ya. Las fases 3 a 5 conviene hacerlas después del 23-nov.
6. `salida/` es material privado del profesor. No lo subas ni lo cites en el repo público. Estudiar no lleva soluciones ni enunciados.
7. No cambies las banderas de `src/unidades.ts`.
8. Si una tarea resulta distinta a lo descrito aquí, detente y deja anotado lo que encontraste en vez de improvisar.
9. Marca cada tarea terminada en este archivo (`[x]`) con el hash del commit.

## Diagnóstico

### Lo que está bien

- 436 tests en 32 archivos, todos pasan. Los motores (neumática, ladder, código G, cinemática del robot, análisis de tareas) están bien cubiertos.
- Tipos estrictos: un solo `any` o `@ts-ignore` en todo `src` y `api`.
- Las unidades de PLC, CNC y Robótica y sus escenas 3D se cargan con `lazy`.
- Funciona sin conexión (service worker) y la clave del modelo de MecBot queda en el servidor.
- 294 usos de `aria-` o `role`: hay trabajo real de accesibilidad.

### Problemas, de mayor a menor impacto

| # | Problema | Evidencia | Riesgo |
|---|---|---|---|
| D1 | No hay CI. Nada impide subir a `main` algo que no compila. | No existe `.github/`. Cuatro deploys fallidos el 17-nov por un error de tipos en un test. | Alto: producción se queda en una versión vieja sin que nadie lo note. |
| D2 | No hay reglas escritas para agentes de Claude. | Solo existe `.cursor/rules/`. No hay `CLAUDE.md`. | Alto: cada agente redescubre las reglas (idioma, privado, build antes de push). |
| D3 | El paquete inicial es pesado. | `index` 418 kB (130 kB gzip). `viewcube` 597 kB (155 kB gzip): ahí quedó three.js completo, y lo arrastra cualquier escena 3D. Vite avisa de trozos de más de 500 kB. | Medio: primera carga lenta en celular y con datos. |
| D4 | Escenas 3D que dibujan aunque no se vean. | Ninguna escena usa `IntersectionObserver` ni se pausa con la pestaña oculta. Estudiar de Robótica tiene ahora 4 lienzos WebGL (TiposRobot y 3 demos), cada uno con su bucle a 60 fps y sombras de 4096 px. | Medio alto: batería, ventilador y posibles pérdidas de contexto WebGL en equipos modestos. |
| D5 | Componentes gigantes. | `Planta3D.tsx` 1818 líneas, `UnidadRobotica.tsx` 1747 (19 `useState`, 11 `useEffect`), `UnidadCNC.tsx` 1630, `UnidadPLC.tsx` 1441, `Pizarra.tsx` 1115. | Medio: cada cambio es lento y arriesgado. Dos agentes (Cursor y Claude) ya se pisaron en estos archivos. |
| D6 | Estilos sin sistema. | 910 `style={{…}}` en línea. 221 colores hex distintos en los `.tsx`. Solo 9 variables CSS. `#33475c` aparece 128 veces escrito a mano. | Medio: inconsistencia visual entre unidades y cambios de tema imposibles. |
| D7 | La interfaz no tiene tests. | Los 436 tests son de lógica. No hay ninguno que monte un componente ni un flujo de punta a punta. | Medio: los errores de interfaz (jerarquía de paneles, guía de la tarea) los encuentra el profesor a mano. |
| D8 | Errores que se tragan en silencio. | 74 `catch` vacíos. No hay ningún `ErrorBoundary`: un error en una unidad deja la página en blanco. | Medio. |
| D9 | MecBot: límites frágiles. | El cupo por IP y la caché viven en memoria de la función: en Vercel se reinician con cada instancia. No se valida el origen ni el tamaño del cuerpo en `api/mecbot.js`. El endpoint está duplicado en `api/mecbot.js`, `server.js` y `vite.config.ts`. | Medio: un tercero puede gastar la cuota de Groq. |
| D10 | Service worker con caché de nombre fijo. | `CACHE = 'neumalab-v1'` nunca cambia. Los `/assets` viejos no se borran nunca. | Bajo medio: el caché crece y un alumno puede quedar con piezas viejas. |
| D11 | Persistencia dispersa. | 38 usos directos de `localStorage` y 32 claves `neumalab.*` repartidas. Existe `persistencia.ts` pero no todos la usan. | Bajo medio. |
| D12 | Documentación desalineada. | `README.md` tiene 631 líneas y cifras de tests viejas. El enunciado de la Tarea 4 se corrigió a mano dos veces para seguir a la app. | Bajo. |
| D13 | Imágenes pesadas. | `plano-tarea4-robotica.png` 327 kB y `plano-tarea3-cnc.png` 194 kB sin optimizar. | Bajo. |
| D14 | Sin lint ni formato automático. | No hay ESLint ni Prettier. | Bajo, pero explica parte de D8. |

### Lo que no se revisó

- Rendimiento medido en un equipo lento o un celular real (solo se probó en un Mac).
- Accesibilidad con lector de pantalla y contraste real de colores.
- La unidad de Neumática y la de PLC en detalle de uso. El diagnóstico de esas dos es por métricas de código, no por recorrido de la interfaz.
- Uso real de los alumnos (no hay analítica).

## Plan

Cada tarea dice qué hacer, cómo comprobarlo y cuánto cuesta (S: menos de 1 hora, M: medio día, L: más de un día).

### Fase 1. Red de seguridad (hacer ya, sin riesgo para los alumnos)

- [x] **1.1 CI en GitHub Actions (S).** (commit `d555f98`) Crea `.github/workflows/ci.yml` que en cada push y PR a `main` corra `npm ci`, `npm run build` y `npm test` con Node 22. Comprobación: el flujo aparece en verde en GitHub para el commit que lo agrega.
- [x] **1.2 `CLAUDE.md` en la raíz (S).** (commit `b8035e6`) Copia ahí las reglas de este archivo (sección «Reglas»), más: cómo levantar la app (`npm run dev`, `.claude/launch.json`), qué es `salida/`, las banderas de `src/unidades.ts`, y la estructura de carpetas en diez líneas. Mantén también `.cursor/rules/` apuntando a `CLAUDE.md` para que haya una sola fuente.
- [x] **1.3 `ErrorBoundary` por unidad (S).** (commit `a2baf26`) En `src/Raiz.tsx`, envuelve cada unidad en un límite de error que muestre «Algo falló en esta unidad» con un botón «Recargar» y otro «Volver a Neumática», sin borrar el trabajo guardado. Comprobación: un test que monte el límite con un hijo que lanza y vea el mensaje (ver 1.5 para el entorno).
- [x] **1.4 Hook de pre-push (S).** (commit `da44162`) Agrega un script `npm run verificar` (`tsc --noEmit && vitest run`) y documenta en `CLAUDE.md` que se corre antes de cada push. No instales husky: basta el script y la regla.
- [x] **1.5 Entorno para tests de componentes (S).** (commit `9e1dde3`; jsdom 25 y testing-library entraron junto con 1.3, a2baf26; jsdom 25 y no 31 porque el 31 exige Node 22.22) Agrega `jsdom` y `@testing-library/react` como dependencias de desarrollo. Deja los tests actuales en entorno `node` y usa `// @vitest-environment jsdom` solo en los nuevos. Comprobación: un test de humo que monte `Raiz` y vea las cuatro pestañas de unidad.

### Fase 2. Rendimiento (seguro, se nota en celulares)

- [ ] **2.1 Pausar las escenas que no se ven (M).** Crea `src/vista3d/visible.ts` con una función `alVerse(elemento, alCambiar)` basada en `IntersectionObserver` y `document.visibilitychange`. Úsala en los bucles de `Robot3D.tsx`, `TiposRobot.tsx`, `Maquina3D.tsx`, `Planta3D.tsx` y `Banco3D.tsx`: si el lienzo no está en pantalla o la pestaña está oculta, el bucle no dibuja. Comprobación: en Estudiar de Robótica, con las herramientas del navegador, solo el lienzo visible llama a `render` (cuenta con un contador temporal o `renderer.info.render.frame`).
- [ ] **2.2 Dibujar solo cuando algo cambia (M).** En `Robot3D.tsx`, cuando no hay reproducción, ni arrastre de cámara, ni viruta viva, no llames a `render`. Usa una bandera `sucio` que se enciende con cambios de `vista.current`, eventos de `OrbitControls` y cambios de tamaño. Aplica lo mismo a `TiposRobot.tsx`. Comprobación: con la simulación en pausa, el uso de CPU de la pestaña baja a casi cero.
- [ ] **2.3 Sombras según el equipo (S).** En `Robot3D.tsx` el mapa de sombras es de 4096 px. Usa 2048 si `devicePixelRatio < 2` o si el ancho del lienzo es menor a 700 px, y en las demos de Estudiar (`sinDetalle`) usa 1024.
- [ ] **2.4 Partir three.js en su propio trozo (S).** En `vite.config.ts` agrega `build.rollupOptions.output.manualChunks` para dejar `three` y `three/examples` en un trozo `three`, y `three-viewport-gizmo` en otro. Comprobación: `npm run build` ya no avisa de trozos de más de 500 kB, o el único que pasa es `three`. Anota los tamaños antes y después en el commit.
- [ ] **2.5 Sacar Estudiar del trozo del laboratorio (M).** `UnidadRobotica` pesa 234 kB porque incluye la teoría, las preguntas y la ficha. Carga `TeoriaRobotica`, `FichaRobot` y `Demo3D` con `lazy` solo al entrar a Estudiar. Haz lo mismo en CNC (`TeoriaCNC`, `FichaCNC`) y PLC. Comprobación: el trozo de cada unidad baja al menos un 25 %.
- [ ] **2.6 Revisar qué hay en `index` (M).** 418 kB para la entrada es mucho. Usa `npx vite-bundle-visualizer` (sin dejarlo como dependencia) para ver qué pesa. Candidatos: `Pizarra.tsx`, `Simbolos.tsx`, `MecBot.tsx` y la teoría de Neumática. Lo que no haga falta para el primer dibujo, a `lazy`. Meta: entrada bajo 250 kB.
- [ ] **2.7 Imágenes (S).** Convierte los dos planos PNG de `public/` a WebP (o PNG optimizado con paleta) manteniendo el nombre referenciado, o cambia las referencias. Meta: menos de 100 kB cada uno, legibles al ampliar.
- [ ] **2.8 Service worker con versión (S).** Haz que el nombre de la caché incluya la versión del build (por ejemplo, un plugin mínimo de Vite que reemplace `__VERSION__` en `public/sw.js` por el hash del commit o la fecha). Al activar, borra las cachés viejas (eso ya está) y limita `/assets` a lo que el `index.html` actual referencia. Comprobación: tras dos builds seguidos, en Application › Cache Storage queda una sola caché.

### Fase 3. Orden del código (después del 23-nov)

La regla para partir archivos: mover, no reescribir. Cada extracción va en su commit, con los tests pasando, sin cambiar comportamiento.

- [ ] **3.1 `UnidadRobotica.tsx` (L).** Extrae a archivos propios en `src/robot/`: `PlanoTarea.tsx` (con `BarraEjemplo`), `PanelEntrega.tsx`, `Analisis.tsx`, `CodigoKRL.tsx`, `PanelParametros.tsx` y un hook `useReproduccion.ts` (tiempo, play, velocidad, grabación de video). Meta: el archivo principal bajo 700 líneas.
- [ ] **3.2 `UnidadCNC.tsx` y `UnidadPLC.tsx` (L).** Mismo criterio: paneles a archivos propios y un hook por unidad para la simulación. Meta: bajo 800 líneas cada uno.
- [ ] **3.3 `Planta3D.tsx` (L).** Separa la construcción de cada planta (silo, cinta, etc.) en `src/plc/plantas3d/<planta>.ts`, y deja en `Planta3D.tsx` solo el montaje de la escena y el bucle.
- [ ] **3.4 Una base común para las escenas 3D (M).** `Robot3D`, `Maquina3D`, `Planta3D`, `Banco3D` y `TiposRobot` repiten: crear el renderer, luces, entorno, `OrbitControls`, ViewCube, `ResizeObserver`, bucle y limpieza. Crea `src/vista3d/escena.ts` con `crearEscena(contenedor, opciones)` que devuelva `{ renderer, escena, camara, controles, alCuadro, destruir }` e incluya la pausa de 2.1. Migra una escena por commit, empezando por `TiposRobot` (la más simple).
- [ ] **3.5 Persistencia en un solo lugar (M).** Lista las 32 claves `neumalab.*` en `src/persistencia.ts` como constantes y reemplaza los 38 accesos directos a `localStorage` por `leer`/`guardar` de ese módulo (con `try/catch` adentro). Agrega un test que falle si aparece `localStorage.` fuera de `persistencia.ts`.
- [ ] **3.6 Un solo endpoint de MecBot (S).** `api/mecbot.js`, `server.js` y `vite.config.ts` repiten el manejo de la petición. Deja una función `atender(cuerpo, ip)` en `api/responder.js` que devuelva `{ status, json }` y úsala en los tres.
- [ ] **3.7 ESLint mínimo (M).** Agrega ESLint con `typescript-eslint` y `eslint-plugin-react-hooks`, solo con las reglas `no-empty` (para los 74 `catch` vacíos), `react-hooks/rules-of-hooks` y `react-hooks/exhaustive-deps` en aviso. Corrige los `catch` vacíos uno por uno: o un comentario que diga por qué se ignora, o un aviso al usuario. Súmalo al CI.

### Fase 4. Diseño coherente (después del 23-nov)

- [ ] **4.1 Variables de color y tipografía (M).** En `src/index.css` define variables para los colores que más se repiten (`--tinta: #33475c`, `--tinta-suave: #51606f`, `--azul: #1668c7`, `--borde: #c6ced6`, `--borde-suave: #e0e5eb`, `--verde: #0e7a43`, `--naranjo-aviso`, `--rojo-error`, fondos). Reemplaza los hex escritos a mano en los `.tsx` por `var(--…)`. Hazlo por unidad, un commit cada una, comparando capturas antes y después.
- [ ] **4.2 Clases para lo que se repite (L).** Los patrones más repetidos de `style={{…}}` (botón secundario, chip de estado, aviso verde, naranjo y rojo, fila de formulario, párrafo de ayuda) pasan a clases en `index.css` o a componentes en `src/components/ui`. Meta: bajar de 910 estilos en línea a menos de 400. No toques los estilos que dependen de datos (posiciones, anchos calculados).
- [ ] **4.3 Auditoría de contraste y foco (M).** Revisa con las herramientas del navegador el contraste de textos grises sobre gris y el foco visible con teclado en las cuatro unidades. Corrige lo que no llegue a 4,5:1.
- [ ] **4.4 Mismo esqueleto de tarea en las cuatro unidades (M).** Robótica ya tiene la guía de pasos que se marcan solos (`src/robot/guiaTarea.ts`) y la barra sobre las pestañas. Revisa si CNC, PLC y Neumática muestran su tarea igual (paso actual arriba, «te falta esto», lista completa plegada) y alinea lo que difiera, sin dar soluciones.

### Fase 5. Calidad a largo plazo

- [ ] **5.1 Tests de componentes de los flujos críticos (L).** Con el entorno de 1.5: entrar a cada unidad, cargar un ejemplo, la guía de la Tarea 4 avanza al agregar un bloque, «Ver el ejemplo» y «Volver a mi tarea» conservan el trabajo, y «Revisar» en Entregar muestra el checklist.
- [ ] **5.2 Prueba de humo de punta a punta (M).** Playwright con un solo recorrido por unidad contra `npm run preview`, corriendo en el CI. Sin WebGL si el entorno no lo tiene: la app ya tiene un camino `sinWebGL`.
- [ ] **5.3 MecBot más robusto (M).** En `api/mecbot.js`: rechaza cuerpos de más de 32 kB, exige `Content-Type: application/json` y comprueba que `Origin` sea el sitio propio (o localhost). Mueve el cupo por IP a algo que sobreviva entre instancias si Vercel KV o Upstash está disponible; si no, deja anotado el límite. Agrega tests de esos rechazos.
- [ ] **5.4 README corto (S).** Deja el `README.md` en menos de 200 líneas: qué es, cómo correrlo, estructura, cómo publicar una tarea y enlace a `CLAUDE.md`. El detalle por unidad pasa a `docs/`. Quita las cifras de tests escritas a mano.
- [ ] **5.5 Enunciados desde la app (M).** El texto de lo que se entrega en cada tarea está en la app y en documentos de Drive, y se desalinea. Define en un solo módulo (`src/tareas/entregables.ts`) qué se entrega en cada tarea, úsalo en la interfaz y agrega un script que lo imprima en Markdown para pegarlo en el enunciado.

## Orden recomendado

1. Hoy: 1.1, 1.2, 1.4 (no tocan la app).
2. Esta semana, con cuidado: 1.3, 1.5, 2.1, 2.3, 2.4, 2.7.
3. Después del 23-nov: el resto de la fase 2, luego 3.4 antes que 3.1 a 3.3 (la base común reduce lo que hay que partir), luego fases 4 y 5.

## Cómo saber que el plan funcionó

| Medida | Hoy | Meta |
|---|---|---|
| Deploys fallidos por errores de compilación | 4 el 17-nov | 0 (el CI los frena antes) |
| Trozo de entrada (`index`) | 418 kB | menos de 250 kB |
| Trozo más grande | 597 kB | solo `three`, sin aviso de Vite por otros |
| Lienzos WebGL dibujando fuera de pantalla | todos | ninguno |
| Archivo más largo | 1818 líneas | menos de 900 |
| Estilos en línea | 910 | menos de 400 |
| Colores hex distintos en `.tsx` | 221 | menos de 60 |
| `catch` vacíos sin comentario | 74 | 0 |
| Tests de interfaz | 0 | flujos críticos de las 4 unidades |
