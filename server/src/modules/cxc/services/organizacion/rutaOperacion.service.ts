import { z } from 'zod';
import { asignarDocumentoRutaSchema, registrarBitacoraRutaSchema, perfilCobradorSchema, cobrarRutaSchema } from '@erp/contracts';
import * as repo from '../../repositories/organizacion/rutaOperacion.repository';
import { createAplicacionPago } from '../pagos/aplicacionPago.service';
const id = (value: unknown) => z.coerce.number().int().positive().parse(value);
export const resumen = (ruta: unknown) => repo.resumen(id(ruta));
export const pendientes = () => repo.pendientes();
export const pagosDisponibles = () => repo.pagosDisponibles();
export const asignar = (ruta: unknown, body: unknown) => repo.asignar(id(ruta), asignarDocumentoRutaSchema.parse(body));
export const registrar = (ruta: unknown, body: unknown) => repo.registrar(id(ruta), registrarBitacoraRutaSchema.parse(body));
export const perfil = (empleado: unknown, body: unknown) => repo.perfil(id(empleado), perfilCobradorSchema.parse(body));
export async function cobrar(ruta: unknown, body: unknown) {
  const input=cobrarRutaSchema.parse(body);
  const idDocumento=await repo.documentoAsignado(id(ruta),input.idAsignacion);
  return createAplicacionPago({idDocumento,idPago:input.idPago,idEmpleado:input.idEmpleado,
    montoAplicado:input.monto,fechaAplicacion:input.fecha,idRutaDetalle:input.idAsignacion,claveRuta:input.claveOperacion});
}
