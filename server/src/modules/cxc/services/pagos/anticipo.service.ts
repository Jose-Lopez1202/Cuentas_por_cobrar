import { businessTodayIso } from '../../../../shared/date';
import {
  createAnticipoSchema,
  updateAnticipoSchema,
  anularAnticipoSchema,
  buildPaginationMeta,
  type PaginatedResponse,
  type Anticipo,
} from '@erp/contracts';
import * as repository from '../../repositories/pagos/anticipo.repository';
import * as pagoRepository from '../../repositories/pagos/pago.repository';
import * as aplicacionRepository from '../../repositories/pagos/aplicacionAnticipo.repository';
import * as catalogosRepository from '../../repositories/catalogos.repository';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';


export async function listAnticipos(q: {
  page?: string;
  limit?: string;
  search?: string;
}): Promise<PaginatedResponse<Anticipo>> {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  const { data, total } = await repository.findAll({ page, limit, search: q.search });
  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getAnticipo(id: number): Promise<Anticipo> {
  const item = await repository.findById(id);
  if (!item) throw new NotFoundError(`Anticipo ${id} no encontrado`);
  return item;
}

async function assertPagoCliente(idPago: number | null | undefined, idCliente: number) {
  if (!idPago) return;
  const pago = await pagoRepository.findById(idPago);
  if (!pago) throw new BadRequestError('El pago relacionado no existe');
  if (pago.idCliente !== idCliente) {
    throw new BadRequestError('El anticipo y el pago relacionado deben pertenecer al mismo cliente');
  }
}

export async function createAnticipo(raw: unknown): Promise<Anticipo> {
  const input = createAnticipoSchema.parse(raw);
  if (input.fecha > businessTodayIso()) throw new BadRequestError('La fecha del anticipo no puede ser futura');
  await assertPagoCliente(input.idPago, input.idCliente);
  const id = await repository.create(input);
  return getAnticipo(id);
}

export async function updateAnticipo(id: number, raw: unknown): Promise<Anticipo> {
  const current = await getAnticipo(id);
  const aplicado = await aplicacionRepository.sumAplicadoPorAnticipo(id);
  if (aplicado > 0.005) {
    throw new ConflictError(
      'El anticipo ya tiene aplicaciones y no puede editarse directamente. Primero debe reversarse la aplicación.',
    );
  }

  const input = updateAnticipoSchema.parse(raw);
  const finalFecha = input.fecha ?? current.fecha.slice(0, 10);
  if (finalFecha > businessTodayIso()) throw new BadRequestError('La fecha del anticipo no puede ser futura');

  const finalMontoOriginal = input.montoOriginal ?? current.montoOriginal;
  const finalMontoDisponible = input.montoDisponible ?? current.montoDisponible;
  if (finalMontoDisponible > finalMontoOriginal) {
    throw new BadRequestError('El monto disponible no puede superar el monto original');
  }

  await assertPagoCliente(input.idPago ?? current.idPago, input.idCliente ?? current.idCliente);
  await repository.update(id, input);
  return getAnticipo(id);
}

export async function deleteAnticipo(id: number): Promise<void> {
  const current = await getAnticipo(id);
  const aplicado = await aplicacionRepository.sumAplicadoPorAnticipo(id);
  if (aplicado > 0.005) {
    throw new ConflictError('Un anticipo aplicado no se elimina. Debe reversarse/anularse para conservar trazabilidad.');
  }
  if (!['DISPONIBLE'].includes(String(current.estado).toUpperCase())) {
    throw new ConflictError('Solo un anticipo disponible y sin aplicaciones puede eliminarse físicamente.');
  }
  await repository.remove(id);
}

export async function anularAnticipo(id: number, rawInput: unknown): Promise<Anticipo> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de anticipo inválido');
  const input = anularAnticipoSchema.parse(rawInput);
  if (input.fechaAnulacion && input.fechaAnulacion > businessTodayIso()) {
    throw new BadRequestError('La fecha de anulación no puede ser futura');
  }
  if (!(await catalogosRepository.empleadoExiste(input.idEmpleadoAnulacion))) {
    throw new BadRequestError('El empleado seleccionado no existe');
  }

  await getAnticipo(id);
  await repository.anular(id, input);
  return getAnticipo(id);
}
