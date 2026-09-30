import oracledb, { Connection } from 'oracledb'; import{getConnection}from'../../../../config/database'; import type{Recibo,CreateReciboInput,UpdateReciboInput}from'@erp/contracts';
interface Row{ID_RECIBO:number;ID_CLIENTE:number;NOMBRE_CLIENTE:string|null;ID_PAGO:number;REFERENCIA_PAGO:string|null;NUMERO_RECIBO:string|null;FECHA:Date;MONTO:number;ESTADO:string} const map=(r:Row):Recibo=>({idRecibo:r.ID_RECIBO,idCliente:r.ID_CLIENTE,nombreCliente:r.NOMBRE_CLIENTE,idPago:r.ID_PAGO,referenciaPago:r.REFERENCIA_PAGO,numeroRecibo:r.NUMERO_RECIBO,fecha:r.FECHA?.toISOString()??'',monto:r.MONTO,estado:r.ESTADO as Recibo['estado']});
const SELECT_BASE=`SELECT r.ID_RECIBO,r.ID_CLIENTE,c.NOMBRE AS NOMBRE_CLIENTE,r.ID_PAGO,p.NUMERO_REFERENCIA AS REFERENCIA_PAGO,r.NUMERO_RECIBO,r.FECHA,r.MONTO,r.ESTADO FROM CXC_RECIBOS r JOIN CLIENTE c ON c.ID_CLIENTE=r.ID_CLIENTE JOIN CXC_PAGOS p ON p.ID_PAGO=r.ID_PAGO`;
export async function findAll({page,limit,search}:{page:number;limit:number;search?:string}){const c=await getConnection();try{const w=search?`WHERE UPPER(c.NOMBRE) LIKE UPPER(:search) OR UPPER(r.NUMERO_RECIBO) LIKE UPPER(:search) OR UPPER(r.ESTADO) LIKE UPPER(:search) OR UPPER(p.NUMERO_REFERENCIA) LIKE UPPER(:search) OR TO_CHAR(r.ID_RECIBO) LIKE :search`:'';const sb=search?{search:`%${search}%`}:{ };const d=await c.execute<Row>(`${SELECT_BASE} ${w} ORDER BY r.FECHA DESC,r.ID_RECIBO DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,{...sb,offset:(page-1)*limit,limit});const n=await c.execute<{TOTAL:number}>(`SELECT COUNT(*) TOTAL FROM CXC_RECIBOS r JOIN CLIENTE c ON c.ID_CLIENTE=r.ID_CLIENTE JOIN CXC_PAGOS p ON p.ID_PAGO=r.ID_PAGO ${w}`,sb);return{data:(d.rows??[]).map(map),total:n.rows?.[0]?.TOTAL??0};}finally{await c.close();}}
export async function findById(id:number){const c=await getConnection();try{const r=await c.execute<Row>(`${SELECT_BASE} WHERE r.ID_RECIBO=:id`,{id});return r.rows?.[0]?map(r.rows[0]):null;}finally{await c.close();}}
export async function create(i:CreateReciboInput){const c=await getConnection();try{const r=await c.execute<{id:number[]}>(`INSERT INTO CXC_RECIBOS(ID_CLIENTE,ID_PAGO,NUMERO_RECIBO,FECHA,MONTO,ESTADO) VALUES(:idCliente,:idPago,:numeroRecibo,TO_DATE(:fecha,'YYYY-MM-DD'),:monto,:estado) RETURNING ID_RECIBO INTO :id`,{...i,numeroRecibo:i.numeroRecibo??null,id:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}});await c.commit();return r.outBinds!.id[0];}catch(e){await c.rollback();throw e;}finally{await c.close();}}
export async function update(id:number,i:UpdateReciboInput){const b:any={id};const f:string[]=[];for(const[k,col]of[['idCliente','ID_CLIENTE'],['idPago','ID_PAGO'],['numeroRecibo','NUMERO_RECIBO'],['monto','MONTO'],['estado','ESTADO']] as const){if(i[k]!==undefined){f.push(`${col}=:${k}`);b[k]=i[k];}}if(i.fecha!==undefined){f.push(`FECHA=TO_DATE(:fecha,'YYYY-MM-DD')`);b.fecha=i.fecha;}if(!f.length)return;const c=await getConnection();try{await c.execute(`UPDATE CXC_RECIBOS SET ${f.join(',')} WHERE ID_RECIBO=:id`,b);await c.commit();}catch(e){await c.rollback();throw e;}finally{await c.close();}}
export async function remove(id:number){const c=await getConnection();try{await c.execute(`DELETE FROM CXC_RECIBOS WHERE ID_RECIBO=:id`,{id});await c.commit();}catch(e){await c.rollback();throw e;}finally{await c.close();}}

/**
 * Genera un recibo automáticamente dentro de la transacción de quien aplica
 * un pago (aplicacionPago.repository.create()): no abre conexión ni hace
 * commit propio. El folio (NUMERO_RECIBO) se deriva del propio ID_RECIBO
 * generado por la IDENTITY, formateado como REC-<año>-<consecutivo 6 dígitos>,
 * ya que no existe todavía numeración FEL/SAT real para este ERP.
 */
export async function crearReciboAutomatico(
  conn: Connection,
  input: { idCliente: number; idPago: number; fecha: string; monto: number },
): Promise<number> {
  const insert = await conn.execute<{ id: number[] }>(
    `INSERT INTO CXC_RECIBOS (ID_CLIENTE,ID_PAGO,FECHA,MONTO,ESTADO)
     VALUES (:idCliente,:idPago,TO_DATE(:fecha,'YYYY-MM-DD'),:monto,'EMITIDO')
     RETURNING ID_RECIBO INTO :id`,
    {
      idCliente: input.idCliente,
      idPago: input.idPago,
      fecha: input.fecha,
      monto: input.monto,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
  );
  const idRecibo = insert.outBinds!.id[0];
  await conn.execute(
    `UPDATE CXC_RECIBOS
        SET NUMERO_RECIBO = 'REC-' || TO_CHAR(SYSDATE, 'YYYY') || '-' || LPAD(TO_CHAR(:idRecibo), 6, '0')
      WHERE ID_RECIBO = :idRecibo`,
    { idRecibo },
  );
  return idRecibo;
}
