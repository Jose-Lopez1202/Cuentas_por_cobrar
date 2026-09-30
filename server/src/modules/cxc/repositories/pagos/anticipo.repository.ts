import oracledb from 'oracledb'; import {getConnection} from '../../../../config/database'; import type{Anticipo,CreateAnticipoInput,UpdateAnticipoInput,AnularAnticipoInput}from'@erp/contracts';
import { ConflictError, NotFoundError } from '../../../../shared/errors/AppError';
interface Row{ID_ANTICIPO:number;ID_CLIENTE:number;NOMBRE_CLIENTE:string|null;ID_PAGO:number|null;REFERENCIA_PAGO:string|null;MONTO_ORIGINAL:number;MONTO_DISPONIBLE:number;FECHA:Date;ESTADO:string;ID_EMPLEADO_ANULACION:number|null;NOMBRE_EMPLEADO_ANULACION:string|null;FECHA_ANULACION:Date|null;MOTIVO_ANULACION:string|null} const map=(r:Row):Anticipo=>({idAnticipo:r.ID_ANTICIPO,idCliente:r.ID_CLIENTE,nombreCliente:r.NOMBRE_CLIENTE,idPago:r.ID_PAGO,referenciaPago:r.REFERENCIA_PAGO,montoOriginal:r.MONTO_ORIGINAL,montoDisponible:r.MONTO_DISPONIBLE,fecha:r.FECHA?.toISOString()??'',estado:r.ESTADO as Anticipo['estado'],idEmpleadoAnulacion:r.ID_EMPLEADO_ANULACION,nombreEmpleadoAnulacion:r.NOMBRE_EMPLEADO_ANULACION,fechaAnulacion:r.FECHA_ANULACION?.toISOString()??null,motivoAnulacion:r.MOTIVO_ANULACION});
const SELECT_BASE=`SELECT a.ID_ANTICIPO,a.ID_CLIENTE,c.NOMBRE AS NOMBRE_CLIENTE,a.ID_PAGO,p.NUMERO_REFERENCIA AS REFERENCIA_PAGO,a.MONTO_ORIGINAL,a.MONTO_DISPONIBLE,a.FECHA,a.ESTADO,
  a.ID_EMPLEADO_ANULACION,
  CASE WHEN ea.ID_EMPLEADO IS NULL THEN NULL ELSE TRIM(ea.NOMBRE || ' ' || NVL(ea.APELLIDO,'')) END AS NOMBRE_EMPLEADO_ANULACION,
  a.FECHA_ANULACION, a.MOTIVO_ANULACION
  FROM CXC_ANTICIPOS a JOIN CLIENTE c ON c.ID_CLIENTE=a.ID_CLIENTE LEFT JOIN CXC_PAGOS p ON p.ID_PAGO=a.ID_PAGO LEFT JOIN EMPLEADO ea ON ea.ID_EMPLEADO=a.ID_EMPLEADO_ANULACION`;
export async function findAll({page,limit,search}:{page:number;limit:number;search?:string}){const c=await getConnection();try{const w=search?`WHERE UPPER(c.NOMBRE) LIKE UPPER(:search) OR UPPER(a.ESTADO) LIKE UPPER(:search) OR UPPER(p.NUMERO_REFERENCIA) LIKE UPPER(:search) OR TO_CHAR(a.ID_ANTICIPO) LIKE :search`:'';const sb=search?{search:`%${search}%`}:{ };const d=await c.execute<Row>(`${SELECT_BASE} ${w} ORDER BY a.FECHA DESC,a.ID_ANTICIPO DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,{...sb,offset:(page-1)*limit,limit});const n=await c.execute<{TOTAL:number}>(`SELECT COUNT(*) TOTAL FROM CXC_ANTICIPOS a JOIN CLIENTE c ON c.ID_CLIENTE=a.ID_CLIENTE LEFT JOIN CXC_PAGOS p ON p.ID_PAGO=a.ID_PAGO ${w}`,sb);return{data:(d.rows??[]).map(map),total:n.rows?.[0]?.TOTAL??0};}finally{await c.close();}}
export async function findById(id:number){const c=await getConnection();try{const r=await c.execute<Row>(`${SELECT_BASE} WHERE a.ID_ANTICIPO=:id`,{id});return r.rows?.[0]?map(r.rows[0]):null;}finally{await c.close();}}
export async function create(i:CreateAnticipoInput){const c=await getConnection();try{const r=await c.execute<{id:number[]}>(`INSERT INTO CXC_ANTICIPOS(ID_CLIENTE,ID_PAGO,MONTO_ORIGINAL,MONTO_DISPONIBLE,FECHA,ESTADO) VALUES(:idCliente,:idPago,:montoOriginal,:montoDisponible,TO_DATE(:fecha,'YYYY-MM-DD'),'DISPONIBLE') RETURNING ID_ANTICIPO INTO :id`,{idCliente:i.idCliente,idPago:i.idPago??null,montoOriginal:i.montoOriginal,montoDisponible:i.montoDisponible,fecha:i.fecha,id:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}});await c.commit();return r.outBinds!.id[0];}catch(e){await c.rollback();throw e;}finally{await c.close();}}
export async function update(id:number,i:UpdateAnticipoInput){const m:any={id};const f:string[]=[];for(const[k,col]of[['idCliente','ID_CLIENTE'],['idPago','ID_PAGO'],['montoOriginal','MONTO_ORIGINAL'],['montoDisponible','MONTO_DISPONIBLE']] as const){if(i[k]!==undefined){f.push(`${col}=:${k}`);m[k]=i[k];}}if(i.fecha!==undefined){f.push(`FECHA=TO_DATE(:fecha,'YYYY-MM-DD')`);m.fecha=i.fecha;}if(!f.length)return;const c=await getConnection();try{await c.execute(`UPDATE CXC_ANTICIPOS SET ${f.join(',')} WHERE ID_ANTICIPO=:id`,m);await c.commit();}catch(e){await c.rollback();throw e;}finally{await c.close();}}
export async function remove(id:number){const c=await getConnection();try{await c.execute(`DELETE FROM CXC_ANTICIPOS WHERE ID_ANTICIPO=:id`,{id});await c.commit();}catch(e){await c.rollback();throw e;}finally{await c.close();}}

/**
 * Anulación formal: bloquea la fila, rechaza si ya está CANCELADO o si tiene
 * aplicaciones CONFIRMADA vigentes (esas deben reversarse primero — anular
 * no es un atajo para deshacer aplicaciones), y si procede deja
 * MONTO_DISPONIBLE en 0 y ESTADO='CANCELADO' con trazabilidad. Mismo
 * criterio que documento/pago/nota de crédito: nunca DELETE físico de algo
 * con historia, siempre anulación con empleado/fecha/motivo.
 */
export async function anular(id: number, input: AnularAnticipoInput): Promise<void> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ ESTADO: string }>(
      `SELECT ESTADO FROM CXC_ANTICIPOS WHERE ID_ANTICIPO = :id FOR UPDATE`,
      { id },
    );
    const row = result.rows?.[0];
    if (!row) throw new NotFoundError(`Anticipo ${id} no encontrado`);
    if (String(row.ESTADO ?? '').trim().toUpperCase() === 'CANCELADO') {
      throw new ConflictError('Este anticipo ya está anulado.');
    }

    const aplicadoResult = await conn.execute<{ TOTAL: number }>(
      `SELECT NVL(SUM(MONTO_APLICADO), 0) TOTAL FROM CXC_APLICACION_ANTICIPO WHERE ID_ANTICIPO = :id AND ESTADO = 'CONFIRMADA'`,
      { id },
    );
    if (Number(aplicadoResult.rows?.[0]?.TOTAL ?? 0) > 0.005) {
      throw new ConflictError('Este anticipo tiene aplicaciones vigentes; debe reversarlas antes de poder anularlo.');
    }

    await conn.execute(
      `UPDATE CXC_ANTICIPOS
          SET MONTO_DISPONIBLE = 0,
              ESTADO = 'CANCELADO',
              ID_EMPLEADO_ANULACION = :idEmpleadoAnulacion,
              FECHA_ANULACION = NVL(TO_DATE(:fechaAnulacion, 'YYYY-MM-DD'), SYSDATE),
              MOTIVO_ANULACION = :motivoAnulacion
        WHERE ID_ANTICIPO = :id`,
      {
        idEmpleadoAnulacion: input.idEmpleadoAnulacion,
        fechaAnulacion: input.fechaAnulacion ?? null,
        motivoAnulacion: input.motivoAnulacion,
        id,
      },
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}
