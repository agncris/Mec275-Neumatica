import React from 'react'
import ReactDOM from 'react-dom/client'
import Raiz from './Raiz'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Raiz />
  </React.StrictMode>,
)

// Sin conexión: el service worker guarda la app para usarla sin internet.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => {
        // Con la app ya cargada, se bajan también las otras unidades (y sus vistas 3D),
        // para que funcionen sin internet aunque todavía no se hayan abierto.
        const precargar = () => {
          void import('./plc/UnidadPLC')
          void import('./cnc/UnidadCNC')
          void import('./robot/UnidadRobotica')
          void import('./plc/Planta3D')
          void import('./cnc/Maquina3D')
          void import('./robot/Robot3D')
          void import('./robot/TiposRobot')
          void import('./vista3d/Banco3D')
        }
        const w = window as Window & { requestIdleCallback?: (f: () => void) => void }
        if (w.requestIdleCallback) w.requestIdleCallback(precargar)
        else setTimeout(precargar, 4000)
      })
      .catch(() => {
        /* sin service worker: la app funciona igual, pero sólo con conexión */
      })
  })
}
