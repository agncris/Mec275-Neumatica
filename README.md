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
5. **Observa.** Mientras simula tienes tres lecturas simultáneas del mismo circuito:
   - la **pizarra** con el esquema ISO (azul = con presión, guiones en movimiento = caudal),
   - la **vista en corte**, que muestra el interior real de la pieza que elijas,
   - el **diagrama espacio-fase**, con la secuencia A+ / A− de cada cilindro.
6. **Guarda o comparte.** *Guardar* descarga un `.json`, *Abrir* lo recupera y
   *Compartir* copia un enlace con el circuito dentro (no necesita servidor ni cuenta).
   Además la pizarra se conserva sola en el navegador entre sesiones.

**Atajos:** `Espacio` simular/detener · `Supr` borrar lo seleccionado · `Esc` cancelar cableado.

## Circuitos de ejemplo incluidos

| # | Circuito | Qué se practica |
|---|----------|-----------------|
| 1 | Cilindro de simple efecto con 3/2 | Mando directo, retorno por muelle |
| 2 | Doble efecto con 5/2 y regulador | Control de velocidad (estrangulación del escape) |
| 3 | 5/2 biestable con dos pulsadores | Memoria neumática, pilotaje 12/14 |
| 4 | Ciclo automático ida-vuelta | Finales de carrera de rodillo |
| 5 | Mando bimanual | Válvula de simultaneidad «Y», seguridad |
| 6 | Encadenar dos cilindros | Final de carrera que pilota otra válvula |

## Biblioteca de componentes

- **Fuente:** compresor + unidad de mantenimiento FRL, presión regulable 2–8 bar con manómetro.
- **Actuadores:** cilindro de simple efecto (retorno por muelle) y de doble efecto.
- **Distribuidoras:** 3/2 NC y NA, 4/2 y 5/2 en versión monoestable (muelle) y biestable
  (memoria), con accionamiento por pulsador o pilotaje neumático (12 / 14).
- **Finales de carrera** de rodillo, accionados por el vástago del cilindro que se les asigne.
- **Auxiliares:** regulador de caudal unidireccional, válvula selectora «O», válvula de
  simultaneidad «Y», válvula de escape rápido y temporizador neumático.

## Vistas en corte

Cada válvula y cada cilindro se pueden ver en sección, al estilo de las láminas de clase:
cuerpo gris de fundición (naranja en los cilindros), **aire azul intenso = a presión**,
**celeste = comunicado con la atmósfera**, juntas rojas, muelles helicoidales y partes
móviles animadas. Los colores salen de las presiones reales del motor, así que el corte
nunca puede contradecir a la simulación. En modo *Editar* cada pieza se puede accionar
por separado para explorarla antes de montar nada.

---

## Cómo funciona por dentro (para el docente)

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
npm test           # 71 pruebas del motor y de la persistencia
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
