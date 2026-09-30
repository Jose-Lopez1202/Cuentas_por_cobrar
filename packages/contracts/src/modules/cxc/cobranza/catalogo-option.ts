// Forma mínima para poblar un <Select> con datos reales de la base.
// Los metadatos opcionales permiten validar relaciones entre catálogos
// (por ejemplo pago -> cliente -> documentos pendientes) sin exponer filas completas.
export interface CatalogoOption {
  id: number;
  label: string;
  idCliente?: number;
  monto?: number;
  saldo?: number;
  nit?: string | null;
}
