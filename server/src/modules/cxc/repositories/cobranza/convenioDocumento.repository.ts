import { getConnection } from '../../../../config/database';
import type { ConvenioDocumento } from '@erp/contracts';

interface Row {
  ID_CONVENIO_DOCUMENTO: number;
  ID_CONVENIO: number;
  ID_DOCUMENTO: number;
  SERIE: string | null;
  NUMERO_DOCUMENTO: string | null;
  MONTO_INCLUIDO: number;
  SALDO_ACTUAL: number;
}

const mapRow = (r: Row): ConvenioDocumento => ({
  idConvenioDocumento: r.ID_CONVENIO_DOCUMENTO,
  idConvenio: r.ID_CONVENIO,
  idDocumento: r.ID_DOCUMENTO,
  referenciaDocumento: [r.SERIE, r.NUMERO_DOCUMENTO].filter(Boolean).join('-') || `Documento #${r.ID_DOCUMENTO}`,
  montoIncluido: r.MONTO_INCLUIDO,
  saldoActualDocumento: r.SALDO_ACTUAL,
});

const SELECT_BASE = `
  SELECT cd.ID_CONVENIO_DOCUMENTO, cd.ID_CONVENIO, cd.ID_DOCUMENTO,
         d.SERIE, d.NUMERO_DOCUMENTO, cd.MONTO_INCLUIDO, d.SALDO AS SALDO_ACTUAL
    FROM CXC_CONVENIO_DOCUMENTOS cd
    JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = cd.ID_DOCUMENTO
`;

export async function findByConvenio(idConvenio: number): Promise<ConvenioDocumento[]> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<Row>(
      `${SELECT_BASE} WHERE cd.ID_CONVENIO = :idConvenio ORDER BY d.FECHA_VENCIMIENTO ASC`,
      { idConvenio },
    );
    return (result.rows ?? []).map(mapRow);
  } finally {
    await conn.close();
  }
}
