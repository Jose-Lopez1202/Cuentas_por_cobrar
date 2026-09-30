import { businessTodayIso } from '../../../shared/date';

export type DocumentoEstadoFinanciero = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'ANULADO';
export type DocumentoCondicion = 'VIGENTE' | 'VENCIDA';

export const EPSILON = 0.005;

export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function deriveDocumentoEstado(
  total: number,
  saldo: number,
  estadoActual?: string | null,
): DocumentoEstadoFinanciero {
  const current = String(estadoActual ?? '').trim().toUpperCase();
  if (current === 'ANULADO' || current === 'ANULADA') return 'ANULADO';

  const normalizedTotal = Math.max(0, roundMoney(total));
  const normalizedSaldo = Math.max(0, roundMoney(saldo));

  if (normalizedSaldo <= EPSILON) return 'PAGADO';
  if (normalizedSaldo >= normalizedTotal - EPSILON) return 'PENDIENTE';
  return 'PARCIAL';
}

export function deriveDocumentoCondicion(
  fechaVencimiento: Date | string | null | undefined,
  saldo: number,
  estado?: string | null,
): DocumentoCondicion {
  const current = String(estado ?? '').trim().toUpperCase();
  if (current === 'ANULADO' || current === 'ANULADA' || Number(saldo) <= EPSILON) {
    return 'VIGENTE';
  }

  if (!fechaVencimiento) return 'VIGENTE';
  const dueDate = fechaVencimiento instanceof Date
    ? fechaVencimiento.toISOString().slice(0, 10)
    : String(fechaVencimiento).slice(0, 10);

  return dueDate < businessTodayIso() ? 'VENCIDA' : 'VIGENTE';
}

export function isDocumentoBloqueadoParaAplicacion(estado?: string | null): boolean {
  const normalized = String(estado ?? '').trim().toUpperCase();
  return ['PAGADO', 'PAGADA', 'ANULADO', 'ANULADA'].includes(normalized);
}

/**
 * Un documento con movimientos financieros (saldo distinto del total) debe
 * congelar su cabecera y sus líneas de detalle: las correcciones pasan por
 * reversa/nota de crédito/ajuste, no por editar el registro original.
 */
export function hasFinancialMovement(total: number, saldo: number): boolean {
  return Math.abs(Number(total) - Number(saldo)) > EPSILON;
}
