
import { businessTodayIso } from '../../../../shared/date';

import {
  createReciboSchema,
  updateReciboSchema,
  buildPaginationMeta,
  type PaginatedResponse,
  type Recibo,
} from '@erp/contracts';

import * as repository from '../../repositories/pagos/recibo.repository';
import * as pagoRepository from '../../repositories/pagos/pago.repository';

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../../../shared/errors/AppError';

// =====================================================
// LISTAR RECIBOS
// =====================================================

export async function listRecibos(q: {
  page?: string;
  limit?: string;
  search?: string;
}): Promise<PaginatedResponse<Recibo>> {
  const page = Math.max(1, Number(q.page) || 1);

  const limit = Math.min(
    100,
    Math.max(1, Number(q.limit) || 20),
  );

  const { data, total } = await repository.findAll({
    page,
    limit,
    search: q.search,
  });

  return {
    data,
    meta: buildPaginationMeta(total, page, limit),
  };
}

// =====================================================
// CONSULTAR RECIBO POR ID
// =====================================================

export async function getRecibo(
  id: number,
): Promise<Recibo> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError('ID de recibo inválido');
  }

  const item = await repository.findById(id);

  if (!item) {
    throw new NotFoundError(
      `Recibo ${id} no encontrado`,
    );
  }

  return item;
}

// =====================================================
// VALIDAR PAGO, CLIENTE, MONTO Y FECHA
// =====================================================

async function assertPagoCliente(
  idPago: number,
  idCliente: number,
  monto: number,
  fechaRecibo: string,
): Promise<void> {
  const pago = await pagoRepository.findById(idPago);

  if (!pago) {
    throw new BadRequestError(
      'El pago seleccionado no existe',
    );
  }

  // Verificar que ambos registros correspondan
  // al mismo cliente.

  if (pago.idCliente !== idCliente) {
    throw new BadRequestError(
      'El recibo y el pago deben pertenecer al mismo cliente',
    );
  }

  // Evitar registrar recibos relacionados con
  // pagos anulados o reversados.

  const estadoPago = String(
    pago.estado ?? '',
  ).trim().toUpperCase();

  if (
    ['ANULADO', 'REVERSADO'].includes(estadoPago)
  ) {
    throw new BadRequestError(
      'No se pueden registrar recibos para pagos anulados o reversados',
    );
  }

  // Verificar que el monto sea válido.

  if (
    !Number.isFinite(monto) ||
    monto <= 0
  ) {
    throw new BadRequestError(
      'El monto del recibo debe ser mayor a cero',
    );
  }

  if (monto > pago.monto) {
    throw new BadRequestError(
      'El monto del recibo no puede superar el monto del pago',
    );
  }

  // Verificar que la fecha del recibo no sea
  // anterior a la fecha original del pago.

  const fechaPago = pago.fechaPago.slice(0, 10);

  if (fechaRecibo < fechaPago) {
    throw new BadRequestError(
      'La fecha del recibo no puede ser anterior a la fecha del pago',
    );
  }

  // Verificar nuevamente la fecha actual
  // del negocio en Guatemala.

  if (fechaRecibo > businessTodayIso()) {
    throw new BadRequestError(
      'La fecha del recibo no puede ser futura',
    );
  }
}

// =====================================================
// CREAR RECIBO
// =====================================================

export async function createRecibo(
  raw: unknown,
): Promise<Recibo> {
  const input = createReciboSchema.parse(raw);

  if (input.fecha > businessTodayIso()) {
    throw new BadRequestError(
      'La fecha del recibo no puede ser futura',
    );
  }

  await assertPagoCliente(
    input.idPago,
    input.idCliente,
    input.monto,
    input.fecha,
  );

  const id = await repository.create(input);

  return getRecibo(id);
}

// =====================================================
// ACTUALIZAR RECIBO
// =====================================================

export async function updateRecibo(
  id: number,
  raw: unknown,
): Promise<Recibo> {
  const current = await getRecibo(id);

  // Los recibos emitidos deben mantener sus datos
  // financieros originales.

  const estadoActual = String(
    current.estado ?? '',
  ).trim().toUpperCase();

  if (estadoActual === 'EMITIDO') {
    throw new ConflictError(
      'Un recibo emitido no puede editarse directamente. Debe utilizarse el procedimiento de corrección o anulación correspondiente.',
    );
  }

  const input = updateReciboSchema.parse(raw);

  const finalFecha =
    input.fecha ?? current.fecha.slice(0, 10);

  if (finalFecha > businessTodayIso()) {
    throw new BadRequestError(
      'La fecha del recibo no puede ser futura',
    );
  }

  const idPago =
    input.idPago ?? current.idPago;

  const idCliente =
    input.idCliente ?? current.idCliente;

  const monto =
    input.monto ?? current.monto;

  await assertPagoCliente(
    idPago,
    idCliente,
    monto,
    finalFecha,
  );

  await repository.update(id, input);

  return getRecibo(id);
}

// =====================================================
// ELIMINAR RECIBO
// =====================================================

export async function deleteRecibo(
  id: number,
): Promise<void> {
  const current = await getRecibo(id);

  const estadoActual = String(
    current.estado ?? '',
  ).trim().toUpperCase();

  // Impedir que los recibos emitidos se eliminen
  // físicamente de la base de datos.

  if (estadoActual === 'EMITIDO') {
    throw new ConflictError(
      'Un recibo emitido no puede eliminarse físicamente. Debe conservarse su trazabilidad financiera.',
    );
  }

  await repository.remove(id);
}
