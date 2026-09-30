import {
  createRutaDetalleSchema,
  updateRutaDetalleSchema,
  type RutaDetalle,
} from '@erp/contracts';
import { NotFoundError } from '../../../../shared/errors/AppError';
import * as rutaDetalleRepository from '../../repositories/organizacion/rutaDetalle.repository';
import * as rutaRepository from '../../repositories/organizacion/ruta.repository';

export async function listDetalleByRuta(idRuta: number): Promise<RutaDetalle[]> {
  const ruta = await rutaRepository.findById(idRuta);
  if (!ruta) {
    throw new NotFoundError(`Ruta ${idRuta} no encontrada`);
  }
  return rutaDetalleRepository.findByRuta(idRuta);
}

export async function getDetalle(id: number): Promise<RutaDetalle> {
  const detalle = await rutaDetalleRepository.findById(id);
  if (!detalle) {
    throw new NotFoundError(`Parada de ruta ${id} no encontrada`);
  }
  return detalle;
}

export async function createDetalle(idRuta: number, rawInput: unknown): Promise<RutaDetalle> {
  const ruta = await rutaRepository.findById(idRuta);
  if (!ruta) {
    throw new NotFoundError(`Ruta ${idRuta} no encontrada`);
  }
  const input = createRutaDetalleSchema.parse(rawInput);
  const id = await rutaDetalleRepository.create(idRuta, input);
  return getDetalle(id);
}

export async function updateDetalle(id: number, rawInput: unknown): Promise<RutaDetalle> {
  const input = updateRutaDetalleSchema.parse(rawInput);
  await rutaDetalleRepository.update(id, input);
  return getDetalle(id);
}

export async function deleteDetalle(id: number): Promise<void> {
  await rutaDetalleRepository.remove(id);
}
