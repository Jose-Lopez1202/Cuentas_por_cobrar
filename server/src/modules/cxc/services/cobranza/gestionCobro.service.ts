import { businessTodayIso } from '../../../../shared/date';
import {
  createGestionCobroSchema,
  updateGestionCobroSchema,
  buildPaginationMeta,
  type PaginatedResponse,
  type GestionCobro,
} from '@erp/contracts';
import { BadRequestError, NotFoundError } from '../../../../shared/errors/AppError';
import * as gestionCobroRepository from '../../repositories/cobranza/gestionCobro.repository';
import * as promesaPagoRepository from '../../repositories/cobranza/promesaPago.repository';
import * as catalogosRepository from '../../repositories/catalogos.repository';

function assertId(id: number, label = 'ID') {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError(`${label} inválido`);
}


async function assertRelaciones(input: { idCliente: number; idEmpleado: number; idDocumento?: number | null }) {
  const [clienteOk, empleadoOk] = await Promise.all([
    catalogosRepository.clienteExiste(input.idCliente),
    catalogosRepository.empleadoExiste(input.idEmpleado),
  ]);
  if (!clienteOk) throw new BadRequestError('El cliente seleccionado no existe');
  if (!empleadoOk) throw new BadRequestError('El empleado responsable no existe');
  if (input.idDocumento) {
    const documento = await catalogosRepository.findDocumentoPendienteDeCliente(input.idCliente, input.idDocumento);
    if (!documento) throw new BadRequestError('El documento debe pertenecer al cliente y tener saldo pendiente');
  }
}

export async function listGestiones(query: { page?: string; limit?: string; search?: string }): Promise<PaginatedResponse<GestionCobro>> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const { data, total } = await gestionCobroRepository.findAll({ page, limit, search: query.search });
  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getGestion(id: number): Promise<GestionCobro> {
  assertId(id, 'ID de gestión');
  const gestion = await gestionCobroRepository.findById(id);
  if (!gestion) throw new NotFoundError(`Gestión de cobro ${id} no encontrada`);
  return gestion;
}

export async function createGestion(rawInput: unknown): Promise<GestionCobro> {
  const input = createGestionCobroSchema.parse(rawInput);
  if (input.fechaCompromiso && input.fechaCompromiso < businessTodayIso()) {
    throw new BadRequestError('La fecha de compromiso no puede ser anterior a hoy');
  }
  await assertRelaciones(input);
  const id = await gestionCobroRepository.create(input);

  // Si la gestión registra un compromiso real (fecha + monto), se formaliza
  // automáticamente como CXC_PROMESAS_PAGO ligada a esta gestión (ID_GESTION),
  // en vez de dejar que el usuario tenga que capturar el mismo compromiso dos
  // veces en dos pantallas distintas. Es un best-effort informativo (no
  // comparte transacción con la gestión): si falla, la gestión ya quedó
  // registrada de todas formas y no es una pérdida financiera.
  if (input.fechaCompromiso && input.montoCompromiso) {
    try {
      await promesaPagoRepository.create({
        idCliente: input.idCliente,
        idDocumento: input.idDocumento ?? null,
        idGestion: id,
        fechaPromesa: businessTodayIso(),
        fechaCompromiso: input.fechaCompromiso,
        montoComprometido: input.montoCompromiso,
        estado: 'PENDIENTE',
        observaciones: `Generada automáticamente desde la gestión de cobro #${id}.`,
      });
    } catch {
      // No bloquea la creación de la gestión; el usuario siempre puede
      // registrar la promesa manualmente desde su propia pantalla.
    }
  }

  return getGestion(id);
}

export async function updateGestion(id: number, rawInput: unknown): Promise<GestionCobro> {
  const current = await getGestion(id);
  const input = updateGestionCobroSchema.parse(rawInput);
  if (input.fechaCompromiso && input.fechaCompromiso < businessTodayIso()) {
    throw new BadRequestError('La fecha de compromiso no puede ser anterior a hoy');
  }
  if (input.idCliente !== undefined || input.idEmpleado !== undefined || input.idDocumento !== undefined) {
    await assertRelaciones({
      idCliente: input.idCliente ?? current.idCliente,
      idEmpleado: input.idEmpleado ?? current.idEmpleado,
      idDocumento: input.idDocumento === undefined ? current.idDocumento : input.idDocumento,
    });
  }
  await gestionCobroRepository.update(id, input);
  return getGestion(id);
}

export async function deleteGestion(id: number): Promise<void> {
  await getGestion(id);
  await gestionCobroRepository.remove(id);
}
