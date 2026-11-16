// three-viewport-gizmo 2.2 declara dependencias que three 0.169 no publica.
// Solo hacen falta para que el chequeo de tipos resuelva los imports del .d.ts.
declare module 'utility-types' {
  export type DeepRequired<T> = T
}

declare module 'three/webgpu' {
  export class WebGPURenderer {
    domElement: HTMLCanvasElement
  }
}

declare module 'three/examples/jsm/Addons.js' {
  export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
}
