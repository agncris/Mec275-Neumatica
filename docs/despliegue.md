# Publicarlo para la clase

(Detalle movido desde el README. Las reglas para quien edita el repositorio están en [`CLAUDE.md`](../CLAUDE.md).)

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
