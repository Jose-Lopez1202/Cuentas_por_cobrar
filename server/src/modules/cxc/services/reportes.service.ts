import * as reportesRepository from '../repositories/reportes.repository';
import { BadRequestError, NotFoundError } from '../../../shared/errors/AppError';
import type { AntiguedadSaldosReporte, EstadoCuenta } from '@erp/contracts';

export async function getAntiguedadSaldos(): Promise<AntiguedadSaldosReporte> {
  return reportesRepository.getAntiguedadSaldos();
}

export async function getEstadoCuenta(idCliente: number): Promise<EstadoCuenta> {
  if (!Number.isInteger(idCliente) || idCliente <= 0) throw new BadRequestError('ID de cliente inválido');
  const estadoCuenta = await reportesRepository.getEstadoCuenta(idCliente);
  if (!estadoCuenta) throw new NotFoundError(`Cliente ${idCliente} no encontrado`);
  return estadoCuenta;
}
