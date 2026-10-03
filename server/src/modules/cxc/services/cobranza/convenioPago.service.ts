import { businessTodayIso } from '../../../../shared/date';
import {
  createConvenioPagoSchema,
  updateConvenioPagoSchema,
  registrarPagoCuotaSchema,
  buildPaginationMeta,
  type PaginatedResponse,
  type ConvenioPago,
  type ConvenioCuota,
  type ConvenioDocumento,
} from '@erp/contracts';
import * as convenioPagoRepository from '../../repositories/cobranza/convenioPago.repository';
import * as convenioCuotaRepository from '../../repositories/cobranza/convenioCuota.repository';
import * as convenioDocumentoRepository from '../../repositories/cobranza/convenioDocumento.repository';
import * as catalogosRepository from '../../repositories/catalogos.repository';
import { BadRequestError, NotFoundError } from '../../../../shared/errors/AppError';
import { EPSILON, roundMoney } from '../../shared/financialRules';


export async function listConvenios(query: { page?: string; limit?: string; search?: string }): Promise<PaginatedResponse<ConvenioPago>> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const { data, total } = await convenioPagoRepository.findAll({ page, limit, search: query.search });
  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getConvenio(id: number): Promise<ConvenioPago> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de convenio inválido');
  const convenio = await convenioPagoRepository.findById(id);
  if (!convenio) throw new NotFoundError(`Convenio de pago ${id} no encontrado`);
  return convenio;
}

function addMonthsClamped(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const targetMonthIndex = (month - 1) + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

function generarPlanDeCuotas(montoDeuda: number, numeroCuotas: number, fechaConvenio: string) {
  const totalCentavos = Math.round(montoDeuda * 100);
  const baseCentavos = Math.floor(totalCentavos / numeroCuotas);
  const residuo = totalCentavos - baseCentavos * numeroCuotas;
  return Array.from({ length: numeroCuotas }, (_, i) => {
    const numeroCuota = i + 1;
    const centavos = baseCentavos + (i === numeroCuotas - 1 ? residuo : 0);
    return { numeroCuota, fechaVencimiento: addMonthsClamped(fechaConvenio, numeroCuota), monto: centavos / 100 };
  });
}

export async function createConvenio(rawInput: unknown): Promise<ConvenioPago> {
  const input = createConvenioPagoSchema.parse(rawInput);
  if (input.fechaConvenio > businessTodayIso()) throw new BadRequestError('La fecha del convenio no puede ser futura');
  if (input.estado !== 'ACTIVO') throw new BadRequestError('Un convenio nuevo debe iniciar como ACTIVO.');
  if (input.estado !== 'ACTIVO') throw new BadRequestError('Un convenio nuevo debe iniciar como ACTIVO.');
  if (!(await catalogosRepository.clienteExiste(input.idCliente))) throw new BadRequestError('El cliente seleccionado no existe');
  if (!(await catalogosRepository.clienteElegibleParaConvenio(input.idCliente))) {
    throw new BadRequestError('El cliente debe tener al menos una promesa incumplida o una mora vigente antes de generar un convenio.');
  }

  // El convenio negocia una deuda global, pero esa deuda siempre viene de
  // documentos reales: sin verificar esto, pagar una cuota no tendría a qué
  // documento bajarle el saldo (ver convenioCuota.repository.ts::registrarPago).
  const idsVistos = new Set<number>();
  let sumaIncluida = 0;
  for (const doc of input.documentos) {
    if (idsVistos.has(doc.idDocumento)) throw new BadRequestError('No se puede incluir el mismo documento dos veces en el convenio');
    idsVistos.add(doc.idDocumento);
    const documento = await catalogosRepository.findDocumentoPendienteDeCliente(input.idCliente, doc.idDocumento);
    if (!documento) throw new BadRequestError(`El documento #${doc.idDocumento} no existe, no pertenece al cliente o ya no tiene saldo pendiente`);
    if (doc.montoIncluido > Number(documento.saldo) + EPSILON) {
      throw new BadRequestError(`El monto incluido para el documento #${doc.idDocumento} no puede superar su saldo pendiente (Q ${Number(documento.saldo).toFixed(2)})`);
    }
    sumaIncluida = roundMoney(sumaIncluida + doc.montoIncluido);
  }
  if (Math.abs(sumaIncluida - roundMoney(input.montoDeuda)) > EPSILON) {
    throw new BadRequestError(`La suma de los montos incluidos (Q ${sumaIncluida.toFixed(2)}) debe ser igual al monto de la deuda (Q ${Number(input.montoDeuda).toFixed(2)})`);
  }

  const plan = generarPlanDeCuotas(input.montoDeuda, input.numeroCuotas, input.fechaConvenio);
  const id = await convenioPagoRepository.createConCuotas(input, plan, input.documentos);
  return getConvenio(id);
}

export async function getDocumentosDeConvenio(idConvenio: number): Promise<ConvenioDocumento[]> {
  await getConvenio(idConvenio);
  return convenioDocumentoRepository.findByConvenio(idConvenio);
}

/** Botón manual "Recalcular incumplimiento" — mismo patrón que Mora. */
export async function recalcularConvenios(): Promise<{ actualizados: number }> {
  const actualizados = await convenioPagoRepository.recalcularIncumplidos();
  return { actualizados };
}

export async function updateConvenio(id: number, rawInput: unknown): Promise<ConvenioPago> {
  const input = updateConvenioPagoSchema.parse(rawInput);
  await getConvenio(id);
  // El repositorio solo permite editar estado/observaciones: monto, fecha y cuotas
  // quedan inmutables para no desalinear el plan generado.
  await convenioPagoRepository.update(id, input);
  return getConvenio(id);
}

export async function deleteConvenio(id: number): Promise<void> {
  await getConvenio(id);
  await convenioPagoRepository.remove(id);
}

export async function getCuotasDeConvenio(idConvenio: number): Promise<ConvenioCuota[]> {
  await getConvenio(idConvenio);
  return convenioCuotaRepository.findByConvenio(idConvenio);
}

export async function registrarPagoCuota(idCuota: number, rawInput: unknown): Promise<ConvenioCuota> {
  if (!Number.isInteger(idCuota) || idCuota <= 0) throw new BadRequestError('ID de cuota inválido');
  const input = registrarPagoCuotaSchema.parse(rawInput);
  // El saldo/estado de la cuota se valida de forma autoritativa dentro de
  // convenioCuotaRepository.registrarPago, bajo FOR UPDATE. Repetir el mismo
  // chequeo aquí con una lectura sin bloqueo sería redundante y podía
  // desalinearse de la tolerancia real (ver EPSILON en financialRules.ts).
  const formas = await catalogosRepository.listFormasPagoActivas();
  const forma = formas.find((item) => item.id === input.idFormaPago);
  if (!forma) throw new BadRequestError('La forma de pago seleccionada no está activa o no existe');
  if (forma.requiereReferencia && !input.referenciaPago) throw new BadRequestError(`${forma.label} requiere un número de referencia`);
  if (!(await catalogosRepository.empleadoExiste(input.idEmpleado))) throw new BadRequestError('El empleado seleccionado no existe');
  return convenioCuotaRepository.registrarPago(idCuota, input.montoPagado, input.idFormaPago, input.referenciaPago ?? undefined, input.idEmpleado);
}
