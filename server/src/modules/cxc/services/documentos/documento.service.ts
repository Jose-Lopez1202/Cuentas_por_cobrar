import {
  createDocumentoSchema,
  updateDocumentoSchema,
  anularDocumentoSchema,
  buildPaginationMeta,
  type Documento,
  type PaginatedResponse,
} from '@erp/contracts';
import { businessTodayIso } from '../../../../shared/date';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';
export { NotFoundError };
import * as documentoRepository from '../../repositories/documentos/documento.repository';
import * as catalogosRepository from '../../repositories/documentos/catalogosDocumentos.repository';
import * as condicionCreditoRepository from '../../repositories/credito/condicionCredito.repository';
import * as sharedCatalogosRepository from '../../repositories/catalogos.repository';
import { hasFinancialMovement as hasMovement, isDocumentoBloqueadoParaAplicacion } from '../../shared/financialRules';

const hasFinancialMovement = (documento: Documento) => hasMovement(documento.total, documento.saldo);

async function assertCondicionCreditoActiva(idCondicionCredito: number | null | undefined) {
  if (!idCondicionCredito) return;
  const condicion = await condicionCreditoRepository.findById(idCondicionCredito);
  if (!condicion) throw new BadRequestError('La condición de crédito seleccionada no existe');
  if (condicion.estado !== 'A') {
    throw new BadRequestError('La condición de crédito seleccionada está inactiva');
  }
}

export async function listDocumentos(query: {
  page?: string;
  limit?: string;
  search?: string;
}): Promise<PaginatedResponse<Documento>> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

  const { data, total } = await documentoRepository.findAll({
    page,
    limit,
    search: query.search,
  });

  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getDocumento(id: number): Promise<Documento> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de documento inválido');
  const documento = await documentoRepository.findById(id);
  if (!documento) throw new NotFoundError(`Documento ${id} no encontrado`);
  return documento;
}

export async function createDocumento(rawInput: unknown): Promise<Documento> {
  const input = createDocumentoSchema.parse(rawInput);
  await assertCondicionCreditoActiva(input.idCondicionCredito);

  // NIT_CLIENTE es una fotografía del dato maestro al momento de crear.
  // El saldo siempre inicia igual al total y el estado en PENDIENTE.
  const nitCliente = await catalogosRepository.findClienteNit(input.idCliente);

  const id = await documentoRepository.create({
    ...input,
    nitCliente,
  });

  return getDocumento(id);
}

export async function updateDocumento(id: number, rawInput: unknown): Promise<Documento> {
  const current = await getDocumento(id);
  const input = updateDocumentoSchema.parse(rawInput);
  await assertCondicionCreditoActiva(input.idCondicionCredito);

  if (isDocumentoBloqueadoParaAplicacion(current.estado)) {
    throw new ConflictError('Un documento pagado o anulado no puede editarse desde el CRUD.');
  }

  // Una vez que el documento tiene aplicaciones/movimientos financieros, se
  // congela su cabecera. Las correcciones deben hacerse con reversas/ajustes.
  if (hasFinancialMovement(current)) {
    throw new ConflictError(
      'El documento ya tiene movimientos financieros. No puede editarse directamente; utiliza reversa, nota de crédito o ajuste autorizado.',
    );
  }

  const finalInput = {
    idCliente: input.idCliente ?? current.idCliente,
    idTipoDocumento: input.idTipoDocumento ?? current.idTipoDocumento,
    idMoneda: input.idMoneda ?? current.idMoneda,
    serie: input.serie !== undefined ? input.serie : current.serie,
    numeroDocumento: input.numeroDocumento ?? current.numeroDocumento,
    fechaDocumento: input.fechaDocumento ?? current.fechaDocumento.slice(0, 10),
    fechaVencimiento: input.fechaVencimiento ?? current.fechaVencimiento.slice(0, 10),
    total: input.total ?? current.total,
  };
  createDocumentoSchema.parse(finalInput);

  const nextInput: documentoRepository.DocumentoInternalUpdate = { ...input };
  if (input.idCliente !== undefined && input.idCliente !== current.idCliente) {
    nextInput.nitCliente = await catalogosRepository.findClienteNit(input.idCliente);
  }

  // Si cambia el total antes de cualquier movimiento, el saldo debe seguir
  // exactamente al total. El cliente nunca envía SALDO/ESTADO.
  if (input.total !== undefined && Math.abs(input.total - current.total) > 0.005) {
    nextInput.saldo = input.total;
    nextInput.estado = 'PENDIENTE';
  }

  await documentoRepository.update(id, nextInput);
  return getDocumento(id);
}

export async function deleteDocumento(id: number): Promise<void> {
  const current = await getDocumento(id);
  const estado = String(current.estado).toUpperCase();

  if (hasFinancialMovement(current) || !['PENDIENTE', 'VENCIDO'].includes(estado)) {
    throw new ConflictError(
      'Solo se puede eliminar físicamente un documento sin movimientos y en estado pendiente. Los demás deben anularse mediante el flujo financiero.',
    );
  }

  await documentoRepository.remove(id);
}

export async function anularDocumento(id: number, rawInput: unknown): Promise<Documento> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de documento inválido');
  const input = anularDocumentoSchema.parse(rawInput);
  if (input.fechaAnulacion && input.fechaAnulacion > businessTodayIso()) {
    throw new BadRequestError('La fecha de anulación no puede ser futura');
  }
  if (!(await sharedCatalogosRepository.empleadoExiste(input.idEmpleadoAnulacion))) {
    throw new BadRequestError('El empleado seleccionado no existe');
  }

  // repository.anular() perdona el saldo restante y bloquea contra
  // PAGADO/ANULADO bajo FOR UPDATE. No toca pagos/NC/anticipos ya aplicados:
  // esos mantienen su validez histórica; para deshacer uno específico se usa
  // su propio reversar().
  await documentoRepository.anular(id, input);
  return getDocumento(id);
}
