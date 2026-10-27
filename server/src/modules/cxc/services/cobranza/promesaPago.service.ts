
import { businessTodayIso } from '../../../../shared/date';

import {
  createPromesaPagoSchema,
  updatePromesaPagoSchema,
  buildPaginationMeta,
  type PaginatedResponse,
  type PromesaPago,
} from '@erp/contracts';

import * as promesaPagoRepository from '../../repositories/cobranza/promesaPago.repository';
import * as catalogosRepository from '../../repositories/catalogos.repository';

import {
  BadRequestError,
  NotFoundError,
} from '../../../../shared/errors/AppError';

// =====================================================
// VALIDAR DOCUMENTO Y MONTO COMPROMETIDO
// =====================================================

async function assertDocumentoCliente(
  idCliente: number,
  idDocumento: number | null | undefined,
  monto: number,
): Promise<void> {
  // El documento relacionado es opcional.
  if (idDocumento == null) {
    return;
  }

  const documento =
    await catalogosRepository.findDocumentoPendienteDeCliente(
      idCliente,
      idDocumento,
    );

  if (!documento) {
    throw new BadRequestError(
      'El documento debe pertenecer al cliente y tener saldo pendiente',
    );
  }

  if (
    documento.saldo !== undefined &&
    monto > Number(documento.saldo)
  ) {
    throw new BadRequestError(
      'El monto comprometido no puede superar el saldo pendiente del documento',
    );
  }
}

// =====================================================
// VALIDAR FECHAS DE LA PROMESA
// =====================================================

function validarFechasPromesa(
  fechaPromesa: string,
  fechaCompromiso: string | null | undefined,
): void {
  const hoy = businessTodayIso();

  // La fecha en que se realizó la promesa
  // no puede ser posterior a hoy.
  if (fechaPromesa > hoy) {
    throw new BadRequestError(
      'La fecha de la promesa no puede ser futura',
    );
  }

  // La fecha de compromiso es opcional según
  // el comportamiento actual del formulario.
  if (
    fechaCompromiso &&
    fechaCompromiso < fechaPromesa
  ) {
    throw new BadRequestError(
      'La fecha comprometida no puede ser anterior a la fecha de la promesa',
    );
  }

  // No limitamos fechaCompromiso a hoy porque
  // una promesa puede tener un vencimiento futuro.
}

// =====================================================
// LISTAR PROMESAS
// =====================================================

export async function listPromesas(query: {
  page?: string;
  limit?: string;
  search?: string;
}): Promise<PaginatedResponse<PromesaPago>> {
  const page = Math.max(1, Number(query.page) || 1);

  const limit = Math.min(
    100,
    Math.max(1, Number(query.limit) || 20),
  );

  const { data, total } =
    await promesaPagoRepository.findAll({
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
// CONSULTAR PROMESA POR ID
// =====================================================

export async function getPromesa(
  id: number,
): Promise<PromesaPago> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError(
      'ID de promesa inválido',
    );
  }

  const promesa =
    await promesaPagoRepository.findById(id);

  if (!promesa) {
    throw new NotFoundError(
      `Promesa de pago ${id} no encontrada`,
    );
  }

  return promesa;
}

// =====================================================
// CREAR PROMESA
// =====================================================

export async function createPromesa(
  rawInput: unknown,
): Promise<PromesaPago> {
  const input = createPromesaPagoSchema.parse(rawInput);

  // Validar tanto la fecha de la promesa
  // como la fecha comprometida.
  validarFechasPromesa(
    input.fechaPromesa,
    input.fechaCompromiso,
  );

  // Validar documento y monto, si se seleccionó uno.
  await assertDocumentoCliente(
    input.idCliente,
    input.idDocumento,
    input.montoComprometido,
  );

  const id = await promesaPagoRepository.create(input);

  return getPromesa(id);
}

// =====================================================
// ACTUALIZAR PROMESA
// =====================================================

export async function updatePromesa(
  id: number,
  rawInput: unknown,
): Promise<PromesaPago> {
  const current = await getPromesa(id);
  const input = updatePromesaPagoSchema.parse(rawInput);

  // Obtener los valores finales de la promesa
  // para validar correctamente actualizaciones parciales.
  const fechaPromesa =
    input.fechaPromesa ??
    current.fechaPromesa.slice(0, 10);

  const fechaCompromiso =
    input.fechaCompromiso === undefined
      ? current.fechaCompromiso?.slice(0, 10)
      : input.fechaCompromiso;

  // Aplicar exactamente las mismas reglas que al crear.
  validarFechasPromesa(
    fechaPromesa,
    fechaCompromiso,
  );

  // Revisar el documento cuando cambia el cliente,
  // el documento relacionado o el monto comprometido.
  if (
    input.idCliente !== undefined ||
    input.idDocumento !== undefined ||
    input.montoComprometido !== undefined
  ) {
    const finalIdCliente =
      input.idCliente ?? current.idCliente;

    const finalIdDocumento =
      input.idDocumento === undefined
        ? current.idDocumento
        : input.idDocumento;

    const finalMonto =
      input.montoComprometido ??
      current.montoComprometido;

    await assertDocumentoCliente(
      finalIdCliente,
      finalIdDocumento,
      finalMonto,
    );
  }

  await promesaPagoRepository.update(id, input);

  return getPromesa(id);
}

// =====================================================
// ELIMINAR PROMESA
// =====================================================

export async function deletePromesa(
  id: number,
): Promise<void> {
  await getPromesa(id);

  await promesaPagoRepository.remove(id);
}
