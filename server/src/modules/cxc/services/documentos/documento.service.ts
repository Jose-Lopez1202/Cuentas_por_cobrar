
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

import {
  hasFinancialMovement as hasMovement,
  isDocumentoBloqueadoParaAplicacion,
} from '../../shared/financialRules';

const hasFinancialMovement = (documento: Documento) =>
  hasMovement(documento.total, documento.saldo);

async function assertCondicionCreditoActiva(
  idCondicionCredito: number | null | undefined,
) {
  if (!idCondicionCredito) return;

  const condicion = await condicionCreditoRepository.findById(idCondicionCredito);

  if (!condicion) {
    throw new BadRequestError('La condición de crédito seleccionada no existe');
  }

  if (condicion.estado !== 'A') {
    throw new BadRequestError('La condición de crédito seleccionada está inactiva');
  }
}

// =====================================================
// VALIDACIONES DE FECHAS
// =====================================================

function validarFechaCreacion(fechaDocumento: string): void {
  const fechaActual = businessTodayIso();

  if (fechaDocumento !== fechaActual) {
    throw new BadRequestError(
      'La fecha de creación del documento debe ser la fecha actual de Guatemala.',
    );
  }
}

function validarFechaVencimiento(
  fechaDocumento: string,
  fechaVencimiento: string,
): void {
  if (fechaVencimiento < fechaDocumento) {
    throw new BadRequestError(
      'La fecha de vencimiento no puede ser anterior a la fecha del documento.',
    );
  }
}

// =====================================================
// LISTAR DOCUMENTOS
// =====================================================

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

  return {
    data,
    meta: buildPaginationMeta(total, page, limit),
  };
}

// =====================================================
// OBTENER DOCUMENTO
// =====================================================

export async function getDocumento(id: number): Promise<Documento> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError('ID de documento inválido');
  }

  const documento = await documentoRepository.findById(id);

  if (!documento) {
    throw new NotFoundError(`Documento ${id} no encontrado`);
  }

  return documento;
}

// =====================================================
// CREAR DOCUMENTO
// =====================================================

export async function createDocumento(
  rawInput: unknown,
): Promise<Documento> {
  const input = createDocumentoSchema.parse(rawInput);

  // La fecha de creación debe ser la fecha actual.
  validarFechaCreacion(input.fechaDocumento);

  // El vencimiento debe ser igual o posterior a la creación.
  validarFechaVencimiento(
    input.fechaDocumento,
    input.fechaVencimiento,
  );

  await assertCondicionCreditoActiva(input.idCondicionCredito);

  // NIT_CLIENTE es una fotografía del dato maestro
  // al momento de crear el documento.
  // El saldo inicia igual al total y el estado en PENDIENTE.
  const nitCliente = await catalogosRepository.findClienteNit(
    input.idCliente,
  );

  const id = await documentoRepository.create({
    ...input,
    nitCliente,
  });

  return getDocumento(id);
}

// =====================================================
// ACTUALIZAR DOCUMENTO
// =====================================================

export async function updateDocumento(
  id: number,
  rawInput: unknown,
): Promise<Documento> {
  const current = await getDocumento(id);
  const input = updateDocumentoSchema.parse(rawInput);

  await assertCondicionCreditoActiva(input.idCondicionCredito);

  if (isDocumentoBloqueadoParaAplicacion(current.estado)) {
    throw new ConflictError(
      'Un documento pagado o anulado no puede editarse desde el CRUD.',
    );
  }

  // Los documentos con movimientos financieros
  // no pueden modificarse directamente.
  if (hasFinancialMovement(current)) {
    throw new ConflictError(
      'El documento ya tiene movimientos financieros. No puede editarse directamente; utiliza reversa, nota de crédito o ajuste autorizado.',
    );
  }

  // La fecha original no puede modificarse.
  const fechaOriginal = current.fechaDocumento.slice(0, 10);

  if (
    input.fechaDocumento !== undefined &&
    input.fechaDocumento !== fechaOriginal
  ) {
    throw new BadRequestError(
      'La fecha original del documento no puede modificarse.',
    );
  }

  const finalInput = {
    idCliente: input.idCliente ?? current.idCliente,
    idTipoDocumento:
      input.idTipoDocumento ?? current.idTipoDocumento,
    idMoneda: input.idMoneda ?? current.idMoneda,
    serie:
      input.serie !== undefined
        ? input.serie
        : current.serie,
    numeroDocumento:
      input.numeroDocumento ?? current.numeroDocumento,
    fechaDocumento: fechaOriginal,
    fechaVencimiento:
      input.fechaVencimiento ??
      current.fechaVencimiento.slice(0, 10),
    total: input.total ?? current.total,
  };

  // Validaciones del contrato.
  createDocumentoSchema.parse(finalInput);

  // Verifica que la fecha de vencimiento sea válida.
  validarFechaVencimiento(
    finalInput.fechaDocumento,
    finalInput.fechaVencimiento,
  );

  const nextInput: documentoRepository.DocumentoInternalUpdate = {
    ...input,
  };

  // Impide cambiar la fecha original en el repositorio.
  delete nextInput.fechaDocumento;

  if (
    input.idCliente !== undefined &&
    input.idCliente !== current.idCliente
  ) {
    nextInput.nitCliente =
      await catalogosRepository.findClienteNit(input.idCliente);
  }

  // Si cambia el total antes de cualquier movimiento,
  // el saldo debe mantenerse igual al nuevo total.
  if (
    input.total !== undefined &&
    Math.abs(input.total - current.total) > 0.005
  ) {
    nextInput.saldo = input.total;
    nextInput.estado = 'PENDIENTE';
  }

  await documentoRepository.update(id, nextInput);

  return getDocumento(id);
}

// =====================================================
// ELIMINAR DOCUMENTO
// =====================================================

export async function deleteDocumento(id: number): Promise<void> {
  const current = await getDocumento(id);
  const estado = String(current.estado).toUpperCase();

  if (
    hasFinancialMovement(current) ||
    !['PENDIENTE', 'VENCIDO'].includes(estado)
  ) {
    throw new ConflictError(
      'Solo se puede eliminar físicamente un documento sin movimientos y en estado pendiente. Los demás deben anularse mediante el flujo financiero.',
    );
  }

  await documentoRepository.remove(id);
}

// =====================================================
// ANULAR DOCUMENTO
// =====================================================

export async function anularDocumento(
  id: number,
  rawInput: unknown,
): Promise<Documento> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError('ID de documento inválido');
  }

  const input = anularDocumentoSchema.parse(rawInput);

  if (
    input.fechaAnulacion &&
    input.fechaAnulacion > businessTodayIso()
  ) {
    throw new BadRequestError(
      'La fecha de anulación no puede ser futura',
    );
  }

  if (
    !(await sharedCatalogosRepository.empleadoExiste(
      input.idEmpleadoAnulacion,
    ))
  ) {
    throw new BadRequestError(
      'El empleado seleccionado no existe',
    );
  }

  // La anulación perdona el saldo restante.
  // Los movimientos históricos mantienen su validez.
  await documentoRepository.anular(id, input);

  return getDocumento(id);
}
