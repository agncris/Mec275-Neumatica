/**
 * Programas de ejemplo de la unidad de CNC, comentados línea a línea como se
 * pide en el curso. Son ejemplos de práctica: no corresponden a ninguna
 * evaluación.
 */
import type { ConfigCNC, TipoMaquina } from './maquinas'

export interface EjemploCNC {
  id: string
  titulo: string
  maquina: TipoMaquina
  resumen: string
  /** Preparación que necesita (bruto y material). */
  config: Partial<Omit<ConfigCNC, 'maquina'>>
  codigo: string
}

const BRUTO_TORNO = { torno: { diametro: 40, largo: 90, agarre: 25, sobremetal: 1 }, material: 'laton' }
const BRUTO_FRESA = { fresa: { largo: 100, ancho: 80, alto: 20 }, material: 'aluminio' }

export const EJEMPLOS_CNC: EjemploCNC[] = [
  {
    id: 'torno-cilindrado',
    titulo: 'Torno 1 · Refrentado y cilindrado',
    maquina: 'torno',
    resumen: 'Refrenta la cara y baja de Ø40 a Ø30 en dos pasadas de 5 mm, con un chaflán en la punta.',
    config: BRUTO_TORNO,
    codigo: `%
( Refrentado y cilindrado: de Ø40 a Ø30 en 30 mm )
( Bruto: latón Ø40 x 90 mm. Cero pieza en la cara, sobre el eje )
N10 G21 G90 G94          ( milímetros, absolutas, avance en mm/min )
N20 T0101                ( T1: desbaste izquierda )
N30 M03 S1500            ( husillo horario a 1500 rpm )
N40 G00 X44 Z0           ( acercarse al frente sin tocar )
N50 G01 X0 F120          ( refrentado: la cara queda en Z0 )
N60 G00 X44 Z2           ( salir de la cara )
N70 G00 X35              ( pasada 1: Ø35, quita 5 mm en diámetro )
N80 G01 Z-30 F250        ( cilindrado hacia el plato )
N90 G00 X42              ( retirar la herramienta )
N100 G00 Z2              ( volver al inicio )
N110 G00 X30             ( pasada 2: Ø30 )
N120 G01 Z-30 F250       ( cilindrado hasta el resalte )
N130 G01 X42             ( subir por el resalte y salir )
N140 G00 Z1              ( delante de la cara )
N150 G00 X26             ( inicio del chaflán )
N160 G01 X30 Z-1 F150    ( chaflán de 1 x 45° )
N170 G00 X42             ( retirar )
N180 G28                 ( volver a la posición de referencia )
N190 M05                 ( parar el husillo )
N200 M30                 ( fin de programa )
%
`,
  },
  {
    id: 'torno-eje',
    titulo: 'Torno 2 · Eje escalonado con ranura y tronzado',
    maquina: 'torno',
    resumen: 'Desbaste en pasadas de 4 mm, afinado con la herramienta de perfilar, ranura de alivio y tronzado final.',
    config: BRUTO_TORNO,
    codigo: `%
( Eje escalonado: Ø24 / Ø32 / Ø36 y largo 50 mm )
( Bruto: latón Ø40 x 90 mm; las garras toman 25 mm )
N10 G21 G90 G94          ( milímetros, absolutas, mm/min )
N20 G28                  ( partir desde la referencia )
N30 T0101                ( T1: desbaste izquierda )
N40 M03 S1500            ( husillo horario a 1500 rpm )
N50 G00 X44 Z0           ( frente de la pieza )
N60 G01 X0 F120          ( refrentado hasta el centro )
N70 G00 X44 Z2           ( salir )
( --- Desbaste: pasadas de 4 mm en diámetro --- )
N80 G00 X36              ( pasada 1: Ø36 )
N90 G01 Z-55 F250        ( hasta pasar la zona de tronzado )
N100 G00 X42             ( retirar )
N110 G00 Z2              ( volver )
N120 G00 X32             ( pasada 2: Ø32 )
N130 G01 Z-35            ( largo del escalón Ø32 )
N140 G01 X37             ( subir por el resalte )
N150 G00 Z2              ( volver )
N160 G00 X28             ( pasada 3: Ø28 )
N170 G01 Z-15            ( largo del escalón Ø24 )
N180 G01 X33             ( subir )
N190 G00 Z2              ( volver )
N200 G00 X25             ( pasada 4: Ø25, deja 0,5 mm para afinar )
N210 G01 Z-15            ( hasta el escalón )
N220 G01 X29             ( subir )
N230 G00 Z2              ( volver )
( --- Afinado del contorno --- )
N240 G28                 ( a la referencia para cambiar herramienta )
N250 T0707               ( T7: perfilado 35° )
N260 G00 X22 Z2          ( acercarse al chaflán )
N270 G01 Z0 F150         ( llegar a la cara )
N280 G01 X24 Z-1         ( chaflán 1 x 45° )
N290 G01 Z-15            ( Ø24 terminado )
N300 G01 X32             ( frente del escalón )
N310 G01 Z-35            ( Ø32 terminado )
N320 G01 X36             ( frente del escalón )
N330 G00 X44             ( salir )
N340 G28                 ( a la referencia )
( --- Ranura de alivio y tronzado --- )
N350 T0909               ( T9: tronzado 4 mm, punto = esquina derecha )
N360 M03 S800            ( menos velocidad para ranurar )
N370 G00 X28 Z-11        ( la hoja ocupa de Z-15 a Z-11 )
N380 G01 X20 F80         ( ranura hasta Ø20 )
N390 G01 X28             ( salir de la ranura )
N400 G00 X42             ( retirar )
N410 G00 Z-50            ( posición de tronzado: largo 50 mm )
N420 G01 X0 F80          ( tronzado: la pieza se separa )
N430 G00 X44             ( retirar )
N440 G28                 ( a la referencia )
N450 M05                 ( parar el husillo )
N460 M30                 ( fin de programa )
%
`,
  },
  {
    id: 'torno-pomo',
    titulo: 'Torno 3 · Pomo con arcos (G02 / G03)',
    maquina: 'torno',
    resumen: 'Punta semiesférica con G03 y garganta cóncava con G02, desbastadas en pasadas y luego afinadas.',
    config: BRUTO_TORNO,
    codigo: `%
( Pomo: punta esférica R15 y garganta R10 )
( En el torno, con Z a la derecha y X hacia arriba: G02 horario, G03 antihorario )
N10 G21 G90 G94          ( milímetros, absolutas, mm/min )
N20 T0101                ( T1: desbaste izquierda )
N30 M03 S1500            ( husillo horario a 1500 rpm )
N40 G00 X44 Z0           ( frente )
N50 G01 X0 F120          ( refrentado )
N60 G00 X44 Z2           ( salir )
N70 G00 X35              ( pasada 1: Ø35 )
N80 G01 Z-50 F250        ( cilindrado )
N90 G00 X42              ( retirar )
N100 G00 Z2              ( volver )
N110 G00 X30             ( pasada 2: Ø30 )
N120 G01 Z-50            ( cilindrado )
N130 G00 X42             ( retirar )
( --- Desbaste de la esfera: arcos concéntricos cada 2 mm --- )
N140 G00 Z6              ( delante de la cara )
N145 G00 X0              ( sobre el eje )
N150 G03 X42 Z-15 R21    ( arco de R21 )
N160 G00 Z4              ( volver )
N170 G00 X0              ( al eje )
N180 G03 X38 Z-15 R19    ( arco de R19 )
N190 G00 Z2              ( volver )
N200 G00 X0              ( al eje )
N210 G03 X34 Z-15 R17    ( arco de R17 )
N220 G00 X42             ( retirar )
( --- Afinado con la herramienta de perfilar --- )
N230 G28                 ( a la referencia )
N240 T0707               ( T7: perfilado 35° )
N250 G00 X0 Z4           ( frente al eje, sin tocar )
N260 G01 Z0 F120         ( tocar la cara en el centro )
N270 G03 X30 Z-15 R15    ( media esfera de R15 )
N280 G01 Z-22            ( tramo recto Ø30 )
N290 G02 X30 Z-38 R14    ( garganta: desbaste con R14 )
N300 G01 Z-22            ( volver por el tramo )
N310 G02 X30 Z-38 R10    ( garganta terminada con R10 )
N320 G01 Z-45            ( tramo recto final )
N330 G00 X44             ( salir )
N340 G28                 ( a la referencia )
( --- Tronzado --- )
N350 T0909               ( T9: tronzado 4 mm )
N360 M03 S800            ( menos velocidad )
N370 G00 X42 Z-45        ( posición de corte: largo 45 mm )
N380 G01 X0 F80          ( tronzado )
N390 G00 X44             ( retirar )
N400 G28                 ( a la referencia )
N410 M05                 ( parar el husillo )
N420 M30                 ( fin )
%
`,
  },
  {
    id: 'torno-buje',
    titulo: 'Torno 4 · Buje taladrado',
    maquina: 'torno',
    resumen: 'Punto de centro, taladrado con salidas para botar la viruta y tronzado: queda un buje con agujero pasante.',
    config: BRUTO_TORNO,
    codigo: `%
( Buje: Ø36 exterior, agujero de Ø10 y largo 30 mm )
N10 G21 G90 G94          ( milímetros, absolutas, mm/min )
N20 T0101                ( T1: desbaste izquierda )
N30 M03 S1500            ( husillo horario a 1500 rpm )
N40 G00 X44 Z0           ( frente )
N50 G01 X0 F120          ( refrentado )
N60 G00 X36 Z2           ( pasada a Ø36 )
N70 G01 Z-36 F250        ( cilindrado )
N80 G00 X42              ( retirar )
N90 G28                  ( a la referencia )
N100 T1010               ( T10: broca de centro Ø4 )
N110 M03 S1200           ( velocidad para taladrar )
N120 G00 X0 Z2           ( sobre el eje )
N130 G01 Z-3 F60         ( punto de centro )
N140 G00 Z2              ( salir )
N150 G28                 ( a la referencia )
N160 T0808               ( T8: broca Ø10 )
N170 G00 X0 Z2           ( sobre el eje )
N180 G01 Z-12 F60        ( primera entrada )
N190 G00 Z2              ( salir a botar la viruta )
N200 G00 Z-11            ( volver cerca del fondo )
N210 G01 Z-24            ( segunda entrada )
N220 G00 Z2              ( salir )
N230 G00 Z-23            ( volver cerca del fondo )
N240 G01 Z-37            ( pasar el largo del buje )
N250 G00 Z2              ( salir )
N260 G28                 ( a la referencia )
N270 T0909               ( T9: tronzado 4 mm )
N280 M03 S800            ( menos velocidad )
N290 G00 X40 Z-30        ( posición de corte: largo 30 mm )
N300 G01 X8 F80          ( tronzado: al llegar al agujero el buje cae )
N310 G00 X44             ( retirar )
N320 G28                 ( a la referencia )
N330 M05                 ( parar el husillo )
N340 M30                 ( fin )
%
`,
  },
  {
    id: 'fresa-cuadrado',
    titulo: 'Fresadora 1 · Contorno cuadrado',
    maquina: 'fresadora',
    resumen: 'El programa de la guía: un cuadrado de 50 mm fresado a 2 mm de profundidad.',
    config: BRUTO_FRESA,
    codigo: `%
( Fresado de un cuadrado de 50 x 50 mm, 2 mm de profundidad )
( Cero pieza: esquina delantera izquierda de la cara superior )
N10 G21 G90 G40          ( milímetros, absolutas, sin compensación )
N20 T1 M06               ( fresa plana Ø10 )
N30 G00 Z5               ( subir a una altura segura )
N40 G00 X20 Y15          ( ir al punto de inicio )
N50 M03 S1500            ( encender el husillo a 1500 rpm )
N60 G01 Z-2 F100         ( bajar a cortar: 2 mm )
N70 G01 X70 F200         ( lado delantero )
N80 G01 Y65              ( lado derecho )
N90 G01 X20              ( lado trasero )
N100 G01 Y15             ( lado izquierdo: cierra el cuadrado )
N110 G00 Z5              ( subir la herramienta )
N120 M05                 ( apagar el husillo )
N130 M30                 ( fin de programa )
%
`,
  },
  {
    id: 'fresa-arcos',
    titulo: 'Fresadora 2 · Círculo y arcos (G02 / G03)',
    maquina: 'fresadora',
    resumen: 'Un círculo completo con G02 e I/J y un arco con G03 y R.',
    config: BRUTO_FRESA,
    codigo: `%
( Círculo completo y arco: centro con I/J o radio con R )
N10 G21 G90 G17          ( milímetros, absolutas, plano XY )
N20 T2 M06               ( fresa plana Ø6 )
N30 M03 S2500            ( husillo a 2500 rpm )
N40 G00 X25 Y40 Z5       ( sobre el punto de partida del círculo )
N50 G01 Z-2 F100         ( bajar 2 mm )
N60 G02 X25 Y40 I25 J0 F250 ( círculo completo horario, centro en X50 Y40 )
N70 G00 Z5               ( subir )
N80 G00 X40 Y40          ( inicio del arco )
N90 G01 Z-4 F100         ( bajar 4 mm )
N100 G03 X60 Y40 R10 F250 ( media vuelta antihoraria de radio 10 )
N110 G00 Z5              ( subir )
N120 G28                 ( a la referencia )
N130 M05                 ( parar el husillo )
N140 M30                 ( fin )
%
`,
  },
  {
    id: 'fresa-incremental',
    titulo: 'Fresadora 3 · Agujeros en línea (G91)',
    maquina: 'fresadora',
    resumen: 'Coordenadas incrementales: el mismo movimiento se repite para cada agujero.',
    config: BRUTO_FRESA,
    codigo: `%
( Cinco agujeros cada 17,5 mm usando coordenadas incrementales )
N10 G21 G90              ( milímetros, absolutas para ubicarse )
N20 T5 M06               ( broca Ø8 )
N30 M03 S1200            ( husillo a 1200 rpm )
N40 G00 X15 Y40 Z5       ( sobre el primer agujero )
N50 G91                  ( desde aquí: incrementales )
N60 G01 Z-15 F80         ( taladrar 10 mm bajo la cara )
N70 G00 Z15              ( salir )
N80 G00 X17.5            ( al siguiente agujero )
N90 G01 Z-15             ( taladrar )
N100 G00 Z15             ( salir )
N110 G00 X17.5           ( siguiente )
N120 G01 Z-15            ( taladrar )
N130 G00 Z15             ( salir )
N140 G00 X17.5           ( siguiente )
N150 G01 Z-15            ( taladrar )
N160 G00 Z15             ( salir )
N170 G00 X17.5           ( último )
N180 G01 Z-15            ( taladrar )
N190 G00 Z15             ( salir )
N200 G90                 ( de vuelta a absolutas )
N210 G28                 ( a la referencia )
N220 M05                 ( parar el husillo )
N230 M30                 ( fin )
%
`,
  },
  {
    id: 'fresa-cajera',
    titulo: 'Fresadora 4 · Cajera en dos niveles',
    maquina: 'fresadora',
    resumen: 'Vaciado de una cajera de 40 x 30 mm en zigzag, bajando 2 mm por nivel.',
    config: BRUTO_FRESA,
    codigo: `%
( Cajera de 40 x 30 x 4 mm con fresa Ø6: centro de la fresa a 3 mm del borde )
N10 G21 G90 G17          ( milímetros, absolutas, plano XY )
N20 T2 M06               ( fresa plana Ø6 )
N30 M03 S2500            ( husillo a 2500 rpm )
N40 M08                  ( refrigerante )
( --- Nivel 1: Z-2 --- )
N50 G00 X33 Y28 Z2       ( sobre la esquina de la cajera )
N60 G01 Z-2 F80          ( bajar al nivel 1 )
N70 G01 X67 F300         ( pasada en X )
N80 G01 Y32              ( correrse 4 mm )
N90 G01 X33              ( pasada de vuelta )
N100 G01 Y36             ( correrse )
N110 G01 X67             ( pasada )
N120 G01 Y40             ( correrse )
N130 G01 X33             ( pasada )
N140 G01 Y44             ( correrse )
N150 G01 X67             ( pasada )
N160 G01 Y48             ( correrse )
N170 G01 X33             ( pasada )
N180 G01 Y52             ( correrse )
N190 G01 X67             ( pasada )
N200 G01 Y28             ( repaso del borde derecho )
N210 G01 X33             ( borde delantero )
N220 G01 Y52             ( borde izquierdo )
N230 G01 X67             ( borde trasero )
N240 G00 Z2              ( subir )
( --- Nivel 2: Z-4 --- )
N250 G00 X33 Y28         ( a la esquina )
N260 G01 Z-4 F80         ( bajar al nivel 2 )
N270 G01 X67 F300        ( pasada en X )
N280 G01 Y32             ( correrse 4 mm )
N290 G01 X33             ( pasada de vuelta )
N300 G01 Y36             ( correrse )
N310 G01 X67             ( pasada )
N320 G01 Y40             ( correrse )
N330 G01 X33             ( pasada )
N340 G01 Y44             ( correrse )
N350 G01 X67             ( pasada )
N360 G01 Y48             ( correrse )
N370 G01 X33             ( pasada )
N380 G01 Y52             ( correrse )
N390 G01 X67             ( pasada )
N400 G01 Y28             ( repaso del borde derecho )
N410 G01 X33             ( borde delantero )
N420 G01 Y52             ( borde izquierdo )
N430 G01 X67             ( borde trasero )
N440 G00 Z5              ( subir )
N450 M09                 ( apagar refrigerante )
N460 G28                 ( a la referencia )
N470 M05                 ( parar el husillo )
N480 M30                 ( fin )
%
`,
  },
  {
    id: 'fresa-ciclos',
    titulo: 'Fresadora 5 · Ciclos de taladrado G81 / G83',
    maquina: 'fresadora',
    resumen: 'Cuatro agujeros con G81 y uno profundo con picoteo G83: el ciclo se repite en cada X/Y.',
    config: BRUTO_FRESA,
    codigo: `%
( Ciclos fijos: basta dar X/Y de cada agujero )
N10 G21 G90              ( milímetros, absolutas )
N20 T6 M06               ( broca Ø5 )
N30 M03 S1500            ( husillo a 1500 rpm )
N40 G00 X20 Y20 Z10      ( sobre el primer agujero )
N50 G99 G81 X20 Y20 Z-8 R2 F80 ( ciclo G81: baja a Z-8, sube a R2 )
N60 X80                  ( segundo agujero, mismo ciclo )
N70 Y60                  ( tercero )
N80 X20                  ( cuarto )
N90 G80                  ( cancelar el ciclo )
N100 G98 G83 X50 Y40 Z-16 R2 Q4 F80 ( G83: picoteo de 4 mm, vuelve al plano inicial )
N110 G80                 ( cancelar el ciclo )
N120 G28                 ( a la referencia )
N130 M05                 ( parar el husillo )
N140 M30                 ( fin )
%
`,
  },
  {
    id: 'fresa-grabado',
    titulo: 'Fresadora 6 · Grabado «MEC»',
    maquina: 'fresadora',
    resumen: 'Letras grabadas con una fresa en V: rectas con G01 y la C con un arco G03.',
    config: BRUTO_FRESA,
    codigo: `%
( Grabado de las letras MEC a 1 mm de profundidad )
N10 G21 G90 G17          ( milímetros, absolutas, plano XY )
N20 T7 M06               ( fresa de grabado en V 90° )
N30 M03 S6000            ( husillo rápido para grabar )
( --- Letra M --- )
N40 G00 X10 Y25 Z2       ( pie izquierdo de la M )
N50 G01 Z-1 F100         ( entrar 1 mm )
N60 G01 Y55 F400         ( trazo vertical )
N70 G01 X20 Y40          ( diagonal hacia el centro )
N80 G01 X30 Y55          ( diagonal hacia arriba )
N90 G01 Y25              ( trazo vertical derecho )
N100 G00 Z2              ( levantar )
( --- Letra E --- )
N110 G00 X58 Y55         ( esquina superior derecha de la E )
N120 G01 Z-1 F100        ( entrar )
N130 G01 X40 F400        ( trazo superior )
N140 G01 Y25             ( trazo vertical )
N150 G01 X58             ( trazo inferior )
N160 G00 Z2              ( levantar )
N170 G00 X40 Y40         ( trazo del medio )
N180 G01 Z-1 F100        ( entrar )
N190 G01 X54 F400        ( trazo del medio )
N200 G00 Z2              ( levantar )
( --- Letra C: arco antihorario de 270° con centro en X80 Y40 --- )
N210 G00 X90.607 Y50.607 ( extremo superior de la C )
N220 G01 Z-1 F100        ( entrar )
N230 G03 X90.607 Y29.393 I-10.607 J-10.607 F400 ( arco de radio 15 )
N240 G00 Z5              ( levantar )
N250 G28                 ( a la referencia )
N260 M05                 ( parar el husillo )
N270 M30                 ( fin )
%
`,
  },
]

/** Programa en blanco para empezar, según la máquina. */
export function programaNuevo(maquina: TipoMaquina): string {
  return maquina === 'torno'
    ? `%
( Mi programa de torno )
N10 G21 G90 G94          ( milímetros, absolutas, mm/min )
N20 T0101                ( herramienta 1 )
N30 M03 S1500            ( husillo horario a 1500 rpm )
N40 G00 X44 Z2           ( acercarse sin tocar )

N900 G28                 ( volver a la referencia )
N910 M05                 ( parar el husillo )
N920 M30                 ( fin de programa )
%
`
    : `%
( Mi programa de fresadora )
N10 G21 G90 G17          ( milímetros, absolutas, plano XY )
N20 T1 M06               ( herramienta 1 )
N30 M03 S1500            ( husillo a 1500 rpm )
N40 G00 X0 Y0 Z5         ( sobre el cero pieza )

N900 G28                 ( volver a la referencia )
N910 M05                 ( parar el husillo )
N920 M30                 ( fin de programa )
%
`
}
