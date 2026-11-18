# MecLab: laboratorio virtual de neumática, PLC, CNC y robótica

**MEC275.** Aplicación web para el laboratorio del curso, con una pestaña por unidad. Todo el contenido y la interfaz están en español.

- **Unidad 1 · Neumática**: armar, modificar y simular circuitos neumáticos con simbología **ISO 1219-1**, pensada como gemelo digital del banco de prácticas. Detalle en [`docs/neumatica.md`](docs/neumatica.md).
- **Unidad 2 · PLC**: programar en **Ladder** y probar el programa contra una planta del laboratorio en 3D. Detalle en [`docs/plc.md`](docs/plc.md).
- **Unidad 3 · CNC**: escribir programas en **código G** y simular el mecanizado en un torno o una fresadora en 3D, sin instalar CNC Simulator Pro. Detalle en [`docs/cnc.md`](docs/cnc.md).
- **Unidad 4 · Robótica**: programar un robot KUKA con nodos (como Grasshopper + KUKA|prc) o con un mando manual, y simularlo en 3D con análisis y código KRL, sin Windows ni licencias. Detalle en [`docs/robotica.md`](docs/robotica.md).

La app no trae enunciados ni soluciones de las tareas. Cómo se entrega el trabajo está en [`docs/entrega.md`](docs/entrega.md).

## Cómo correrla

Requiere Node 20 o más (el CI usa Node 22).

```bash
npm install
npm run dev        # http://localhost:5173, con todas las unidades visibles
```

```bash
npm run build      # tsc y vite build, deja el sitio en /dist
npm test           # Vitest
npm run verificar  # tsc --noEmit y los tests (se corre antes de cada push)
npm run lint       # ESLint
```

Los tests corren en entorno `node`. Un test de componente usa el comentario `// @vitest-environment jsdom` al inicio del archivo.

## Estructura

```
/src
  /engine        motor neumático: grafo, solver, componentes y validación (lógica pura, con tests)
  /circuitos     ejemplos y método cascada
  /components    interfaz React compartida: pizarra, paleta, propiedades, entrega, MecBot, ui.tsx
  /symbols       símbolos ISO 1219-1 animados
  /realistic     vistas en corte de válvulas y cilindros
  /vista3d       base común de las escenas 3D (escena.ts), banco 3D de neumática, sonido y ViewCube
  /plc           unidad 2: motor Ladder, plantas 3D, editor y teoría
  /cnc           unidad 3: intérprete de código G, simulador, máquina 3D, editor y teoría
  /robot         unidad 4: cinemática KUKA, nodos, DXF, simulación, KRL, mando, guía de la tarea y teoría
  Raiz.tsx       portada: elige la unidad
  unidades.ts    banderas de publicación
  persistencia.ts  único archivo que toca localStorage
/api             función serverless de MecBot (la clave del modelo queda en el servidor)
/public          imágenes, planos y service worker (funciona sin conexión)
/docs            el detalle de cada unidad y del despliegue
server.js        servidor Express para producción con Docker
```

## Cómo publicar (o esconder) una unidad o una tarea

Las banderas están en [`src/unidades.ts`](src/unidades.ts). Cada una es una constante `true` o `false`:

- `CNC_PUBLICADA` y `ROBOTICA_PUBLICADA` publican o esconden la unidad entera.
- `TAREA_CNC_PUBLICADA` y `TAREA_ROBOTICA_PUBLICADA` publican o esconden la sección «★ Tarea» de esa unidad.

Lo escondido no entra en el sitio que se sube: el código ni siquiera se compila, y no hay forma de abrirlo con `?unidad=` ni con un enlace. Con `npm run dev` se ve todo, para revisarlo. Para publicar, se cambia el valor a `true` y se sube a `main`. No cambies estas banderas mientras haya una evaluación en curso sin avisar al profesor.

## Publicarlo para la clase

El sitio se despliega en Vercel desde `main` (el `vercel.json` ya fija la configuración) y el CI de GitHub corre lint, build y tests en cada push. También hay un `Dockerfile` para Railway o Render. Los pasos están en [`docs/despliegue.md`](docs/despliegue.md).

MecBot necesita la variable `MEC_BOT_API_KEY` en el servidor. Sin ella responde que no está disponible y el resto de la app funciona igual.

## Para quien edita el código

Las reglas del repositorio (idioma, qué correr antes de cada push, qué no tocar) están en [`CLAUDE.md`](CLAUDE.md). El diagnóstico y el plan de mejora vigente están en [`PLAN_MEJORA.md`](PLAN_MEJORA.md).
