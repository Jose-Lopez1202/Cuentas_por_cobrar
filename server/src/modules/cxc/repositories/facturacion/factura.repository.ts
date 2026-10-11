import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type { AnularFacturaInput, FacturaFel, FacturaFelDetalle } from '@erp/contracts';
import { ConflictError, NotFoundError } from '../../../../shared/errors/AppError';
import { hasFinancialMovement } from '../../shared/financialRules';
import { registrarEvento } from '../documentos/documentoHistorial.repository';

interface FacturaRow {
  ID_FACTURA_FEL: number;
  ID_DOCUMENTO: number;
  UUID_AUTORIZACION: string;
  SERIE_FEL: string;
  NUMERO_FEL: number;
  TIPO_DTE: string;
  FECHA_EMISION: Date;
  FECHA_CERTIFICACION: Date;
  NIT_EMISOR: string;
  NOMBRE_EMISOR: string;
  NIT_RECEPTOR: string;
  NOMBRE_RECEPTOR: string;
  SUBTOTAL_GRAVADO: number;
  IVA: number;
  TOTAL: number;
  SALDO: number;
  ESTADO: FacturaFel['estado'];
  FECHA_ANULACION: Date | null;
  UUID_ANULACION: string | null;
  MOTIVO_ANULACION: string | null;
}

const SELECT_BASE = `
  SELECT f.ID_FACTURA_FEL, f.ID_DOCUMENTO, f.UUID_AUTORIZACION, f.SERIE_FEL, f.NUMERO_FEL, f.TIPO_DTE,
         f.FECHA_EMISION, f.FECHA_CERTIFICACION, f.NIT_EMISOR, f.NOMBRE_EMISOR, f.NIT_RECEPTOR, f.NOMBRE_RECEPTOR,
         f.SUBTOTAL_GRAVADO, f.IVA, f.TOTAL, d.SALDO, f.ESTADO, f.FECHA_ANULACION, f.UUID_ANULACION, f.MOTIVO_ANULACION
    FROM CXC_FACTURA_FEL f
    JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = f.ID_DOCUMENTO
`;

function mapRow(r: FacturaRow): FacturaFel {
  return {
    idFacturaFel: r.ID_FACTURA_FEL,
    idDocumento: r.ID_DOCUMENTO,
    uuidAutorizacion: r.UUID_AUTORIZACION,
    serieFel: r.SERIE_FEL,
    numeroFel: r.NUMERO_FEL,
    tipoDte: r.TIPO_DTE,
    fechaEmision: r.FECHA_EMISION?.toISOString() ?? '',
    fechaCertificacion: r.FECHA_CERTIFICACION?.toISOString() ?? '',
    nitEmisor: r.NIT_EMISOR,
    nombreEmisor: r.NOMBRE_EMISOR,
    nitReceptor: r.NIT_RECEPTOR,
    nombreReceptor: r.NOMBRE_RECEPTOR,
    subtotalGravado: r.SUBTOTAL_GRAVADO,
    iva: r.IVA,
    total: r.TOTAL,
    saldo: r.SALDO,
    estado: r.ESTADO,
    fechaAnulacion: r.FECHA_ANULACION?.toISOString() ?? null,
    uuidAnulacion: r.UUID_ANULACION,
    motivoAnulacion: r.MOTIVO_ANULACION,
  };
}

// --- Lecturas auxiliares para validar antes de certificar -------------------

export async function getEmisor(): Promise<{ idEmpresa: number; nombre: string; nit: string | null } | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ ID_EMPRESA: number; NOMBRE: string; NIT: string | null }>(
      `SELECT ID_EMPRESA, NOMBRE, NIT FROM CXC_EMPRESAS WHERE ESTADO = 'A' ORDER BY ID_EMPRESA FETCH FIRST 1 ROWS ONLY`,
    );
    const row = result.rows?.[0];
    return row ? { idEmpresa: row.ID_EMPRESA, nombre: row.NOMBRE, nit: row.NIT } : null;
  } finally {
    await conn.close();
  }
}

export async function getCliente(idCliente: number): Promise<{ nombre: string; nit: string | null } | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ NOMBRE: string; NIT: string | null }>(
      `SELECT NOMBRE, NIT FROM CLIENTE WHERE ID_CLIENTE = :idCliente`,
      { idCliente },
    );
    const row = result.rows?.[0];
    return row ? { nombre: row.NOMBRE, nit: row.NIT } : null;
  } finally {
    await conn.close();
  }
}

export async function getMoneda(idMoneda: number): Promise<{ codigo: string } | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ CODIGO: string }>(`SELECT CODIGO FROM MONEDA WHERE ID_MONEDA = :idMoneda`, { idMoneda });
    const row = result.rows?.[0];
    return row ? { codigo: row.CODIGO } : null;
  } finally {
    await conn.close();
  }
}

export async function getTipoFacturaId(): Promise<number | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ ID_TIPO_DOCUMENTO: number }>(
      `SELECT ID_TIPO_DOCUMENTO FROM CXC_TIPOS_DOCUMENTO WHERE CODIGO = 'FACT' AND ESTADO = 'A'`,
    );
    return result.rows?.[0]?.ID_TIPO_DOCUMENTO ?? null;
  } finally {
    await conn.close();
  }
}

export async function getDiasCredito(idCondicion: number): Promise<number | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ DIAS_CREDITO: number }>(
      `SELECT DIAS_CREDITO FROM CXC_CONDICIONES_CREDITO WHERE ID_CONDICION = :id AND ESTADO = 'A'`,
      { id: idCondicion },
    );
    return result.rows?.[0]?.DIAS_CREDITO ?? null;
  } finally {
    await conn.close();
  }
}

// --- Emisión -----------------------------------------------------------------

export interface EmitirParams {
  idEmpresa: number;
  idCliente: number;
  idTipoDocumento: number;
  idMoneda: number;
  idCondicionCredito: number | null;
  idEmpleado: number;
  serieFel: string;
  uuid: string;
  fechaEmision: string;
  fechaVencimiento: string;
  nitEmisor: string;
  nombreEmisor: string;
  nitReceptor: string;
  nombreReceptor: string;
  subtotalGravado: number;
  iva: number;
  total: number;
  lineas: Array<{ codigoProducto?: string; descripcion: string; cantidad: number; precioUnitario: number; total: number }>;
  /** Recibe el número FEL asignado y devuelve el XML a guardar. */
  construirXml: (numeroFel: number, fechaCertificacion: string) => string;
}

/**
 * Documento + líneas + certificado FEL en UNA transacción. La fila de la
 * empresa se bloquea para que dos emisiones simultáneas no tomen el mismo
 * número de la serie.
 */
export async function emitir(p: EmitirParams): Promise<number> {
  const conn = await getConnection();
  try {
    await conn.execute(`SELECT ID_EMPRESA FROM CXC_EMPRESAS WHERE ID_EMPRESA = :id FOR UPDATE`, { id: p.idEmpresa });
    const next = await conn.execute<{ SIGUIENTE: number }>(
      `SELECT NVL(MAX(NUMERO_FEL), 0) + 1 AS SIGUIENTE FROM CXC_FACTURA_FEL WHERE SERIE_FEL = :serie`,
      { serie: p.serieFel },
    );
    const numeroFel = next.rows![0].SIGUIENTE;
    const fechaCertificacion = new Date().toISOString();

    const doc = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_DOCUMENTOS
         (ID_CLIENTE, NIT_CLIENTE, ID_TIPO_DOCUMENTO, ID_MONEDA, ID_CONDICION_CREDITO, ESTADO,
          SERIE, NUMERO_DOCUMENTO, FECHA_DOCUMENTO, FECHA_VENCIMIENTO, TOTAL, SALDO)
       VALUES
         (:idCliente, :nit, :idTipo, :idMoneda, :idCondicion, 'PENDIENTE',
          :serie, :numero, TO_DATE(:fechaEmision, 'YYYY-MM-DD'), TO_DATE(:fechaVencimiento, 'YYYY-MM-DD'), :total, :total)
       RETURNING ID_DOCUMENTO INTO :id`,
      {
        idCliente: p.idCliente,
        nit: p.nitReceptor.slice(0, 20),
        idTipo: p.idTipoDocumento,
        idMoneda: p.idMoneda,
        idCondicion: p.idCondicionCredito,
        serie: p.serieFel,
        numero: String(numeroFel),
        fechaEmision: p.fechaEmision,
        fechaVencimiento: p.fechaVencimiento,
        total: p.total,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );
    const idDocumento = doc.outBinds!.id[0];

    for (const l of p.lineas) {
      await conn.execute(
        `INSERT INTO CXC_DOCUMENTO_DETALLE (ID_DOCUMENTO, CODIGO_PRODUCTO, DESCRIPCION, CANTIDAD, PRECIO_UNITARIO, TOTAL)
         VALUES (:idDocumento, :codigo, :descripcion, :cantidad, :precio, :total)`,
        { idDocumento, codigo: l.codigoProducto || null, descripcion: l.descripcion, cantidad: l.cantidad, precio: l.precioUnitario, total: l.total },
      );
    }

    const fel = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_FACTURA_FEL
         (ID_DOCUMENTO, ID_EMPRESA, UUID_AUTORIZACION, SERIE_FEL, NUMERO_FEL, FECHA_EMISION, FECHA_CERTIFICACION,
          NIT_EMISOR, NOMBRE_EMISOR, NIT_RECEPTOR, NOMBRE_RECEPTOR, SUBTOTAL_GRAVADO, IVA, TOTAL, ESTADO, XML_DTE, ID_EMPLEADO_EMISION)
       VALUES
         (:idDocumento, :idEmpresa, :uuid, :serie, :numero, TO_DATE(:fechaEmision, 'YYYY-MM-DD'), SYSDATE,
          :nitEmisor, :nombreEmisor, :nitReceptor, :nombreReceptor, :subtotal, :iva, :total, 'CERTIFICADA', :xml, :idEmpleado)
       RETURNING ID_FACTURA_FEL INTO :id`,
      {
        idDocumento,
        idEmpresa: p.idEmpresa,
        uuid: p.uuid,
        serie: p.serieFel,
        numero: numeroFel,
        fechaEmision: p.fechaEmision,
        nitEmisor: p.nitEmisor,
        nombreEmisor: p.nombreEmisor.slice(0, 150),
        nitReceptor: p.nitReceptor,
        nombreReceptor: p.nombreReceptor.slice(0, 150),
        subtotal: p.subtotalGravado,
        iva: p.iva,
        total: p.total,
        xml: { val: p.construirXml(numeroFel, fechaCertificacion), type: oracledb.CLOB },
        idEmpleado: p.idEmpleado,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );

    await conn.commit();
    return fel.outBinds!.id[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

// --- Consultas ---------------------------------------------------------------

export async function findAll(params: { page: number; limit: number; search?: string }): Promise<{ data: FacturaFel[]; total: number }> {
  const conn = await getConnection();
  try {
    const where = params.search
      ? `WHERE UPPER(f.NOMBRE_RECEPTOR) LIKE UPPER(:search) OR UPPER(f.NIT_RECEPTOR) LIKE UPPER(:search)
            OR UPPER(f.UUID_AUTORIZACION) LIKE UPPER(:search) OR UPPER(f.SERIE_FEL) LIKE UPPER(:search)
            OR TO_CHAR(f.NUMERO_FEL) LIKE :search OR UPPER(f.ESTADO) LIKE UPPER(:search)`
      : '';
    const searchBind = params.search ? { search: `%${params.search}%` } : {};
    const data = await conn.execute<FacturaRow>(
      `${SELECT_BASE} ${where} ORDER BY f.FECHA_EMISION DESC, f.ID_FACTURA_FEL DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBind, offset: (params.page - 1) * params.limit, limit: params.limit },
    );
    const count = await conn.execute<{ TOTAL: number }>(`SELECT COUNT(*) AS TOTAL FROM CXC_FACTURA_FEL f ${where}`, searchBind);
    return { data: (data.rows ?? []).map(mapRow), total: count.rows?.[0]?.TOTAL ?? 0 };
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<FacturaFelDetalle | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<FacturaRow & { XML_DTE: string | null }>(
      `SELECT f2.*, x.XML_DTE FROM (${SELECT_BASE} WHERE f.ID_FACTURA_FEL = :id) f2
         JOIN CXC_FACTURA_FEL x ON x.ID_FACTURA_FEL = f2.ID_FACTURA_FEL`,
      { id },
      { fetchInfo: { XML_DTE: { type: oracledb.STRING } } },
    );
    const row = result.rows?.[0];
    if (!row) return null;
    const lineas = await conn.execute<{ CODIGO_PRODUCTO: string | null; DESCRIPCION: string; CANTIDAD: number; PRECIO_UNITARIO: number; TOTAL: number }>(
      `SELECT CODIGO_PRODUCTO, DESCRIPCION, CANTIDAD, PRECIO_UNITARIO, TOTAL FROM CXC_DOCUMENTO_DETALLE WHERE ID_DOCUMENTO = :id ORDER BY ID_DETALLE`,
      { id: row.ID_DOCUMENTO },
    );
    return {
      ...mapRow(row),
      xmlDte: row.XML_DTE,
      lineas: (lineas.rows ?? []).map((l) => ({
        codigoProducto: l.CODIGO_PRODUCTO,
        descripcion: l.DESCRIPCION,
        cantidad: l.CANTIDAD,
        precioUnitario: l.PRECIO_UNITARIO,
        total: l.TOTAL,
      })),
    };
  } finally {
    await conn.close();
  }
}

// --- Anulación fiscal --------------------------------------------------------

export async function anular(id: number, uuidAnulacion: string, input: AnularFacturaInput): Promise<void> {
  const conn = await getConnection();
  try {
    const fel = await conn.execute<{ ID_DOCUMENTO: number; ESTADO: string }>(
      `SELECT ID_DOCUMENTO, ESTADO FROM CXC_FACTURA_FEL WHERE ID_FACTURA_FEL = :id FOR UPDATE`,
      { id },
    );
    const f = fel.rows?.[0];
    if (!f) throw new NotFoundError(`Factura ${id} no encontrada`);
    if (f.ESTADO === 'ANULADA') throw new ConflictError('La factura ya está anulada.');

    const docRes = await conn.execute<{ ESTADO: string; TOTAL: number; SALDO: number }>(
      `SELECT ESTADO, TOTAL, SALDO FROM CXC_DOCUMENTOS WHERE ID_DOCUMENTO = :id FOR UPDATE`,
      { id: f.ID_DOCUMENTO },
    );
    const d = docRes.rows![0];
    if (hasFinancialMovement(d.TOTAL, d.SALDO)) {
      throw new ConflictError(
        'La factura tiene pagos, notas de crédito o ajustes aplicados. Reversa primero esas aplicaciones y luego anula la factura.',
      );
    }

    await conn.execute(
      `UPDATE CXC_FACTURA_FEL
          SET ESTADO = 'ANULADA', FECHA_ANULACION = SYSDATE, UUID_ANULACION = :uuid,
              MOTIVO_ANULACION = :motivo, ID_EMPLEADO_ANULACION = :idEmpleado
        WHERE ID_FACTURA_FEL = :id`,
      { uuid: uuidAnulacion, motivo: input.motivoAnulacion, idEmpleado: input.idEmpleadoAnulacion, id },
    );
    await conn.execute(
      `UPDATE CXC_DOCUMENTOS
          SET SALDO = 0, ESTADO = 'ANULADO', ID_EMPLEADO_ANULACION = :idEmpleado, FECHA_ANULACION = SYSDATE, MOTIVO_ANULACION = :motivo
        WHERE ID_DOCUMENTO = :idDocumento`,
      { idEmpleado: input.idEmpleadoAnulacion, motivo: input.motivoAnulacion, idDocumento: f.ID_DOCUMENTO },
    );
    await registrarEvento(conn, {
      idDocumento: f.ID_DOCUMENTO,
      estadoAnterior: d.ESTADO,
      estadoNuevo: 'ANULADO',
      idEmpleado: input.idEmpleadoAnulacion,
      tipoEvento: 'ANULACION_DOCUMENTO',
      monto: d.SALDO,
      naturaleza: 'ABONO',
      descripcion: `Anulación de factura FEL: ${input.motivoAnulacion}`,
    });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}
