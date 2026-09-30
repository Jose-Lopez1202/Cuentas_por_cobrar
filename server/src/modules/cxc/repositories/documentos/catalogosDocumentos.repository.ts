import { getConnection } from '../../../../config/database';
import type { DocumentoCatalogoOption } from '@erp/contracts';

/**
 * Catálogos de solo lectura usados exclusivamente por los formularios
 * del área Documentos. Mantenerlos dentro del módulo evita tocar el
 * catalogos.repository.ts compartido por otras ramas.
 */

export async function listClientes(search?: string): Promise<DocumentoCatalogoOption[]> {
  const conn = await getConnection();
  try {
    const whereClause = search ? `WHERE UPPER(NOMBRE) LIKE UPPER(:search)` : '';
    const result = await conn.execute<{ ID_CLIENTE: number; NOMBRE: string; NIT: string | null }>(
      `SELECT ID_CLIENTE, NOMBRE, NIT
         FROM CLIENTE
        ${whereClause}
        ORDER BY NOMBRE ASC
        FETCH FIRST 50 ROWS ONLY`,
      search ? { search: `%${search}%` } : {},
    );

    return (result.rows ?? []).map((r) => ({
      id: r.ID_CLIENTE,
      label: r.NIT ? `${r.NOMBRE} — NIT ${r.NIT}` : r.NOMBRE,
      nit: r.NIT,
    }));
  } finally {
    await conn.close();
  }
}


export async function findClienteNit(idCliente: number): Promise<string | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ NIT: string | null }>(
      `SELECT NIT
         FROM CLIENTE
        WHERE ID_CLIENTE = :idCliente`,
      { idCliente },
    );
    return result.rows?.[0]?.NIT ?? null;
  } finally {
    await conn.close();
  }
}

export async function listTiposDocumento(): Promise<DocumentoCatalogoOption[]> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ ID_TIPO_DOCUMENTO: number; CODIGO: string; NOMBRE: string }>(
      `SELECT ID_TIPO_DOCUMENTO, CODIGO, NOMBRE
         FROM CXC_TIPOS_DOCUMENTO
        WHERE TRIM(ESTADO) = 'A'
        ORDER BY NOMBRE ASC`,
    );

    return (result.rows ?? []).map((r) => ({
      id: r.ID_TIPO_DOCUMENTO,
      label: `${r.CODIGO} — ${r.NOMBRE}`,
    }));
  } finally {
    await conn.close();
  }
}

export async function listMonedas(): Promise<DocumentoCatalogoOption[]> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ ID_MONEDA: number; CODIGO: string; NOMBRE: string | null }>(
      `SELECT ID_MONEDA, CODIGO, NOMBRE
         FROM MONEDA
        ORDER BY CODIGO ASC`,
    );

    return (result.rows ?? []).map((r) => ({
      id: r.ID_MONEDA,
      label: r.NOMBRE ? `${r.CODIGO} — ${r.NOMBRE}` : r.CODIGO,
    }));
  } finally {
    await conn.close();
  }
}

export async function listCondicionesCredito(): Promise<DocumentoCatalogoOption[]> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{
      ID_CONDICION: number;
      DIAS_CREDITO: number;
      PORCENTAJE_MORA: number;
      DIAS_GRACIA: number;
    }>(
      `SELECT ID_CONDICION, DIAS_CREDITO, PORCENTAJE_MORA, DIAS_GRACIA
         FROM CXC_CONDICIONES_CREDITO
        WHERE TRIM(ESTADO) = 'A'
        ORDER BY DIAS_CREDITO ASC`,
    );

    return (result.rows ?? []).map((r) => ({
      id: r.ID_CONDICION,
      label: `${r.DIAS_CREDITO} días crédito · ${Number(r.PORCENTAJE_MORA)}% mora tras ${r.DIAS_GRACIA}d de gracia`,
    }));
  } finally {
    await conn.close();
  }
}

export async function listEmpleados(): Promise<DocumentoCatalogoOption[]> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ ID_EMPLEADO: number; NOMBRE: string; APELLIDO: string | null }>(
      `SELECT ID_EMPLEADO, NOMBRE, APELLIDO
         FROM EMPLEADO
        ORDER BY NOMBRE ASC`,
    );

    return (result.rows ?? []).map((r) => ({
      id: r.ID_EMPLEADO,
      label: `${r.NOMBRE} ${r.APELLIDO ?? ''}`.trim(),
    }));
  } finally {
    await conn.close();
  }
}

export async function listDocumentosPorCliente(idCliente: number): Promise<DocumentoCatalogoOption[]> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{
      ID_DOCUMENTO: number;
      SERIE: string | null;
      NUMERO_DOCUMENTO: string;
      SALDO: number;
    }>(
      `SELECT ID_DOCUMENTO, SERIE, NUMERO_DOCUMENTO, SALDO
         FROM CXC_DOCUMENTOS
        WHERE ID_CLIENTE = :idCliente
        ORDER BY FECHA_DOCUMENTO DESC, ID_DOCUMENTO DESC`,
      { idCliente },
    );

    return (result.rows ?? []).map((r) => ({
      id: r.ID_DOCUMENTO,
      label: `${[r.SERIE, r.NUMERO_DOCUMENTO].filter(Boolean).join('-')} (saldo: ${r.SALDO})`,
      saldo: r.SALDO,
    }));
  } finally {
    await conn.close();
  }
}
