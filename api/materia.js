/**
 * Apuntes del curso que MecBot le pasa al modelo como contexto.
 * Los textos salen de las secciones de Estudiar. Robótica va primero.
 */

const VACIAS = new Set(
  'que cual cuales como cuando donde por para con una uno del los las el la en es son se un al lo le de y o a mi me tu te su sus the'.split(' '),
)

/** @type {{ id: string, unidad: string, ancla: string, titulo: string, claves: string[], texto: string }[]} */
export const FICHAS = [
  {
    id: 'robot-que-es',
    unidad: 'Robótica',
    ancla: 'que-es',
    titulo: '¿Qué es un robot industrial?',
    claves: ['robot industrial', 'que es un robot', 'devol', 'teach-in', 'teach in', 'playback', 'manipulacion remota'],
    texto:
      'En la industria se acepta como robot un dispositivo programado para el manejo de materiales, según la patente de George C. Devol (EE. UU., 1954). De ahí sale teach-in / playback: se le enseña una secuencia de posiciones y después la reproduce. La tecnología junta el control numérico de las máquinas herramienta con la manipulación remota. En esta unidad lo pruebas con el mando manual.',
  },
  {
    id: 'robot-serie',
    unidad: 'Robótica',
    ancla: 'serie',
    titulo: 'Fabricación en serie y robótica industrial',
    claves: ['fabricacion en serie', 'flexibilidad', 'reprogramable', 'retooling'],
    texto:
      'La fabricación en serie está dedicada a un producto: alto volumen, poca variedad, y cambiar el producto obliga a rehacer la línea (retooling costoso). La robótica industrial es flexible y reprogramable: cambiar el producto es cargar otro programa, con volumen medio y mucha variedad. El gran aporte es la flexibilidad de las líneas.',
  },
  {
    id: 'robot-tipos',
    unidad: 'Robótica',
    ancla: 'tipos',
    titulo: 'Tipos de robots',
    claves: ['tipos de robots', 'scara', 'cartesiano', 'antropomorfico', 'delta', 'paralelo', 'agv', 'amr', 'base fija', 'bionico', 'humanoide'],
    texto:
      'Base fija (los más usados en manufactura): SCARA, cilíndrico, esférico o polar, angular o antropomórfico, cartesiano (pórtico) y paralelo (delta). Móviles: AGV (vehículo guiado automáticamente) y AMR (robot móvil autónomo). Biónicos o zoomórficos: humanoide, cuadrúpedo y hexápodo. En Estudiar puedes mover cada uno de base fija en 3D.',
  },
  {
    id: 'robot-componentes',
    unidad: 'Robótica',
    ancla: 'componentes',
    titulo: 'Componentes de un robot de base fija',
    claves: ['componentes', 'efector', 'flange', 'controlador', 'smartpad', 'teach pendant', 'actuador', 'encoder'],
    texto:
      'Un robot de base fija tiene seis partes: la estructura mecánica (eslabones y articulaciones), los actuadores (motores, servos, cilindros), las transmisiones (engranajes, correas, husillos), los sensores (encoders de posición, fuerza, visión), el controlador (el computador del armario, que ejecuta el programa y maneja motores y E/S) y el efector final (pinza, ventosa, husillo, soplete, pistola de pintura). El teach pendant —en KUKA, el smartPAD— es el mando para moverlo a mano y enseñar puntos. Se conecta al controlador y no cuenta como una de las seis partes.',
  },
  {
    id: 'robot-gdl',
    unidad: 'Robótica',
    ancla: 'grados',
    titulo: 'Grados de libertad y singularidades',
    claves: ['grado de libertad', 'grados de libertad', 'gdl', 'singularidad', 'a5', 'muneca', '6 ejes', 'limites de los ejes'],
    texto:
      'Los grados de libertad son los movimientos independientes, uno por articulación. Hacen falta 3 para la posición (X, Y, Z) y otros 3 para la orientación: el antropomórfico típico tiene 6. Un SCARA tiene 4 (X, Y, Z y giro de la herramienta) y un cartesiano, 3. En un KUKA de 6 ejes, A1, A2 y A3 llevan la muñeca a su lugar y A4, A5 y A6 orientan la herramienta. Si A5 queda en 0°, A4 y A6 quedan alineados y se pierde un grado de libertad: es una singularidad, y cerca de ella A4 y A6 pueden girar muy rápido. El simulador avisa. Si pasa, inclina un poco la herramienta.',
  },
  {
    id: 'robot-ficha',
    unidad: 'Robótica',
    ancla: 'ficha-tecnica',
    titulo: 'Ficha técnica: cómo elegir el robot',
    claves: ['ficha tecnica', 'alcance', 'repetibilidad', 'carga', 'kr 50', 'campo de trabajo', 'diagrama de cargas'],
    texto:
      'Para elegir el robot se lee la ficha. El ejemplo del apunte es el KR 50 R2100: carga 50 kg en el flange (incluida la herramienta), repetibilidad ±0,05 mm (cuánto se aleja al volver al mismo punto), alcance máximo 2101 mm (hasta dónde llega la muñeca), 6 ejes, peso 533 kg y montaje en suelo, pared, techo o ángulo. El campo de trabajo muestra el alcance en vista lateral y superior; el diagrama de cargas, cuánto peso admite según lo lejos que esté el centro de gravedad del flange. En el simulador los valores son orientativos: confirma en la ficha oficial.',
  },
  {
    id: 'robot-parametrica',
    unidad: 'Robótica',
    ancla: 'parametrica',
    titulo: 'Programación paramétrica',
    claves: ['parametrica', 'grasshopper', 'kuka|prc', 'kuka prc', 'rhino', 'rhinoceros', 'core'],
    texto:
      'En la robótica paramétrica la trayectoria se define con parámetros (largos, alturas, velocidades) que se pueden cambiar y ver al instante. En el curso: Rhinoceros 8 (modelado), Grasshopper (componentes y cables) y KUKA|prc, que agrega los robots KUKA, simula y genera KRL. El orden es: modelar o traer el DXF, definir la trayectoria, configurar robot, herramienta y base, simular con el Core y revisar alcance, límites y singularidades, exportar el .src/.dat y probar en el controlador en T1 antes de producir. Siete partes: puntos, planos, comando, robot, herramienta, slider de simulación y Core, que junta todo y genera el KRL.',
  },
  {
    id: 'robot-movimientos',
    unidad: 'Robótica',
    ancla: 'parametrica',
    titulo: 'PTP, LIN, CIR y AXIS',
    claves: ['ptp', 'lin', 'cir', 'axis', 'linea recta', 'aproximacion', 'command weaver'],
    texto:
      'PTP mueve todos los ejes a la vez y llega lo más rápido posible, pero la herramienta no va en línea recta: sirve para acercarse y alejarse. LIN lleva la herramienta en línea recta y se usa para trabajar; es más lento. CIR hace un arco pasando por un punto auxiliar. AXIS da el ángulo de cada eje. Command Weaver combina listas de comandos. Set Digital Out y Wait manejan salidas (husillo, pinza) y esperas. En el simulador, para acercarte y alejarte usa PTP; para cortar, solo LIN o CIR.',
  },
  {
    id: 'robot-krl',
    unidad: 'Robótica',
    ancla: 'parametrica',
    titulo: 'Código KRL',
    claves: ['krl', '$base', '$tool', '$vel.cp', 'tcp', 'wait sec', '$out'],
    texto:
      'El KRL que se genera tiene la forma DEF programa( ) … END. Fija la base ($BASE) y la herramienta ($TOOL), la velocidad ($VEL.CP en m/s para LIN y CIR; en PTP el porcentaje va con BAS #VEL_PTP) y después los movimientos: PTP {A1 …, A6 …}, LIN {X, Y, Z, A, B, C} y CIR. $OUT[1]=TRUE prende una salida y WAIT SEC 2 espera. Las X, Y, Z de LIN y CIR van relativas a la base, la cara superior de la plancha: Z -5 en una plancha de 5 mm la atraviesa. En el mundo, esa altura es la del mesón menos 5 mm. La herramienta (Tool) define el TCP.',
  },
  {
    id: 'robot-nodos',
    unidad: 'Robótica',
    ancla: 'parametrica',
    titulo: 'Colores de los componentes',
    claves: ['nodo naranjo', 'nodo rojo', 'componente gris', 'colores de los componentes'],
    texto:
      'En esta app: gris = el componente funciona; naranjo = le faltan datos, depende de un nodo que falla o hay un aviso (no es un error propio); rojo = error en ese nodo (recibe un dato que no corresponde, como curvas donde se piden puntos); verde = seleccionado. En Grasshopper el que funciona bien se ve blanco, y el gris es un componente oculto.',
  },
  {
    id: 'robot-usar',
    unidad: 'Robótica',
    ancla: 'como-usar',
    titulo: 'Cómo usar esta unidad',
    claves: ['como usar', 'lienzo', 'dxf', 'exportar krl', 'mando manual', 'trayectoria verde'],
    texto:
      'Arrastra un bloque al lienzo y conecta la salida (derecha) con la entrada (izquierda). «Abrir DXF» trae líneas, arcos, círculos y polilíneas; Curve las entrega, filtradas por capa. En el Core defines dónde está la pieza respecto del robot. La herramienta apunta en contra de la Z de cada plano: con planos XY baja vertical. ▶ recorre el programa. La trayectoria se pinta verde si va bien, naranjo con avisos (cerca de un límite o de una singularidad) y roja con errores (fuera de alcance, fuera del rango de un eje, saltos o choques con el mesón o la plancha). «Exportar KRL» descarga el .src. El mando manual mueve el robot eje por eje o en X/Y/Z, graba puntos PTP o LIN y los reproduce (teach-in/playback).',
  },
  {
    id: 'robot-instalar',
    unidad: 'Robótica',
    ancla: 'instalar',
    titulo: 'Instalar el software del curso',
    claves: ['instalar rhino', 'evaluacion de rhino', 'crack', 'kuka|prc gratis'],
    texto:
      'La unidad funciona en el navegador. Si quieres el software del curso, sin crackear: Rhino 8 tiene evaluación gratuita de 90 días (Windows y Mac); al terminar deja de guardar y de cargar complementos, así que instálalo cuando empiece la unidad. Grasshopper viene en Rhino 8. KUKA|prc es gratuito para docencia e investigación en instituciones de la Association for Robots in Architecture (cubre a profesores y estudiantes, también en sus computadores) y existe una versión Community. Los componentes de esta app tienen los mismos nombres y el KRL es el mismo lenguaje. No se abren archivos .gh: la definición se arma aquí. El KRL es de estudio: revísalo antes de usarlo en un robot real.',
  },
  {
    id: 'cnc-que-es',
    unidad: 'CNC',
    ancla: 'que-es',
    titulo: '¿Qué es el CNC?',
    claves: ['que es el cnc', 'control numerico', 'codigo g', 'g-code', 'ejes cnc'],
    texto:
      'El control numérico computarizado (CNC) mueve máquinas herramienta con comandos programados, en lugar del control manual. El programa dice hacia dónde va la herramienta, a qué velocidad y qué hace (husillo, cambio de herramienta, refrigerante). Ejes lineales X, Y, Z y rotacionales A, B, C (giros alrededor de X, Y y Z). Las instrucciones van en código G, normado por DIN 66024 y 66025. En la fresadora: X a la derecha, Y al fondo, Z hacia arriba (el husillo). En el torno: Z a lo largo del eje y X en diámetro.',
  },
  {
    id: 'cnc-movimientos',
    unidad: 'CNC',
    ancla: 'codigos',
    titulo: 'G00, G01 y avances',
    claves: ['g00', 'g01', 'avance', 'rapido', 'interpolacion lineal'],
    texto:
      'G00 es el avance rápido: acerca la herramienta sin cortar, y no debe entrar en el material. G01 corta en línea recta y lleva el avance F. En el torno, X es diámetro. Una pasada se acerca con G00, corta con G01 (o con un arco) y se retira. Si el rápido atraviesa el bruto, o la herramienta avanza en un sentido que el filo no corta, el simulador alarma y no se come el material.',
  },
  {
    id: 'cnc-arcos',
    unidad: 'CNC',
    ancla: 'arcos',
    titulo: 'Arcos G02 y G03',
    claves: ['g02', 'g03', 'arco', 'horario', 'antihorario'],
    texto:
      'G02 recorre un arco en sentido horario y G03 en sentido antihorario, desde donde está la herramienta hasta el punto programado. El centro se da con I y J (distancias desde el punto de partida) o el radio con R. Sirven para redondeos y perfiles curvos. El avance sigue siendo F.',
  },
  {
    id: 'cnc-programa',
    unidad: 'CNC',
    ancla: 'bloque',
    titulo: 'Estructura de un programa',
    claves: ['g21', 'g20', 'm03', 'm04', 'm05', 'm30', 'm02', 'husillo', 'bloque de codigo'],
    texto:
      'Un bloque es una línea: puede llevar N (número), G (preparación), coordenadas, F (avance), S (revoluciones) y M (auxiliares), y un comentario entre paréntesis. G21 trabaja en milímetros y G20 en pulgadas. M03 prende el husillo en sentido horario y M04 al revés, con la velocidad S. M05 lo apaga. M30 (o M02) termina el programa y lo rebobina. El orden de una pieza simple: unidades, husillo, acercarse sin cortar, cortar con las cotas del plano y cerrar con M05 y M30.',
  },
  {
    id: 'cnc-coordenadas',
    unidad: 'CNC',
    ancla: 'coordenadas',
    titulo: 'Coordenadas absolutas e incrementales',
    claves: ['g90', 'g91', 'absolutas', 'incrementales', 'origen'],
    texto:
      'G90 programa en absolutas: cada punto se mide desde el origen de la pieza. G91 programa en incrementales: cada punto es un desplazamiento desde donde está ahora la herramienta. Mezclarlas sin querer mueve la herramienta a un lugar distinto del plano. En el torno, una X absoluta es un diámetro.',
  },
  {
    id: 'plc-que-es',
    unidad: 'PLC',
    ancla: 'que-es',
    titulo: '¿Qué es un PLC?',
    claves: ['que es un plc', 'controlador logico', 'hmi', 'scada', 'ladder', 'grafcet'],
    texto:
      'Un PLC (Programmable Logic Controller) es un computador industrial: lee entradas (pulsadores, sensores, finales de carrera), decide según el programa y actúa por las salidas (motores, electroválvulas, pilotos). Nació en los años 70 para reemplazar tableros de relés: cambiar el funcionamiento es cambiar el programa, y aguanta el ambiente de planta. Se supervisa con una HMI (la pantalla del operador) o un SCADA. Lenguajes: Ladder o KOP (el de esta unidad), bloques de funciones (FUP), lista de instrucciones (AWL) y SFC / Grafcet.',
  },
  {
    id: 'plc-ladder',
    unidad: 'PLC',
    ancla: 'ladder',
    titulo: 'Ladder: contactos y bobinas',
    claves: ['ladder', 'contacto', 'bobina', 'normalmente abierto', 'normalmente cerrado', 'set', 'reset', 'enclavar', 'serie', 'paralelo'],
    texto:
      'Ladder imita un esquema de relés. La línea izquierda es la tensión y la derecha la tierra; entre ellas, los escalones. El contacto normalmente abierto deja pasar cuando la dirección está en 1; el normalmente cerrado, cuando está en 0. En serie es un Y (AND); en paralelo, un O (OR); un contacto cerrado es un NO (NOT). La bobina pone la dirección en 1 mientras tiene corriente. La bobina L (set) enciende y se queda; la U (reset) apaga y se queda. La de transición positiva da un 1 durante un solo barrido al aparecer la corriente.',
  },
  {
    id: 'plc-scan',
    unidad: 'PLC',
    ancla: 'scan',
    titulo: 'Ciclo de scan',
    claves: ['scan', 'barrido', 'ciclo de scan', 'imagen de entradas', 'forzar'],
    texto:
      'El PLC no corre el programa de una vez: repite un barrido muchas veces por segundo. Primero lee las entradas y guarda la imagen. Después resuelve los escalones de arriba abajo; lo que escribe un escalón ya lo leen los de más abajo en ese mismo barrido. Al final actualiza las salidas. Si la misma salida tiene bobina en dos escalones, manda solo la última. Con set y reset a la vez, gana el escalón que va después. Forzar fija una entrada o salida en 1 o 0 por encima del campo o del programa: sirve para probar y es peligroso, por eso hay que quitarlo al terminar.',
  },
  {
    id: 'plc-es',
    unidad: 'PLC',
    ancla: 'entradas-salidas',
    titulo: 'Entradas, salidas y direcciones',
    claves: ['entrada', 'salida', 'i0.0', 'q0.0', 'marca', 'direccion'],
    texto:
      'Las entradas (I) traen el estado de pulsadores y sensores. Las salidas (Q) mueven motores, válvulas y pilotos. Las marcas (M) son memoria interna: no salen a un borne y sirven para recordar, por ejemplo, que se pulsó marcha. Una dirección como I0.0 o Q0.1 nombra el byte y el bit. El contacto lee esa dirección; la bobina la escribe.',
  },
  {
    id: 'plc-sensores',
    unidad: 'PLC',
    ancla: 'sensores',
    titulo: 'Sensores que se conectan al PLC',
    claves: ['sensor inductivo', 'capacitivo', 'fotoelectrico', 'final de carrera', 'presostato', 'flotador'],
    texto:
      'Casi todos los sensores de esta unidad son digitales: activos o no, un 1 o un 0. El final de carrera es un contacto que empuja la pieza. El inductivo detecta metales, sin contacto. El capacitivo detecta casi cualquier material y sirve para nivel a través de la pared. El fotoeléctrico detecta cuando algo corta o refleja el haz. El flotador magnético marca un nivel de líquido. El presostato cierra al llegar a una presión.',
  },
  {
    id: 'neu-cascada',
    unidad: 'Neumática',
    ancla: 'cascada',
    titulo: 'Método cascada',
    claves: ['cascada', 'senal bloqueante', 'grupos', 'secuencia'],
    texto:
      'En una secuencia neumática, un final de carrera que sigue pisado puede mantener pilotada una válvula e impedir el movimiento contrario: es una señal bloqueante. El método cascada parte la secuencia en grupos. Cada grupo tiene una línea de memoria; al pasar al grupo siguiente se vacía la anterior, así la señal vieja se apaga aunque el rodillo siga pisado. En Estudiar está el divisor de grupos y el ejemplo A+ B+ B− A−. MecBot no arma el circuito de tu entrega: parte tu secuencia en grupos en esa sección y revisa qué final de carrera queda bloqueando.',
  },
  {
    id: 'neu-iso',
    unidad: 'Neumática',
    ancla: 'iso',
    titulo: 'Simbología ISO 1219-1',
    claves: ['iso 1219', 'valvula', 'simbolo neumatico', 'cilindro'],
    texto:
      'La ISO 1219-1 dibuja los componentes neumáticos: el cuadrado es una posición de la válvula, las flechas el camino del aire y las líneas tapadas un orificio cerrado. El cilindro de doble efecto tiene dos cámaras; el de simple efecto vuelve con resorte. Los pilotajes se dibujan al lado del cuadro que accionan. La sección Estudiar → Simbología ISO 1219-1 recorre cada símbolo de la pizarra.',
  },
  {
    id: 'neu-vias',
    unidad: 'Neumática',
    ancla: 'vias',
    titulo: 'Vías y posiciones',
    claves: ['5/2', '3/2', '5/3', 'vias', 'posiciones', 'orificio'],
    texto:
      'El nombre de una válvula es número de vías / número de posiciones. Las vías son los orificios (presión, escapes y utilizaciones). Las posiciones son los estados, un cuadrado cada una. Una 3/2 tiene tres orificios y dos posiciones (típica para un cilindro de simple efecto). Una 5/2 tiene cinco orificios y dos posiciones (doble efecto). Una 5/3 agrega una posición central. La nomenclatura de cada orificio está en Estudiar → Nº de vías y posiciones.',
  },
  {
    id: 'neu-vdi',
    unidad: 'Neumática',
    ancla: 'vdi',
    titulo: 'Simbología VDI 2860',
    claves: ['vdi 2860', 'manipulacion', 'funcion de manipulacion'],
    texto:
      'La VDI 2860 nombra las funciones de manipulación: tomar, mover, soltar, guardar, controlar cantidad, orientar y otras. Sirve para describir qué hace un manipulador antes de elegir el circuito. Los símbolos están en Estudiar → Simbología VDI 2860.',
  },
]

export function normalizar(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function tokens(s) {
  return normalizar(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !VACIAS.has(t))
}

/** La pregunta pide la resolución de una tarea, no un concepto. */
export function pideSolucion(pregunta) {
  const p = normalizar(pregunta)
  const pide = /\b(solucion|resuelve|resolver|resuelveme|completa|completar|completalo|corrigelo|dame|escribeme)\b/.test(p) || /alternativa correcta|cual es la (respuesta|correcta)/.test(p)
  const deTarea = /tarea|entrega|evaluacion|silo|plano de la pieza|mi (programa|circuito|definicion)|pieza del plano/.test(p)
  return pide && deTarea
}

const AVISO_TAREA =
  'No te armo la solución de la tarea. Revisa el concepto en Estudiar y dime qué paso ya tienes y qué aviso te aparece: con eso te hago una pregunta para que lo descubras.'

/** Palabras de relleno en «explícame robótica» o «de qué trata el CNC». */
const RELLENO = new Set('explica explicame explicar cuentame hablame habla resume resumen trata sobre tema unidad curso materia todo toda intro introduccion'.split(' '))

const NOMBRE_UNIDAD = [
  { unidad: 'Robótica', palabras: ['robot', 'robots', 'robotica', 'robotico', 'kuka'] },
  { unidad: 'CNC', palabras: ['cnc'] },
  { unidad: 'PLC', palabras: ['plc'] },
  { unidad: 'Neumática', palabras: ['neumatica', 'neumatico'] },
]

/** «Explícame robótica»: la pregunta nombra una unidad y nada más. */
function unidadPedida(pregunta) {
  const q = tokens(pregunta).filter((t) => !RELLENO.has(t))
  if (!q.length || q.length > 2) return null
  const hits = new Set()
  for (const t of q) {
    const u = NOMBRE_UNIDAD.find((n) => n.palabras.includes(t))
    if (!u) return null
    hits.add(u.unidad)
  }
  return hits.size === 1 ? [...hits][0] : null
}

function panoramaDe(pregunta) {
  const unidad = unidadPedida(pregunta)
  if (!unidad) return null
  const fichas = FICHAS.filter((f) => f.unidad === unidad)
  if (!fichas.length) return null
  const [primera, ...resto] = fichas
  const menu = resto.map((f) => `• ${f.titulo}`).join('\n')
  return {
    origen: 'apuntes',
    texto: `${primera.texto}\n\nSi quieres seguir, pregunta por:\n${menu}`,
  }
}

/**
 * @param {string} pregunta
 * @param {number} [n]
 * @returns {{ ficha: typeof FICHAS[number], puntos: number }[]}
 */
export function buscar(pregunta, n = 3) {
  const p = normalizar(pregunta)
  const q = tokens(pregunta)
  const deRobot = /robot|kuka|krl|ptp|lin\b|cir\b|grasshopper|scara|singular|efector|flange/.test(p)
  const ranked = FICHAS.map((ficha) => {
    let puntos = 0
    const claves = new Set(ficha.claves.flatMap((c) => tokens(c)))
    const cuerpo = new Set(tokens(`${ficha.titulo} ${ficha.texto}`))
    for (const t of q) {
      if (claves.has(t)) puntos += 3
      else if (cuerpo.has(t)) puntos += 1
    }
    for (const c of ficha.claves) {
      const cn = normalizar(c)
      if (cn.length >= 2 && p.includes(cn)) puntos += 5
    }
    if (deRobot && ficha.unidad === 'Robótica') puntos += 2
    return { ficha, puntos }
  })
    .filter((r) => r.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
  return ranked.slice(0, n)
}

/** Respuesta de los apuntes, o null si no alcanza y hay que usar el modelo. */
export function respuestaDeApuntes(pregunta) {
  if (pideSolucion(pregunta)) return { texto: AVISO_TAREA, origen: 'reglas' }
  const panorama = panoramaDe(pregunta)
  if (panorama) return panorama
  const ranked = buscar(pregunta, 2)
  const mejor = ranked[0]
  if (!mejor || mejor.puntos < 6) return null
  const segundo = ranked[1]
  if (segundo && mejor.puntos < segundo.puntos + 2 && mejor.puntos < 9) return null
  const f = mejor.ficha
  return {
    origen: 'apuntes',
    texto: `En Estudiar, ${f.unidad}, sección «${f.titulo}»:\n\n${f.texto}`,
  }
}

/** Apuntes que el modelo usa para no inventar. Una unidad entera va completa. */
export function contextoDe(pregunta) {
  const unidad = unidadPedida(pregunta)
  if (unidad) {
    return FICHAS.filter((f) => f.unidad === unidad)
      .map((f) => `[${f.unidad} · ${f.titulo}] ${f.texto}`)
      .join('\n\n')
  }
  return buscar(pregunta, 3)
    .filter((r) => r.puntos >= 3)
    .map((r) => `[${r.ficha.unidad} · ${r.ficha.titulo}] ${r.ficha.texto}`)
    .join('\n\n')
    .slice(0, 1800)
}
