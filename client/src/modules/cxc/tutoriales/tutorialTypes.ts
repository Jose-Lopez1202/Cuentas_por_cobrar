/**
 * Un paso puede resaltar un elemento de la pantalla real. Los objetivos se
 * resuelven por convención estructural (todas las pantallas CxC siguen el
 * mismo patrón: cabecera → filtros → tabla) para no tener que marcar cada
 * página con atributos. Si el elemento no existe (p. ej. tabla vacía o
 * cargando) el paso se muestra centrado, sin resaltar nada.
 */
export type TourTarget =
  | 'header' // fila del título + botones de acción
  | 'action' // botón principal (el último de la cabecera)
  | 'filters' // tarjeta de búsqueda / filtros
  | 'table' // tabla de datos
  | 'rowActions' // iconos de acción de la primera fila
  | 'pagination' // paginador
  | 'banner' // aviso informativo (azul / ámbar)
  | { button: string } // botón cuyo texto contiene este valor
  | { css: string }; // selector CSS dentro del área de trabajo

export interface TourStep {
  title: string;
  body: string;
  target?: TourTarget;
}

export interface Tutorial {
  /** Identificador estable; también es la clave de progreso guardada. */
  id: string;
  title: string;
  summary: string;
  /** Grupo del sidebar al que pertenece (coincide con CXC_GROUPS.id). */
  group: string;
  /** Ruta exacta donde se ejecuta. */
  path: string;
  /** Regex opcional para rutas con parámetros (p. ej. /:id). */
  pathPattern?: RegExp;
  steps: TourStep[];
}
