import {
  anularFacturaSchema,
  buildPaginationMeta,
  emitirFacturaSchema,
  type EmitirFacturaInput,
  type FacturaFel,
  type FacturaFelDetalle,
  type PaginatedResponse,
  type ValidacionSat,
} from '@erp/contracts';
import { BadRequestError, NotFoundError, SatRechazoError } from '../../../../shared/errors/AppError';
import * as repo from '../../repositories/facturacion/factura.repository';
import {
  calcularTotales,
  formatearNit,
  generarUuidAutorizacion,
  generarXmlDte,
  normalizarNit,
  serieFelParaEmpresa,
  validarFactura,
} from '../../shared/satSimulator';

function sumarDias(isoDate: string, dias: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + dias));
  return date.toISOString().slice(0, 10);
}

/** Corre las reglas del certificador simulado sin guardar nada. */
async function evaluar(input: EmitirFacturaInput) {
  const [emisor, cliente, moneda, idTipo] = await Promise.all([
    repo.getEmisor(),
    repo.getCliente(input.idCliente),
    repo.getMoneda(input.idMoneda),
    repo.getTipoFacturaId(),
  ]);
  const diasCredito = input.idCondicionCredito ? await repo.getDiasCredito(input.idCondicionCredito) : 0;

  const nitReceptor = normalizarNit(input.nitReceptor ?? cliente?.nit ?? 'CF') || 'CF';
  const nombreReceptor = (input.nombreReceptor?.trim() || (nitReceptor === 'CF' ? 'Consumidor Final' : cliente?.nombre) || '').trim();
  const totales = calcularTotales(input.lineas);
  const fechaVencimiento = sumarDias(input.fechaEmision, diasCredito ?? 0);

  const { errores, advertencias } = validarFactura({
    emisor: emisor ? { nit: emisor.nit, nombre: emisor.nombre } : null,
    nitReceptor,
    nombreReceptor,
    fechaEmision: input.fechaEmision,
    total: totales.total,
    tipoFacturaConfigurado: idTipo !== null,
    monedaValida: moneda !== null,
    condicionValida: diasCredito !== null,
    clienteExiste: cliente !== null,
  });

  const validacion: ValidacionSat = {
    valida: errores.length === 0,
    errores,
    advertencias,
    nitEmisor: emisor?.nit ? formatearNit(emisor.nit) : null,
    nombreEmisor: emisor?.nombre ?? null,
    nitReceptor: nitReceptor === 'CF' ? 'CF' : formatearNit(nitReceptor),
    nombreReceptor,
    subtotalGravado: totales.subtotalGravado,
    iva: totales.iva,
    total: totales.total,
    fechaVencimiento,
  };
  return { validacion, emisor, moneda, idTipo, totales, nitReceptor, nombreReceptor, fechaVencimiento };
}

export async function validarFacturaSat(rawInput: unknown): Promise<ValidacionSat> {
  const input = emitirFacturaSchema.parse(rawInput);
  return (await evaluar(input)).validacion;
}

export async function emitirFactura(rawInput: unknown): Promise<FacturaFelDetalle> {
  const input = emitirFacturaSchema.parse(rawInput);
  const ev = await evaluar(input);
  if (!ev.validacion.valida) throw new SatRechazoError(ev.validacion.errores);

  const emisor = ev.emisor!;
  const serieFel = serieFelParaEmpresa(emisor.idEmpresa);
  const uuid = generarUuidAutorizacion();

  const idFactura = await repo.emitir({
    idEmpresa: emisor.idEmpresa,
    idCliente: input.idCliente,
    idTipoDocumento: ev.idTipo!,
    idMoneda: input.idMoneda,
    idCondicionCredito: input.idCondicionCredito ?? null,
    idEmpleado: input.idEmpleado,
    serieFel,
    uuid,
    fechaEmision: input.fechaEmision,
    fechaVencimiento: ev.fechaVencimiento,
    nitEmisor: normalizarNit(emisor.nit),
    nombreEmisor: emisor.nombre,
    nitReceptor: ev.nitReceptor,
    nombreReceptor: ev.nombreReceptor,
    subtotalGravado: ev.totales.subtotalGravado,
    iva: ev.totales.iva,
    total: ev.totales.total,
    lineas: ev.totales.lineas,
    construirXml: (numero, fechaCertificacion) => generarXmlDte({
      uuid,
      serie: serieFel,
      numero,
      fechaEmision: input.fechaEmision,
      fechaCertificacion,
      moneda: ev.moneda!.codigo,
      emisor: { nit: normalizarNit(emisor.nit), nombre: emisor.nombre },
      receptor: { nit: ev.nitReceptor, nombre: ev.nombreReceptor },
      totales: ev.totales,
    }),
  });
  return getFactura(idFactura);
}

export async function listFacturas(query: { page?: string; limit?: string; search?: string }): Promise<PaginatedResponse<FacturaFel>> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const { data, total } = await repo.findAll({ page, limit, search: query.search?.trim() || undefined });
  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getFactura(id: number): Promise<FacturaFelDetalle> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de factura inválido');
  const factura = await repo.findById(id);
  if (!factura) throw new NotFoundError(`Factura ${id} no encontrada`);
  return factura;
}

export async function anularFactura(id: number, rawInput: unknown): Promise<FacturaFelDetalle> {
  const input = anularFacturaSchema.parse(rawInput);
  await getFactura(id);
  await repo.anular(id, generarUuidAutorizacion(), input);
  return getFactura(id);
}
