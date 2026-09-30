import {
  createDocumentoDetalleSchema,
  updateDocumentoDetalleSchema,
  type DocumentoDetalle,
} from '@erp/contracts';
import * as documentoDetalleRepository from '../../repositories/documentos/documentoDetalle.repository';
import { NotFoundError, getDocumento } from './documento.service';
import { ConflictError } from '../../../../shared/errors/AppError';
import { hasFinancialMovement, isDocumentoBloqueadoParaAplicacion } from '../../shared/financialRules';

/**
 * Un documento pagado/anulado o con movimientos financieros (saldo distinto
 * del total) congela su cabecera en documento.service.ts; las líneas de
 * detalle son parte de esa misma cabecera y deben quedar igual de protegidas,
 * o CXC_DOCUMENTO_DETALLE se desincroniza silenciosamente del TOTAL/SALDO ya
 * cerrado.
 */
async function assertDocumentoEditable(idDocumento: number) {
  const documento = await getDocumento(idDocumento);
  if (isDocumentoBloqueadoParaAplicacion(documento.estado) || hasFinancialMovement(documento.total, documento.saldo)) {
    throw new ConflictError(
      'El documento está pagado, anulado o ya tiene movimientos financieros. No se pueden modificar sus líneas de detalle.',
    );
  }
  return documento;
}

export async function listDetalles(idDocumento: number): Promise<DocumentoDetalle[]> {
  await getDocumento(idDocumento);
  return documentoDetalleRepository.findByDocumento(idDocumento);
}

export async function getDetalle(id: number): Promise<DocumentoDetalle> {
  const detalle = await documentoDetalleRepository.findById(id);
  if (!detalle) throw new NotFoundError(`Detalle de documento ${id} no encontrado`);
  return detalle;
}

export async function createDetalle(idDocumento: number, rawInput: unknown): Promise<DocumentoDetalle> {
  await assertDocumentoEditable(idDocumento);
  const input = createDocumentoDetalleSchema.parse({ ...(rawInput as object), idDocumento });
  const id = await documentoDetalleRepository.create(input);
  return getDetalle(id);
}

export async function updateDetalle(id: number, rawInput: unknown): Promise<DocumentoDetalle> {
  const input = updateDocumentoDetalleSchema.parse(rawInput);
  const actual = await getDetalle(id);
  await assertDocumentoEditable(actual.idDocumento);

  // TOTAL es un dato derivado. Si cambia cantidad o precio unitario y el
  // cliente no envía un total explícito, lo recalculamos para evitar que
  // CXC_DOCUMENTO_DETALLE quede inconsistente.
  const cantidad = input.cantidad ?? actual.cantidad;
  const precioUnitario = input.precioUnitario ?? actual.precioUnitario;
  const total =
    input.total ??
    (input.cantidad !== undefined || input.precioUnitario !== undefined
      ? Number((cantidad * precioUnitario).toFixed(2))
      : undefined);

  await documentoDetalleRepository.update(id, {
    ...input,
    ...(total !== undefined ? { total } : {}),
  });

  return getDetalle(id);
}

export async function deleteDetalle(id: number): Promise<void> {
  const actual = await getDetalle(id);
  await assertDocumentoEditable(actual.idDocumento);
  await documentoDetalleRepository.remove(id);
}
