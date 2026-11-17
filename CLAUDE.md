# NeumaLab (MEC275): reglas para agentes

App web del curso MEC275: React + Vite + TypeScript. Cuatro unidades: Neumática, PLC, CNC y Robótica. Se despliega en Vercel desde `main`. El repo es público.

Esta es la única fuente de reglas. `.cursor/rules/` apunta aquí.

## Reglas

1. Idioma: español de Chile, frases cortas. Sin guiones largos (— ni –) en textos, comentarios, commits ni documentos.
2. Antes de cada push corre `npm run verificar` (tipos y tests) y `npm run build`. Un error de tipos en un test ya rompió cuatro deploys seguidos de Vercel.
3. Después de cada push comprueba que el deploy de Vercel terminó bien: `gh api repos/:owner/:repo/deployments` y luego `.../deployments/<id>/statuses`. El estado debe ser `success`.
4. Un commit por cambio o tarea, subido a `main` al terminar. Mensaje en español, corto, que diga por qué. Usa `git add` solo de los archivos que tocaste (nunca `git add -A`). Sin `--no-verify`, `--force` ni amend salvo que lo pidan. No subas secretos (`.env`, credenciales).
5. No cambies comportamiento que ven los alumnos salvo que la tarea lo pida. Hay evaluaciones en curso.
6. `salida/` es material privado del profesor (soluciones de evaluaciones). Está en `.gitignore`: no lo subas ni lo cites en el repo público. Estudiar no lleva soluciones ni enunciados.
7. No cambies las banderas de `src/unidades.ts` (qué unidades y tareas se publican).
8. Si una tarea resulta distinta de lo descrito, detente y deja anotado lo que encontraste en vez de improvisar.
9. Si hay cambios sin commitear que no son tuyos (otra persona u otro agente), no los toques ni los incluyas. Haz `git pull --rebase` antes de cada commit.
10. El plan de mejora vigente está en `PLAN_MEJORA.md`. Marca cada tarea terminada con `[x]` y el hash del commit.

## Cómo correr la app

- `npm run dev` levanta Vite en el puerto 5173 (también hay `.claude/launch.json`). En dev se ven todas las unidades.
- `npm run build` hace `tsc` y `vite build`. `npm test` corre Vitest. `npm run verificar` corre `tsc --noEmit` y los tests.
- Los tests corren en entorno `node` (ver `vite.config.ts`). Para un test de componente usa el comentario `// @vitest-environment jsdom` al inicio del archivo; no cambies el entorno global.
- Si cambias `package.json`, sube también `package-lock.json`.

## Estructura

- `src/Raiz.tsx`: portada, elige la unidad. `src/App.tsx`: unidad 1 (Neumática).
- `src/engine/`: motor neumático. `src/circuitos/`: ejemplos y método cascada.
- `src/plc/`: unidad PLC (Ladder, plantas 3D). `src/cnc/`: unidad CNC (código G, máquinas 3D).
- `src/robot/`: unidad Robótica (nodos, cinemática, KRL, escena 3D, guía de la tarea).
- `src/vista3d/`: banco 3D de neumática, sonido, ViewCube. `src/components/`: piezas compartidas.
- `src/unidades.ts`: banderas de publicación. `src/persistencia.ts`: guardado en el navegador. Es el único archivo que toca `localStorage` y el único con claves `neumalab.*` (un test lo comprueba): para guardar algo usa `leerTexto`, `leerJson`, `guardarTexto`, `guardarJson`, `borrarClave` y agrega la clave a `CLAVES`.
- `src/__tests__/`, `src/engine/__tests__/`: tests de lógica.
- `api/`: función serverless de MecBot (la clave del modelo queda en el servidor). `public/`: imágenes y service worker.

## Cuidados con las escenas 3D

Las escenas están en `src/robot/Robot3D.tsx`, `src/robot/TiposRobot.tsx`, `src/cnc/Maquina3D.tsx`, `src/plc/Planta3D.tsx` y `src/vista3d/Banco3D.tsx`. Cuidado con: la grabación de video de la simulación (`captureStream` del canvas), la exportación de imagen (`preserveDrawingBuffer`), la viruta y el desbaste de la plancha (`src/robot/stock.ts`) y el ViewCube.
