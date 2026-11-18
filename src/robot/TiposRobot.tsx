/**
 * Galería de robots de base fija en 3D: cada uno con sus articulaciones
 * (R = rotacional, P = prismática) que se mueven con deslizadores, para ver
 * sus grados de libertad y cómo se mueven.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { calidadRender, entornoEstudio, fondoTaller, pisoHormigon, solSuave } from '../vista3d/realista'
import { crearEscena } from '../vista3d/escena'
import { INFO, TIPOS, armar, juntasEnTiempo, type Modelo, type Tipo } from './tiposRobotModelos'


export default function TiposRobot() {
  const [tipo, setTipo] = useState<Tipo>('scara')
  const [valores, setValores] = useState<Record<Tipo, number[]>>(
    () => Object.fromEntries(TIPOS.map((t) => [t, INFO[t].juntas.map((j) => j.valor)])) as Record<Tipo, number[]>,
  )
  const [animar, setAnimar] = useState(true)
  const contRef = useRef<HTMLDivElement>(null)
  const estado = useRef({ tipo, valores, animar })
  estado.current = { tipo, valores, animar }
  const info = INFO[tipo]

  useEffect(() => {
    const cont = contRef.current
    if (!cont) return
    const base = crearEscena(cont, {
      camara: { fov: 38, near: 10, far: 10000 },
      controles: { enableDamping: true },
      viewCube: {
        id: 'viewcube-tipos',
        alInicio: () => {
          cam.position.copy(inicio.pos)
          ctrl.target.copy(inicio.objetivo)
          ctrl.update()
        },
      },
      // Con «Mover solo» apagado y la cámara quieta no hay nada nuevo que dibujar.
      soloSiCambia: true,
    })
    if (!base) return
    const { renderer, escena, camara: cam, controles: ctrl } = base
    calidadRender(renderer)
    renderer.domElement.dataset.tiposRobot = 'si'
    const pm = entornoEstudio(renderer, escena, 0.9)
    escena.background = fondoTaller()
    escena.add(pisoHormigon(1100))
    const sol = solSuave()
    sol.position.set(-700, 1600, 900)
    Object.assign(sol.shadow.camera, { left: -1100, right: 1100, top: 1100, bottom: -1100, near: 10, far: 4200 })
    const relleno = new THREE.DirectionalLight(0xd5e2f4, 0.55)
    relleno.position.set(900, 600, -700)
    escena.add(sol, relleno, new THREE.HemisphereLight(0xf4f7fb, 0xc5ced8, 0.55))
    cam.position.set(1100, 900, 1300)
    ctrl.target.set(0, 280, 0)
    ctrl.update()
    const inicio = { pos: cam.position.clone(), objetivo: ctrl.target.clone() }
    let actual: ({ tipo: Tipo } & Modelo) | null = null
    let t = 0
    let firma = ''
    base.alCuadro(() => {
      const e = estado.current
      if (!actual || actual.tipo !== e.tipo) {
        if (actual) escena.remove(actual.g)
        const a = armar(e.tipo)
        escena.add(a.g)
        actual = { tipo: e.tipo, ...a }
      }
      t += 1 / 60
      const v = e.animar ? juntasEnTiempo(e.tipo, t) : e.valores[e.tipo]
      const f = `${e.tipo}|${e.animar ? 'anima' : v.join(',')}`
      if (e.animar || f !== firma) base.marcarSucio()
      firma = f
      actual.poner(v)
    })
    return () => {
      base.destruir()
      pm.dispose()
    }
  }, [])

  const chips = useMemo(
    () =>
      TIPOS.map((t) => (
        <button
          key={t}
          onClick={() => setTipo(t)}
          aria-pressed={tipo === t}
          style={{
            border: `2px solid ${tipo === t ? '#33475c' : '#c6ced6'}`,
            background: tipo === t ? 'var(--tinta)' : '#fff',
            color: tipo === t ? '#fff' : 'var(--tinta)',
            borderRadius: 999,
            padding: '0.25rem 0.8rem',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          {INFO[t].nombre}
        </button>
      )),
    [tipo],
  )

  return (
    <div data-tipos-robot="si">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{chips}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14, alignItems: 'start' }}>
        <div ref={contRef} style={{ width: '100%', height: 360, borderRadius: 8, overflow: 'hidden' }} />
        <div>
          <h3 style={{ margin: '0 0 4px', color: 'var(--tinta)' }}>
            {info.nombre} · {info.gdl} grados de libertad
          </h3>
          <p style={{ margin: '0 0 6px', lineHeight: 1.5 }}>{info.texto}</p>
          <p style={{ margin: '0 0 8px', lineHeight: 1.5 }}>
            <strong>Usos:</strong> {info.usos}
          </p>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.86rem', marginBottom: 6 }}>
            <input type="checkbox" checked={animar} onChange={(e) => setAnimar(e.target.checked)} /> Mover solo (desmárcalo para mover cada articulación)
          </label>
          {info.juntas.map((j, k) => (
            <label key={j.nombre} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 70px', gap: 6, alignItems: 'center', fontSize: '0.85rem', opacity: animar ? 0.5 : 1 }}>
              <span>
                <span
                  title={j.clase === 'R' ? 'Rotacional: gira' : 'Prismática: se desliza'}
                  style={{ display: 'inline-block', width: 18, textAlign: 'center', borderRadius: 4, background: j.clase === 'R' ? 'var(--azul)' : 'var(--verde)', color: '#fff', fontWeight: 700, marginRight: 5 }}
                >
                  {j.clase}
                </span>
                {j.nombre}
              </span>
              <input
                type="range"
                min={j.min}
                max={j.max}
                value={valores[tipo][k]}
                disabled={animar}
                onChange={(e) => setValores((v) => ({ ...v, [tipo]: v[tipo].map((x, i) => (i === k ? Number(e.target.value) : x)) }))}
              />
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {valores[tipo][k]} {j.unidad}
              </span>
            </label>
          ))}
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--tinta-tenue)' }}>
            <span style={{ background: 'var(--azul)', color: '#fff', borderRadius: 4, padding: '0 4px', fontWeight: 700 }}>R</span> rotacional (gira) ·{' '}
            <span style={{ background: 'var(--verde)', color: '#fff', borderRadius: 4, padding: '0 4px', fontWeight: 700 }}>P</span> prismática (se desliza)
            {tipo === 'delta' ? ' · en el delta los deslizadores mueven la plataforma; los brazos se calculan solos.' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
