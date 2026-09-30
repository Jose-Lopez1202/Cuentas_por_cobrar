import {
  createDocumentoHistorialSchema,
  updateDocumentoHistorialSchema,
  type DocumentoHistorial,
} from '@erp/contracts';
import * as documentoHistorialRepository from '../../repositories/documentos/documentoHistorial.repository';
import { NotFoundError, getDocumento } from './documento.service';
import { ConflictError } from '../../../../shared/errors/AppError';

export async function listHistorial(idDocumento: number): Promise<DocumentoHistorial[]> {
  await getDocumento(idDocumento);
  return documentoHistorialRepository.findByDocumento(idDocumento);
}

export async function getHistorial(id: number): Promise<DocumentoHistorial> {
  const historial = await documentoHistorialRepository.findById(id);
  if (!historial) throw new NotFoundError(`Historial de documento ${id} no encontrado`);
  return historial;
}

export async function createHistorial(idDocumento: number, rawInput: unknown): Promise<DocumentoHistorial> {
  await getDocumento(idDocumento);
  const input = createDocumentoHistorialSchema.parse({ ...(rawInput as object), idDocumento });
  const id = await documentoHistorialRepository.create(input);
  return getHistorial(id);
}

export async function updateHistorial(id: number, rawInput: unknown): Promise<DocumentoHistorial> {
  const current = await getHistorial(id);
  if (current.tipoEvento) {
    throw new ConflictError('Este registro fue generado automáticamente por el sistema; el historial automático es append-only y no se edita.');
  }
  const input = updateDocumentoHistorialSchema.parse(rawInput);
  await documentoHistorialRepository.update(id, input);
  return getHistorial(id);
}

export async function deleteHistorial(id: number): Promise<void> {
  const current = await getHistorial(id);
  if (current.tipoEvento) {
    throw new ConflictError('Este registro fue generado automáticamente por el sistema; el historial automático es append-only y no se elimina.');
  }
  await documentoHistorialRepository.remove(id);
}
