// Exportación unificada de todos los contratos y esquemas del ERP
export * from './common/pagination';
export * from './modules/compras';
export * from './modules/bancos';
export * from './modules/cxp';
export * from './modules/cxc';
export * from './modules/auth';

// Reexportación explícita de constantes runtime utilizadas por los
// componentes Select del frontend.
export { TIPOS_GESTION_COBRO } from './modules/cxc/cobranza/gestion-cobro';
export { ESTADOS_PROMESA_PAGO } from './modules/cxc/cobranza/promesa-pago';
export { ESTADOS_CONVENIO_PAGO } from './modules/cxc/cobranza/convenio-pago';
export { ESTADOS_CUOTA } from './modules/cxc/cobranza/convenio-cuota';

// Estados del módulo de Pagos
export { ESTADOS_FORMA_PAGO } from './modules/cxc/pagos/forma-pago';
export { ESTADOS_PAGO } from './modules/cxc/pagos/pago';
export { ESTADOS_ANTICIPO } from './modules/cxc/pagos/anticipo';
export { ESTADOS_RECIBO } from './modules/cxc/pagos/recibo';

// Estados del módulo de Documentos
export { ESTADOS_DOCUMENTO } from './modules/cxc/documentos/documento';
// Constantes de facturación FEL usadas por el formulario del cliente
export { IVA_GT, LIMITE_CONSUMIDOR_FINAL } from "./modules/cxc/facturacion/factura";

// Autenticación: reglas de contraseña y roles usados por el login del cliente
export { ROLES, ROL_LABEL, PASSWORD_MIN, PASSWORD_MAX, evaluarClave, clavePermitida, fortalezaClave, USERNAME_REGEX, crearUsuarioSchema, editarUsuarioSchema, recuperarClaveSchema, restablecerClaveSchema } from "./modules/auth/auth";
