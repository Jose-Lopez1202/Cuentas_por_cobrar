import type { TourStep, Tutorial } from './tutorialTypes';

export const TUTORIAL_GROUPS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'credito', label: 'Crédito' },
  { id: 'cobranza', label: 'Cobranza' },
  { id: 'organizacion', label: 'Organización' },
] as const;

// Pasos comunes a las pantallas de catálogo (buscar, tabla, editar, paginar).
const buscar = (que: string): TourStep => ({
  title: 'Busca antes de crear',
  body: `Filtra ${que} escribiendo en este cuadro. La búsqueda reinicia la paginación en la página 1. Revisa siempre si el registro ya existe para no duplicarlo.`,
  target: 'filters',
});

const tabla = (extra: string): TourStep => ({
  title: 'Listado',
  body: `Aquí ves los registros. ${extra}`,
  target: 'table',
});

const paginar: TourStep = {
  title: 'Paginación',
  body: 'Se muestran 10 registros por página. Usa los números o las flechas para navegar; el texto indica cuántos registros hay en total.',
  target: 'pagination',
};

const acciones = (texto: string): TourStep => ({
  title: 'Acciones por fila',
  body: texto,
  target: 'rowActions',
});

export const TUTORIALS: Tutorial[] = [
  // ─── Dashboard ───────────────────────────────────────────────
  {
    id: 'dashboard',
    title: 'Dashboard de Cuentas por Cobrar',
    summary: 'Lee el resumen en vivo de cobranza, crédito, documentos y pagos.',
    group: 'dashboard',
    path: '/cxc/dashboard',
    steps: [
      { title: 'Bienvenido al Dashboard', body: 'Es la vista de entrada del módulo: un resumen en vivo del estado de la cartera. No se edita nada aquí, sirve para decidir a dónde ir.', target: 'header' },
      { title: 'Indicadores y gráficas', body: 'Las tarjetas de arriba resumen saldos, vencimientos y cobranza. Si un indicador de mora o vencido crece, entra a Reportes → Antigüedad de Saldos para ver qué clientes lo causan.' },
      { title: 'Siguiente paso', body: 'Desde el menú lateral entras a cada grupo (Documentos, Pagos, Crédito, Cobranza…). En cada pantalla encontrarás un botón «Tutorial» para repetir esta guía.' },
    ],
  },

  // ─── Reportes ────────────────────────────────────────────────
  {
    id: 'antiguedad-saldos',
    title: 'Antigüedad de Saldos',
    summary: 'Ubica cuánto te deben y hace cuántos días está vencido.',
    group: 'reportes',
    path: '/cxc/reportes/antiguedad-saldos',
    steps: [
      { title: 'Qué muestra este reporte', body: 'El saldo pendiente de cada cliente agrupado por días de vencimiento. Solo incluye documentos con saldo; los pagados y anulados no cuentan.', target: 'header' },
      { title: 'Totales por rango', body: 'Las tarjetas suman la cartera por rango (al día, 1-30, 31-60 días, etc.). Cuanto más a la derecha, más difícil es cobrar: priorízalo en Cobranza.' },
      tabla('Cada fila es un cliente con su saldo repartido por rango. Los montos en rangos altos son los candidatos a gestión de cobro o convenio de pago.'),
    ],
  },
  {
    id: 'estado-cuenta',
    title: 'Estado de Cuenta',
    summary: 'Consulta el historial y saldo de un cliente.',
    group: 'reportes',
    path: '/cxc/reportes/estado-cuenta',
    steps: [
      { title: 'Estado de cuenta por cliente', body: 'Muestra el historial completo de documentos de un cliente con su saldo actual y condición de vencimiento.', target: 'header' },
      { title: 'Elige un cliente', body: 'Selecciona el cliente en la lista. El reporte se carga solo al elegirlo.', target: 'filters' },
      { title: 'Lee los totales', body: 'Verás total facturado, saldo pendiente y saldo vencido. El vencido se marca en rojo cuando es mayor a cero: es lo que debes gestionar.' },
    ],
  },

  // ─── Documentos ──────────────────────────────────────────────
  {
    id: 'documentos',
    title: 'Documentos CxC',
    summary: 'Registra los documentos que generan deuda del cliente.',
    group: 'documentos',
    path: '/cxc/documentos/documentos',
    steps: [
      { title: 'Documentos que generan deuda', body: 'Aquí vive la cabecera de facturas y demás documentos que crean o afectan lo que el cliente debe.', target: 'header' },
      { title: 'Crear un documento', body: 'Pulsa «Nuevo Documento» y completa cliente (el NIT se carga solo), tipo, moneda, serie, número, fecha de emisión y fecha de vencimiento. La fecha del documento no puede ser futura.', target: 'action' },
      buscar('documentos por cliente, número o estado'),
      tabla('Haz clic en una fila para abrir el detalle del documento (líneas e historial de estados).'),
      acciones('El lápiz edita la cabecera y el icono de prohibido anula el documento. Un documento pagado o ya anulado no se puede anular.'),
      paginar,
    ],
  },
  {
    id: 'documento-detalle',
    title: 'Detalle de documento',
    summary: 'Administra las líneas y el historial de un documento.',
    group: 'documentos',
    path: '/cxc/documentos/documentos',
    pathPattern: /^\/cxc\/documentos\/documentos\/[^/]+$/,
    steps: [
      { title: 'Cabecera del documento', body: 'Arriba ves serie, número, cliente, montos y estado. Los cambios de saldo no se hacen aquí: ocurren al aplicar pagos, anticipos o notas de crédito.', target: 'header' },
      { title: 'Agregar líneas', body: 'Con «Agregar Detalle» registras cada línea del documento: código de producto, descripción, cantidad y precio unitario.', target: { button: 'Agregar Detalle' } },
      { title: 'Historial de estados', body: 'Con «Agregar Historial» dejas constancia de cada cambio de estado (anterior → nuevo) con empleado y observaciones, para tener trazabilidad.', target: { button: 'Agregar Historial' } },
    ],
  },
  {
    id: 'tipos-documento',
    title: 'Tipos de Documento',
    summary: 'Mantén el catálogo de tipos (factura, nota, etc.).',
    group: 'documentos',
    path: '/cxc/documentos/tipos-documento',
    steps: [
      { title: 'Catálogo de tipos', body: 'Define las clases de documento que puede manejar CxC. Cada documento nuevo debe pertenecer a uno de estos tipos.', target: 'header' },
      { title: 'Nuevo tipo', body: 'Pulsa «Nuevo Tipo» e indica un código corto y único, el nombre y la naturaleza: Cargo aumenta la deuda y Crédito la disminuye.', target: 'action' },
      buscar('tipos por nombre o código'),
      tabla('Los tipos inactivos no deben mostrarse al crear documentos nuevos.'),
      acciones('Edita el tipo con el lápiz. Cambiar la naturaleza de un tipo en uso afecta cómo se interpretan sus documentos: hazlo con cuidado.'),
    ],
  },
  {
    id: 'ajustes',
    title: 'Ajustes de Cartera',
    summary: 'Solicita y aprueba ajustes con doble aprobación.',
    group: 'documentos',
    path: '/cxc/documentos/ajustes',
    steps: [
      { title: 'Ajustes con control', body: 'Un ajuste corrige la deuda de un cliente. Nace pendiente y requiere dos aprobaciones de empleados distintos.', target: 'header' },
      { title: 'Solicitar un ajuste', body: 'Con «Nuevo Ajuste» eliges cliente, documento (opcional), tipo (Débito aumenta la deuda, Crédito la reduce), monto, fecha, empleado solicitante y un motivo obligatorio de 10 a 250 caracteres.', target: 'action' },
      tabla('La columna Estado indica en qué punto va el ajuste; tras la primera aprobación queda en espera de la 2da. El saldo solo se mueve con la segunda.'),
      acciones('Desde la fila das la 1ra o la 2da aprobación, o rechazas el ajuste. La segunda aprobación debe hacerla un empleado distinto al de la primera.'),
    ],
  },

  // ─── Pagos ───────────────────────────────────────────────────
  {
    id: 'pagos',
    title: 'Pagos',
    summary: 'Registra los pagos recibidos de clientes.',
    group: 'pagos',
    path: '/cxc/pagos/pagos',
    steps: [
      { title: 'Registro de pagos', body: 'Aquí registras el dinero recibido. Ojo: registrar un pago NO baja el saldo de la factura; eso ocurre al aplicarlo.', target: 'header' },
      { title: 'Regla clave', body: 'Un pago puede quedar «En cuenta», «No aplicado» o «No identificado» hasta que decidas contra qué documento se aplica.', target: 'banner' },
      { title: 'Nuevo pago', body: 'Pulsa «Nuevo Pago» y completa cliente, forma de pago, moneda, banco (si aplica), fecha, monto y número de referencia.', target: 'action' },
      buscar('pagos por cliente, referencia, estado o ID'),
      tabla('Monto = lo recibido, Aplicado = lo ya usado contra documentos, Disponible = lo que aún puedes aplicar.'),
      acciones('Con movimientos el pago queda bloqueado. Si no tiene aplicaciones puedes anularlo (con motivo) o eliminarlo; uno aplicado se corrige reversando la aplicación.'),
      paginar,
    ],
  },
  {
    id: 'aplicaciones-pago',
    title: 'Aplicaciones de Pago',
    summary: 'Aplica un pago contra un documento para reducir su saldo.',
    group: 'pagos',
    path: '/cxc/pagos/aplicaciones-pago',
    steps: [
      { title: 'Aquí baja el saldo', body: 'Aplicar un pago reduce el saldo del documento dentro de una transacción segura: o se guarda todo o no se guarda nada.', target: 'header' },
      { title: 'Nueva aplicación', body: 'Elige el pago, el documento, la fecha, el monto aplicado y el empleado. El sistema valida que no excedas el disponible del pago ni el saldo del documento.', target: 'action' },
      { title: 'Las aplicaciones son inmutables', body: 'Una aplicación confirmada no se edita. Para corregirla, reversa la aplicación indicando motivo y empleado.', target: 'banner' },
      tabla('Cada fila es una aplicación. En las confirmadas aparece «Reversar», que deshace la aplicación dejando motivo y empleado.'),
    ],
  },
  {
    id: 'anticipos',
    title: 'Anticipos',
    summary: 'Registra dinero recibido antes de facturar.',
    group: 'pagos',
    path: '/cxc/pagos/anticipos',
    steps: [
      { title: '¿Qué es un anticipo?', body: 'Dinero que el cliente entrega antes de tener un documento. Queda disponible para aplicarse después contra una factura.', target: 'header' },
      { title: 'Nuevo anticipo', body: 'Con «Nuevo» registras cliente, pago relacionado (opcional), monto original y fecha. La fecha no puede ser futura.', target: 'action' },
      buscar('anticipos por cliente o estado'),
      tabla('Verás el monto original y lo que sigue disponible. El estado lo gestiona el sistema al aplicar o reversar; no se edita a mano.'),
      acciones('Solo un anticipo disponible y sin aplicaciones se puede anular, con motivo y empleado. Si ya se aplicó, reversa la aplicación primero.'),
    ],
  },
  {
    id: 'aplicaciones-anticipo',
    title: 'Aplicaciones de Anticipo',
    summary: 'Usa un anticipo disponible para saldar un documento.',
    group: 'pagos',
    path: '/cxc/pagos/aplicaciones-anticipo',
    steps: [
      { title: 'Aplicar un anticipo', body: 'Reduce el saldo del documento y, a la vez, el disponible del anticipo, en una sola transacción.', target: 'header' },
      { title: 'Nueva aplicación', body: 'Elige el anticipo, el documento, la fecha, el monto aplicado y el empleado. El sistema valida que no excedas el disponible del anticipo ni el saldo del documento.', target: 'action' },
      { title: 'Inmutable', body: 'Una aplicación confirmada no se modifica. Corrígela con «Reversar», indicando motivo y trazabilidad.', target: 'banner' },
      tabla('Revisa qué anticipo cubrió qué documento y por cuánto.'),
    ],
  },
  {
    id: 'recibos',
    title: 'Recibos',
    summary: 'Emite y consulta los recibos de los pagos.',
    group: 'pagos',
    path: '/cxc/pagos/recibos',
    steps: [
      { title: 'Recibos de pago', body: 'Comprobante que se entrega al cliente por un pago recibido.', target: 'header' },
      { title: 'Nuevo recibo', body: 'Elige cliente y uno de sus pagos, escribe el número de recibo (correlativo), la fecha (no futura) y el monto, que no puede superar el monto del pago.', target: 'action' },
      buscar('recibos por cliente o número'),
      tabla('Revisa número, cliente, monto y estado de cada recibo.'),
      acciones('Edita con el lápiz o elimina un recibo emitido por error.'),
    ],
  },
  {
    id: 'formas-pago',
    title: 'Formas de Pago',
    summary: 'Mantén el catálogo de formas de pago.',
    group: 'pagos',
    path: '/cxc/pagos/formas-pago',
    steps: [
      { title: 'Catálogo de formas de pago', body: 'Efectivo, cheque, transferencia, etc. Es lo que aparece al registrar un pago.', target: 'header' },
      { title: 'Nueva forma', body: 'Indica el nombre y si «Requiere referencia»: cuando está activa, el número de operación, cheque o transferencia pasa a ser obligatorio al registrar el pago.', target: 'action' },
      buscar('formas por nombre'),
      tabla('Revisa cuáles están activas; solo las activas deben aparecer al registrar pagos.'),
    ],
  },

  // ─── Crédito ─────────────────────────────────────────────────
  {
    id: 'condiciones-credito',
    title: 'Condiciones de Crédito',
    summary: 'Define días de crédito, gracia y porcentaje de mora.',
    group: 'credito',
    path: '/cxc/credito/condiciones-credito',
    steps: [
      { title: 'Reglas de crédito', body: 'Una condición define cuántos días de crédito se dan, cuántos días de gracia hay y qué porcentaje de mora se cobra.', target: 'header' },
      { title: 'Nueva condición', body: 'Completa días de crédito (0 a 3650), días de gracia (0 a 365), porcentaje de mora (0 a 100) y estado. Solo las condiciones activas deben usarse.', target: 'action' },
      buscar('condiciones'),
      tabla('Compara las condiciones vigentes y su estado.'),
    ],
  },
  {
    id: 'notas-credito',
    title: 'Notas de Crédito',
    summary: 'Registra saldos a favor del cliente.',
    group: 'credito',
    path: '/cxc/credito/notas-credito',
    steps: [
      { title: 'Notas de crédito', body: 'Se registran como saldo a favor del cliente (devoluciones, descuentos posteriores).', target: 'header' },
      { title: 'No mueve el saldo', body: 'Registrar una NC no modifica la factura. El movimiento financiero ocurre después, en «Aplicación Nota Crédito».', target: 'banner' },
      { title: 'Nueva nota', body: 'Indica cliente, documento de referencia (opcional, con saldo pendiente), serie, número, fecha (no futura), monto y descripción del motivo.', target: 'action' },
      tabla('Verás el monto y el estado de cada nota.'),
      acciones('Con aplicaciones la nota queda bloqueada. Sin aplicaciones puedes anularla con motivo y empleado.'),
    ],
  },
  {
    id: 'aplicaciones-nota-credito',
    title: 'Aplicación Nota Crédito',
    summary: 'Aplica una NC a un documento para reducir su saldo.',
    group: 'credito',
    path: '/cxc/credito/aplicaciones-nota-credito',
    steps: [
      { title: 'Aquí baja el saldo', body: 'La nota de crédito solo reduce la deuda cuando se aplica a un documento.', target: 'header' },
      { title: 'Nueva aplicación', body: 'Elige la nota de crédito, el documento, la fecha y el monto. El sistema valida que no excedas lo disponible de la nota ni el saldo del documento.', target: 'action' },
      { title: 'Inmutable', body: 'Una aplicación confirmada no se edita. Para corregirla, reversa con motivo y trazabilidad.', target: 'banner' },
      tabla('Cada fila es una aplicación con su estado; usa «Reversar» si te equivocaste.'),
    ],
  },
  {
    id: 'mora',
    title: 'Mora',
    summary: 'Consulta y recalcula la mora de los saldos vencidos.',
    group: 'credito',
    path: '/cxc/credito/mora',
    steps: [
      { title: 'Saldos vencidos y mora', body: 'Lleva el control de documentos vencidos: días de mora, monto vencido y cargo por mora.', target: 'header' },
      { title: 'Recalcular Mora', body: 'Recalcula en bloque la mora de los documentos vencidos. Al terminar aparece un mensaje azul con el resultado.', target: { button: 'Recalcular' } },
      { title: 'Nueva Mora manual', body: 'Registra una mora puntual: cliente, documento con saldo pendiente, días de mora, saldo vencido, porcentaje, monto de mora y fecha de cálculo (no posterior a hoy).', target: 'action' },
      buscar('registros de mora por cliente o estado'),
      tabla('Ordena tu gestión por los días de mora más altos.'),
    ],
  },

  // ─── Cobranza ────────────────────────────────────────────────
  {
    id: 'gestiones-cobro',
    title: 'Gestiones de Cobro',
    summary: 'Registra llamadas, visitas y contactos de cobranza.',
    group: 'cobranza',
    path: '/cxc/cobranza/gestiones-cobro',
    steps: [
      { title: 'Bitácora de cobranza', body: 'Deja constancia de cada llamada, visita o contacto con un cliente moroso.', target: 'header' },
      { title: 'Nueva gestión', body: 'Elige cliente, empleado responsable, documento (opcional), tipo de gestión (el canal usado) y el resultado. Si hubo compromiso, indica fecha y monto comprometidos.', target: 'action' },
      buscar('gestiones por cliente o resultado'),
      tabla('Revisa el historial de contacto antes de volver a llamar.'),
      paginar,
    ],
  },
  {
    id: 'promesas-pago',
    title: 'Promesas de Pago',
    summary: 'Registra compromisos de pago del cliente.',
    group: 'cobranza',
    path: '/cxc/cobranza/promesas-pago',
    steps: [
      { title: 'Compromisos de pago', body: 'Cuando un cliente se compromete a pagar en una fecha, se registra como promesa para darle seguimiento.', target: 'header' },
      { title: 'Nueva promesa', body: 'Indica cliente, documento (opcional), fecha de la promesa, fecha comprometida de pago y monto comprometido; si eliges un documento, el monto no puede superar su saldo.', target: 'action' },
      buscar('promesas por cliente o estado'),
      tabla('Revisa el estado de cada promesa. Si la fecha comprometida pasa sin pago, conviene registrar otra gestión o proponer un convenio.'),
    ],
  },
  {
    id: 'convenios-pago',
    title: 'Convenios de Pago',
    summary: 'Crea planes de pago a cuotas para clientes en mora.',
    group: 'cobranza',
    path: '/cxc/cobranza/convenios-pago',
    steps: [
      { title: 'Planes a cuotas', body: 'Un convenio formaliza el pago a cuotas de una deuda en mora. Pagar una cuota reduce el saldo real de los documentos que cubre.', target: 'header' },
      { title: 'Nuevo convenio', body: 'Elige cliente, fecha del convenio (no futura), monto de deuda, número de cuotas y marca los documentos que cubre. Debes seleccionar al menos uno.', target: 'action' },
      { title: 'Recalcular incumplimiento', body: 'Revisa las cuotas vencidas y marca como incumplidos los convenios que corresponda. El resultado aparece en un mensaje.', target: { button: 'Recalcular' } },
      buscar('convenios por cliente o estado'),
      tabla('Estados posibles: Activo, Cumplido, Incumplido y Cancelado. Haz clic en una fila para ver sus cuotas.'),
    ],
  },
  {
    id: 'convenio-detalle',
    title: 'Detalle de convenio',
    summary: 'Revisa las cuotas y documentos de un convenio.',
    group: 'cobranza',
    path: '/cxc/cobranza/convenios-pago',
    pathPattern: /^\/cxc\/cobranza\/convenios-pago\/[^/]+$/,
    steps: [
      { title: 'Resumen del convenio', body: 'Arriba ves el cliente, el monto, el estado y el avance del plan.', target: 'header' },
      { title: 'Cuotas', body: 'Cada cuota tiene fecha de vencimiento y monto. Al pagar una cuota se reduce el saldo de los documentos cubiertos.', target: 'table' },
      { title: 'Seguimiento', body: 'Si una cuota vence sin pagarse, vuelve al listado y usa «Recalcular incumplimiento» para actualizar el estado del convenio.' },
    ],
  },

  // ─── Organización ────────────────────────────────────────────
  {
    id: 'empresas',
    title: 'Empresas',
    summary: 'Administra las empresas del sistema.',
    group: 'organizacion',
    path: '/cxc/organizacion/empresas',
    steps: [
      { title: 'Catálogo de empresas', body: 'Las empresas son el nivel más alto de la organización. Las sucursales cuelgan de ellas.', target: 'header' },
      { title: 'Nueva empresa', body: 'Registra nombre (razón social) y NIT (formato 1234567-8, o CF). Créala antes de sus sucursales.', target: 'action' },
      buscar('empresas por nombre o NIT'),
      tabla('Revisa el estado de cada empresa; las inactivas no deben usarse en otros catálogos.'),
      acciones('Edita con el lápiz. Evita eliminar una empresa que ya tiene sucursales o movimientos.'),
    ],
  },
  {
    id: 'sucursales',
    title: 'Sucursales',
    summary: 'Administra las sucursales de cada empresa.',
    group: 'organizacion',
    path: '/cxc/organizacion/sucursales',
    steps: [
      { title: 'Sucursales por empresa', body: 'Cada sucursal pertenece a una empresa. Debes tener la empresa creada antes.', target: 'header' },
      { title: 'Nueva sucursal', body: 'Elige la empresa propietaria e indica el nombre de la sucursal y su dirección.', target: 'action' },
      buscar('sucursales por nombre o empresa'),
      tabla('Verás a qué empresa pertenece cada sucursal.'),
    ],
  },
  {
    id: 'rutas',
    title: 'Rutas de Cobro',
    summary: 'Crea rutas de visita asignadas a empleados.',
    group: 'organizacion',
    path: '/cxc/organizacion/rutas',
    steps: [
      { title: 'Rutas de cobro', body: 'Una ruta agrupa las visitas de cobranza asignadas a un empleado.', target: 'header' },
      { title: 'Nueva ruta', body: 'Define código de ruta, nombre, empleado responsable, fecha planificada, estado y observaciones.', target: 'action' },
      buscar('rutas por código, nombre o empleado'),
      tabla('Haz clic en una fila para abrir la ruta y administrar sus paradas.'),
    ],
  },
  {
    id: 'ruta-detalle',
    title: 'Paradas de una ruta',
    summary: 'Agrega y ordena las paradas de una ruta.',
    group: 'organizacion',
    path: '/cxc/organizacion/rutas',
    pathPattern: /^\/cxc\/organizacion\/rutas\/[^/]+$/,
    steps: [
      { title: 'Detalle de ruta', body: 'Aquí administras las paradas que el empleado debe visitar.', target: 'header' },
      { title: 'Agregar parada', body: 'Elige el cliente y define orden de visita, dirección, hora (24 h), monto pendiente de referencia y estado de la visita.', target: 'action' },
      tabla('El orden de visita define la secuencia del recorrido. Actualiza el estado conforme se completen las visitas.'),
    ],
  },
];

export const getTutorialForPath = (pathname: string): Tutorial | undefined =>
  TUTORIALS.find((t) => (t.pathPattern ? t.pathPattern.test(pathname) : t.path === pathname));
