import {
  createAjusteSchema,
  updateAjusteSchema,
  aprobarAjusteSchema,
  rechazarAjusteSchema,
  buildPaginationMeta,
  type Ajuste,
  type PaginatedResponse,
} from '@erp/contracts';
import { businessTodayIso } from '../../../../shared/date';
import * as ajusteRepository from '../../repositories/documentos/ajuste.repository';
import * as documentoRepository from '../../repositories/documentos/documento.repository';
import * as catalogosRepository from '../../repositories/catalogos.repository';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';
import { isDocumentoBloqueadoParaAplicacion } from '../../shared/financialRules';

export async function listAjustes(query: {
  page?: string;
  limit?: string;
  search?: string;
}): Promise<PaginatedResponse<Ajuste>> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const { data, total } = await ajusteRepository.findAll({ page, limit, search: query.search });
  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getAjuste(id: number): Promise<Ajuste> {
  const ajuste = await ajusteRepository.findById(id);
  if (!ajuste) throw new NotFoundError(`Ajuste ${id} no encontrado`);
  return ajuste;
}

async function validateDocumentRelation(
  idCliente: number,
  idDocumento: number | null | undefined,
  tipoAjuste: string,
  monto: number,
) {
  if (!idDocumento) return;
  const documento = await documentoRepository.findById(idDocumento);
  if (!documento) throw new BadRequestError('El documento seleccionado no existe');
  if (documento.idCliente !== idCliente) {
    throw new BadRequestError('El documento debe pertenecer al cliente seleccionado');
  }
  if (isDocumentoBloqueadoParaAplicacion(documento.estado)) {
    throw new BadRequestError('No se puede registrar un ajuste sobre un documento pagado o anulado');
  }
  if (tipoAjuste === 'CREDITO' && monto > Number(documento.saldo) + 0.005) {
    throw new BadRequestError('Un ajuste crédito no puede superar el saldo pendiente del documento');
  }
}

function assertPendiente(ajuste: Ajuste, accion: string) {
  if (ajuste.estado !== 'PENDIENTE') {
    throw new ConflictError(`Solo un ajuste pendiente puede ${accion}. Este ajuste ya está ${ajuste.estado.toLowerCase()}.`);
  }
}

/** Aprobar/rechazar aceptan PENDIENTE (1ra instancia) o EN_2DA_APROBACION (2da instancia). */
function assertAprobable(ajuste: Ajuste, accion: string) {
  if (ajuste.estado !== 'PENDIENTE' && ajuste.estado !== 'EN_2DA_APROBACION') {
    throw new ConflictError(`Solo un ajuste pendiente o en segunda aprobación puede ${accion}. Este ajuste ya está ${ajuste.estado.toLowerCase()}.`);
  }
}

export async function createAjuste(rawInput: unknown): Promise<Ajuste> {
  const input = createAjusteSchema.parse(rawInput);
  await validateDocumentRelation(input.idCliente, input.idDocumento, input.tipoAjuste, input.monto);

  // El ajuste nace PENDIENTE y NO altera el saldo todavía: el efecto
  // financiero solo ocurre al aprobarlo (ver aprobarAjuste más abajo).
  const id = await ajusteRepository.create(input);
  return getAjuste(id);
}

export async function updateAjuste(id: number, rawInput: unknown): Promise<Ajuste> {
  const current = await getAjuste(id);
  assertPendiente(current, 'editarse');
  const input = updateAjusteSchema.parse(rawInput);

  const idCliente = input.idCliente ?? current.idCliente;
  const idDocumento = input.idDocumento === undefined ? current.idDocumento : input.idDocumento;
  const tipoAjuste = input.tipoAjuste ?? current.tipoAjuste;
  const monto = input.monto ?? current.monto;
  await validateDocumentRelation(idCliente, idDocumento, tipoAjuste, monto);

  await ajusteRepository.update(id, input);
  return getAjuste(id);
}

export async function deleteAjuste(id: number): Promise<void> {
  const current = await getAjuste(id);
  assertPendiente(current, 'eliminarse');
  await ajusteRepository.remove(id);
}

export async function aprobarAjuste(id: number, rawInput: unknown): Promise<Ajuste> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de ajuste inválido');
  const input = aprobarAjusteSchema.parse(rawInput);
  if (input.fechaAprobacion && input.fechaAprobacion > businessTodayIso()) {
    throw new BadRequestError('La fecha de aprobación no puede ser futura');
  }
  if (!(await catalogosRepository.empleadoExiste(input.idEmpleadoAprobador))) {
    throw new BadRequestError('El empleado aprobador seleccionado no existe');
  }

  const current = await getAjuste(id);
  assertAprobable(current, 'aprobarse');
  if (current.estado === 'EN_2DA_APROBACION' && current.idEmpleadoAprobador === input.idEmpleadoAprobador) {
    throw new BadRequestError('El segundo aprobador debe ser distinto al empleado que dio la primera aprobación.');
  }

  // ajusteRepository.aprobar() vuelve a validar todo con datos frescos y
  // bajo FOR UPDATE (el saldo pudo cambiar desde que se creó la solicitud).
  await ajusteRepository.aprobar(id, input);
  return getAjuste(id);
}

export async function rechazarAjuste(id: number, rawInput: unknown): Promise<Ajuste> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de ajuste inválido');
  const input = rechazarAjusteSchema.parse(rawInput);
  if (input.fechaAprobacion && input.fechaAprobacion > businessTodayIso()) {
    throw new BadRequestError('La fecha de rechazo no puede ser futura');
  }
  if (!(await catalogosRepository.empleadoExiste(input.idEmpleadoAprobador))) {
    throw new BadRequestError('El empleado seleccionado no existe');
  }

  const current = await getAjuste(id);
  assertAprobable(current, 'rechazarse');

  await ajusteRepository.rechazar(id, input);
  return getAjuste(id);
}
