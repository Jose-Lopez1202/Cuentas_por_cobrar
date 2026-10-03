import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import { BadRequestError, NotFoundError, ConflictError } from '../../../../shared/errors/AppError';
import { isDocumentoBloqueadoParaAplicacion, roundMoney } from '../../shared/financialRules';
import type { AsignarDocumentoRuta, RegistrarBitacoraRuta, PerfilCobradorInput, RutaAsignacion, RutaBitacora, CobradorPerfil, RutaOperacion, RutaDocumentoPendiente, RutaPagoDisponible } from '@erp/contracts';
export async function lockRuta(conn: Awaited<ReturnType<typeof getConnection>>, idRuta: number) {
  const result = await conn.execute<{ESTADO: string}>('SELECT ESTADO FROM CXC_RUTAS WHERE ID_RUTA=:idRuta FOR UPDATE', {idRuta});
  if (!result.rows?.length) throw new NotFoundError('Ruta no encontrada');
  if (!['PLANIFICADA','EN_PROCESO'].includes(result.rows[0].ESTADO.trim())) throw new ConflictError('La ruta no está abierta');
}
const confirmado = `(SELECT NVL(SUM(ap.MONTO_APLICADO),0) FROM CXC_APLICACION_PAGOS ap WHERE ap.ID_RUTA_DETALLE=a.ID_RUTA_DETALLE AND ap.ESTADO='CONFIRMADA')`;
const reservado = `(SELECT NVL(SUM(GREATEST(a.MONTO_ASIGNADO-${confirmado},0)),0) FROM CXC_RUTA_DETALLE a JOIN CXC_RUTAS r ON r.ID_RUTA=a.ID_RUTA WHERE a.ID_DOCUMENTO=d.ID_DOCUMENTO AND r.ESTADO IN ('PLANIFICADA','EN_PROCESO'))`;
export async function resumen(idRuta: number): Promise<RutaOperacion> {
  const conn = await getConnection();
  try {
    const ruta = await conn.execute('SELECT ID_RUTA FROM CXC_RUTAS WHERE ID_RUTA=:idRuta', {idRuta});
    if (!ruta.rows?.length) throw new NotFoundError('Ruta no encontrada');
    const a = await conn.execute<RutaAsignacion>(`SELECT a.ID_RUTA_DETALLE ID_ASIGNACION,a.ID_DOCUMENTO,a.ID_CLIENTE,
      a.ID_COBRADOR ID_EMPLEADO,a.MONTO_ASIGNADO,${confirmado} MONTO_REGISTRADO,a.DIRECCION,a.LATITUD,a.LONGITUD,a.ORDEN_VISITA,a.ESTADO_VISITA,
      d.SALDO SALDO_DOCUMENTO,TRIM(d.SERIE || ' ' || d.NUMERO_DOCUMENTO) DOCUMENTO,d.ID_MONEDA,m.CODIGO MONEDA,c.NOMBRE CLIENTE,
      TRIM(e.NOMBRE || ' ' || e.APELLIDO) COBRADOR
      FROM CXC_RUTA_DETALLE a JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO=a.ID_DOCUMENTO
      JOIN CLIENTE c ON c.ID_CLIENTE=d.ID_CLIENTE JOIN EMPLEADO e ON e.ID_EMPLEADO=a.ID_COBRADOR
      JOIN MONEDA m ON m.ID_MONEDA=d.ID_MONEDA WHERE a.ID_RUTA=:idRuta ORDER BY a.ORDEN_VISITA NULLS LAST,a.ID_RUTA_DETALLE`, {idRuta});
    const b = await conn.execute<RutaBitacora>(`SELECT * FROM (
      SELECT g.ID_GESTION ID_BITACORA,g.ID_RUTA_DETALLE ID_ASIGNACION,g.TIPO_GESTION TIPO,CAST(NULL AS NUMBER) MONTO,
      g.RESULTADO || ': ' || g.OBSERVACION OBSERVACIONES,CAST(NULL AS VARCHAR2(80)) REFERENCIA,
      TO_CHAR(g.FECHA_GESTION,'YYYY-MM-DD HH24:MI:SS') FECHA,TRIM(e.NOMBRE || ' ' || e.APELLIDO) COBRADOR,
      TRIM(d.SERIE || ' ' || d.NUMERO_DOCUMENTO) DOCUMENTO,CAST(NULL AS VARCHAR2(20)) ESTADO,m.CODIGO MONEDA,
      TRIM(e.NOMBRE || ' ' || e.APELLIDO) REGISTRADO_POR
      FROM CXC_GESTIONES_COBRO g JOIN CXC_RUTA_DETALLE a ON a.ID_RUTA_DETALLE=g.ID_RUTA_DETALLE
      JOIN EMPLEADO e ON e.ID_EMPLEADO=g.ID_EMPLEADO JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO=a.ID_DOCUMENTO
      JOIN MONEDA m ON m.ID_MONEDA=d.ID_MONEDA WHERE a.ID_RUTA=:idRuta
      UNION ALL
      SELECT ap.ID_APLICACION,ap.ID_RUTA_DETALLE,'COBRO',ap.MONTO_APLICADO,
      'Pago aplicado. ' || CASE WHEN ap.ESTADO='REVERSADA' THEN 'Reversado: ' || ap.MOTIVO_REVERSA ELSE 'Confirmado' END,
      p.NUMERO_REFERENCIA,TO_CHAR(ap.FECHA_APLICACION,'YYYY-MM-DD HH24:MI:SS'),TRIM(e.NOMBRE || ' ' || e.APELLIDO),
      TRIM(d.SERIE || ' ' || d.NUMERO_DOCUMENTO),ap.ESTADO,m.CODIGO,TRIM(er.NOMBRE || ' ' || er.APELLIDO)
      FROM CXC_APLICACION_PAGOS ap JOIN CXC_RUTA_DETALLE a ON a.ID_RUTA_DETALLE=ap.ID_RUTA_DETALLE
      JOIN CXC_PAGOS p ON p.ID_PAGO=ap.ID_PAGO JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO=ap.ID_DOCUMENTO
      JOIN EMPLEADO e ON e.ID_EMPLEADO=a.ID_COBRADOR LEFT JOIN EMPLEADO er ON er.ID_EMPLEADO=ap.ID_EMPLEADO
      JOIN MONEDA m ON m.ID_MONEDA=d.ID_MONEDA WHERE a.ID_RUTA=:idRuta
    ) ORDER BY FECHA DESC,ID_BITACORA DESC`, {idRuta});
    const p = await conn.execute<CobradorPerfil>(`SELECT e.ID_EMPLEADO,TRIM(e.NOMBRE || ' ' || e.APELLIDO) NOMBRE,e.TELEFONO,e.PUESTO,e.EMAIL,e.FOTO_URL
      FROM EMPLEADO e WHERE e.ID_EMPLEADO IN
      (SELECT ID_COBRADOR FROM CXC_RUTA_DETALLE WHERE ID_RUTA=:idRuta UNION SELECT ID_EMPLEADO FROM CXC_RUTAS WHERE ID_RUTA=:idRuta)`, {idRuta});
    return {asignaciones:a.rows ?? [],bitacora:b.rows ?? [],cobradores:p.rows ?? []};
  } finally { await conn.close(); }
}
export async function pendientes() {
  const conn = await getConnection();
  try {return (await conn.execute<RutaDocumentoPendiente>(`SELECT d.ID_DOCUMENTO,TRIM(d.SERIE || ' ' || d.NUMERO_DOCUMENTO) DOCUMENTO,
    d.SALDO,GREATEST(d.SALDO-${reservado},0) DISPONIBLE,d.ID_MONEDA,m.CODIGO MONEDA,c.NOMBRE CLIENTE
    FROM CXC_DOCUMENTOS d JOIN CLIENTE c ON c.ID_CLIENTE=d.ID_CLIENTE JOIN MONEDA m ON m.ID_MONEDA=d.ID_MONEDA
    WHERE d.SALDO>0 AND TRIM(d.ESTADO) NOT IN ('ANULADO','ANULADA','PAGADO','PAGADA') ORDER BY d.FECHA_VENCIMIENTO`)).rows ?? [];
  } finally {await conn.close();}
}
export async function pagosDisponibles() {
  const conn=await getConnection();
  try {return (await conn.execute<RutaPagoDisponible>(`SELECT * FROM (
    SELECT p.ID_PAGO,p.ID_CLIENTE,p.ID_MONEDA,NVL(p.NUMERO_REFERENCIA,'Pago #' || p.ID_PAGO) REFERENCIA,
    p.MONTO-NVL((SELECT SUM(ap.MONTO_APLICADO) FROM CXC_APLICACION_PAGOS ap WHERE ap.ID_PAGO=p.ID_PAGO AND ap.ESTADO='CONFIRMADA'),0) DISPONIBLE,
    c.NOMBRE CLIENTE,m.CODIGO MONEDA FROM CXC_PAGOS p JOIN CLIENTE c ON c.ID_CLIENTE=p.ID_CLIENTE JOIN MONEDA m ON m.ID_MONEDA=p.ID_MONEDA
    WHERE TRIM(p.ESTADO) NOT IN ('ANULADO','REVERSADO') AND NOT EXISTS
    (SELECT 1 FROM CXC_ANTICIPOS ant WHERE ant.ID_PAGO=p.ID_PAGO AND ant.ESTADO <> 'CANCELADO')
  ) WHERE DISPONIBLE>0 ORDER BY ID_PAGO DESC`)).rows ?? [];} finally {await conn.close();}
}
export async function asignar(idRuta: number, input: AsignarDocumentoRuta) {
  const conn = await getConnection();
  try {
    await lockRuta(conn,idRuta);
    const doc = await conn.execute<{ID_CLIENTE:number;SALDO:number;ESTADO:string}>('SELECT ID_CLIENTE,SALDO,ESTADO FROM CXC_DOCUMENTOS WHERE ID_DOCUMENTO=:id FOR UPDATE',{id:input.idDocumento});
    if (!doc.rows?.length) throw new NotFoundError('Documento no encontrado');
    const d=doc.rows[0];
    if (isDocumentoBloqueadoParaAplicacion(d.ESTADO) || d.SALDO<=0) throw new BadRequestError('El documento no está pendiente de cobro');
    const exists=await conn.execute('SELECT ID_RUTA_DETALLE FROM CXC_RUTA_DETALLE WHERE ID_RUTA=:idRuta AND ID_DOCUMENTO=:idDocumento',{idRuta,idDocumento:input.idDocumento});
    if(exists.rows?.length) throw new ConflictError('Este documento ya está asignado a la ruta');
    const reservadoResult=await conn.execute<{RESERVADO:number}>(`SELECT ${reservado} RESERVADO FROM CXC_DOCUMENTOS d WHERE d.ID_DOCUMENTO=:id`,{id:input.idDocumento});
    if(roundMoney(input.montoAsignado+(reservadoResult.rows?.[0]?.RESERVADO ?? 0))>roundMoney(d.SALDO)) throw new ConflictError('El monto supera el saldo disponible para asignar');
    const empleado=await conn.execute('SELECT ID_EMPLEADO FROM EMPLEADO WHERE ID_EMPLEADO=:id',{id:input.idEmpleado});
    if(!empleado.rows?.length) throw new BadRequestError('Cobrador no encontrado');
    const result=await conn.execute<{id:number[]}>(`INSERT INTO CXC_RUTA_DETALLE
      (ID_RUTA,ID_CLIENTE,ID_DOCUMENTO,ID_COBRADOR,MONTO_ASIGNADO,MONTO_PENDIENTE,DIRECCION,LATITUD,LONGITUD,ORDEN_VISITA,ESTADO_VISITA)
      VALUES(:idRuta,:idCliente,:idDocumento,:idEmpleado,:montoAsignado,:saldo,:direccion,:latitud,:longitud,:ordenVisita,'PENDIENTE')
      RETURNING ID_RUTA_DETALLE INTO :id`,{idRuta,idCliente:d.ID_CLIENTE,saldo:d.SALDO,...input,id:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}});
    await conn.execute(`INSERT INTO CXC_GESTIONES_COBRO(ID_CLIENTE,ID_DOCUMENTO,ID_EMPLEADO,FECHA_GESTION,TIPO_GESTION,RESULTADO,OBSERVACION,ID_RUTA_DETALLE)
      VALUES(:idCliente,:idDocumento,:idEmpleado,SYSDATE,'OTRO','ASIGNACION',:texto,:idDetalle)`,
      {idCliente:d.ID_CLIENTE,idDocumento:input.idDocumento,idEmpleado:input.idEmpleado,texto:`Documento asignado a ruta; monto ${input.montoAsignado}`,idDetalle:result.outBinds!.id[0]});
    await conn.commit();
  } catch(e) {await conn.rollback();throw e;} finally {await conn.close();}
}
export async function registrar(idRuta:number,input:RegistrarBitacoraRuta) {
  const conn=await getConnection();
  try {
    await lockRuta(conn,idRuta);
    const a=await conn.execute<{ID_CLIENTE:number;ID_DOCUMENTO:number;ID_COBRADOR:number}>(`SELECT ID_CLIENTE,ID_DOCUMENTO,ID_COBRADOR FROM CXC_RUTA_DETALLE
      WHERE ID_RUTA_DETALLE=:id AND ID_RUTA=:idRuta AND ID_DOCUMENTO IS NOT NULL FOR UPDATE`,{id:input.idAsignacion,idRuta});
    if(!a.rows?.length) throw new NotFoundError('La asignación no pertenece a esta ruta');
    const row=a.rows[0];
    await conn.execute(`INSERT INTO CXC_GESTIONES_COBRO(ID_CLIENTE,ID_DOCUMENTO,ID_EMPLEADO,FECHA_GESTION,TIPO_GESTION,RESULTADO,OBSERVACION,ID_RUTA_DETALLE)
      VALUES(:cliente,:documento,:empleado,SYSDATE,:tipo,:resultado,:observaciones,:detalle)`,
      {cliente:row.ID_CLIENTE,documento:row.ID_DOCUMENTO,empleado:row.ID_COBRADOR,tipo:input.tipo==='VISITA'?'VISITA':'OTRO',resultado:input.tipo,observaciones:input.observaciones,detalle:input.idAsignacion});
    if(input.tipo!=='INCIDENCIA') await conn.execute(`UPDATE CXC_RUTA_DETALLE SET ESTADO_VISITA=:estado,HORA_VISITA=TO_CHAR(SYSDATE,'HH24:MI') WHERE ID_RUTA_DETALLE=:id`,
      {estado:input.tipo==='VISITA'?'VISITADO':'REPROGRAMADO',id:input.idAsignacion});
    await conn.commit();
  } catch(e) {await conn.rollback();throw e;} finally {await conn.close();}
}
export async function perfil(idEmpleado:number,input:PerfilCobradorInput) {
  const conn=await getConnection();
  try {const result=await conn.execute('UPDATE EMPLEADO SET TELEFONO=:telefono,FOTO_URL=:fotoUrl WHERE ID_EMPLEADO=:idEmpleado',{idEmpleado,...input});
    if(!result.rowsAffected) throw new NotFoundError('Empleado no encontrado');await conn.commit();
  } catch(e){await conn.rollback();throw e;} finally {await conn.close();}
}
export async function documentoAsignado(idRuta:number,idDetalle:number) {
  const conn=await getConnection();try {
    const res=await conn.execute<{ID_DOCUMENTO:number}>('SELECT ID_DOCUMENTO FROM CXC_RUTA_DETALLE WHERE ID_RUTA=:idRuta AND ID_RUTA_DETALLE=:idDetalle AND ID_DOCUMENTO IS NOT NULL',{idRuta,idDetalle});
    if(!res.rows?.length) throw new NotFoundError('Asignación no encontrada en esta ruta');return res.rows[0].ID_DOCUMENTO;
  } finally {await conn.close();}
}
