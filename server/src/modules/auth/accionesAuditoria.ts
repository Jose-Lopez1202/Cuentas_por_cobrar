import type { Request, Response, NextFunction } from 'express';
import { getConnection } from '../../config/database';
import { logger } from '../../shared/logger';

/**
 * Campos que identifican a quien ejecuta una acción. Nunca deben venir del
 * cliente: el servidor los toma de la sesión (ver conEmpleadoActual).
 */
const CAMPOS_ACTOR = [
  'idEmpleado',
  'idEmpleadoAnulacion',
  'idEmpleadoReversa',
  'idEmpleadoAprobador',
  'idEmpleadoAprobador2',
  'idEmpleadoEmision',
  'idUsuario',
];

/**
 * Rutas donde idEmpleado es una ASIGNACIÓN (a quién se le da una ruta o un
 * cobro), no "quién lo hizo": ahí sí lo decide quien opera la pantalla.
 */
const RUTAS_CON_ASIGNACION = /^\/(rutas|cobradores)(\/|$)/;

const ESCRITURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Inmoviliza al autor: descarta del body cualquier campo de "quién lo hizo".
 * Sin esto, un PATCH con `idEmpleado` reescribiría el autor original de un
 * registro. Las acciones que sí necesitan al empleado (crear, anular,
 * reversar, aprobar) lo vuelven a poner desde la sesión con conEmpleadoActual.
 */
export function blindarActor(req: Request, _res: Response, next: NextFunction) {
  if (ESCRITURA.has(req.method) && req.body && typeof req.body === 'object' && !RUTAS_CON_ASIGNACION.test(req.path)) {
    for (const campo of CAMPOS_ACTOR) delete req.body[campo];
  }
  next();
}

let avisoTablaFaltante = false;

/** idRegistro/acción a partir de la URL: /pagos/12/anular → entidad pagos, id 12, acción anular. */
function describirRuta(path: string): { entidad: string | null; idRegistro: number | null; accion: string | null } {
  const partes = path.split('?')[0].split('/').filter(Boolean);
  const entidad = partes[0] ?? null;
  let idRegistro: number | null = null;
  const acciones: string[] = [];
  for (const parte of partes.slice(1)) {
    if (/^\d+$/.test(parte)) idRegistro = Number(parte);
    else acciones.push(parte);
  }
  return { entidad: entidad?.slice(0, 60) ?? null, idRegistro, accion: acciones.join('/').slice(0, 40) || null };
}

async function guardar(req: Request, status: number, idCreado: number | null) {
  const auth = req.auth;
  if (!auth) return;
  const d = describirRuta(req.path);
  const conn = await getConnection();
  try {
    await conn.execute(
      `INSERT INTO SEG_BITACORA_ACCION
         (ID_USUARIO, USERNAME, NOMBRE_USUARIO, ID_EMPLEADO, METODO, RUTA, ENTIDAD, ID_REGISTRO, ACCION, ESTADO_HTTP, IP)
       VALUES (:idUsuario, :username, :nombre,
               (SELECT ID_EMPLEADO FROM SEG_USUARIOS WHERE ID_USUARIO = :idUsuario),
               :metodo, :ruta, :entidad, :idRegistro, :accion, :status, :ip)`,
      {
        idUsuario: auth.sub,
        username: auth.usr.slice(0, 50),
        nombre: auth.nom.slice(0, 120),
        metodo: req.method,
        ruta: req.originalUrl.split('?')[0].slice(0, 250),
        entidad: d.entidad,
        idRegistro: d.idRegistro ?? idCreado,
        accion: d.accion,
        status,
        ip: (req.ip ?? '').slice(0, 64) || null,
      },
    );
    await conn.commit();
  } finally {
    await conn.close();
  }
}

/** Primer campo `id…` numérico de la respuesta de una creación (idPago, idDocumento...). */
function idDeRespuesta(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (/^id[A-Z]/.test(k) && typeof v === 'number') return v;
  }
  return null;
}

/**
 * Deja constancia de quién hizo cada operación que modifica datos y salió bien.
 * El usuario sale del token de la sesión, nunca del body. La bitácora nunca
 * debe romper la operación: si no se puede escribir, solo se avisa en el log.
 */
export function registrarAcciones(req: Request, res: Response, next: NextFunction) {
  if (!ESCRITURA.has(req.method)) return next();

  let idCreado: number | null = null;
  const jsonOriginal = res.json.bind(res);
  res.json = (body?: unknown) => {
    idCreado = idDeRespuesta(body);
    return jsonOriginal(body);
  };

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || !req.auth) return;
    guardar(req, res.statusCode, idCreado).catch((err: unknown) => {
      const falta = typeof err === 'object' && err !== null && 'errorNum' in err && (err as { errorNum: number }).errorNum === 942;
      if (falta) {
        if (!avisoTablaFaltante) {
          avisoTablaFaltante = true;
          logger.warn('SEG_BITACORA_ACCION no existe: corre la migración 010_bitacora_acciones.sql para registrar quién hace cada acción.');
        }
        return;
      }
      logger.error('No se pudo registrar la acción en la bitácora', { path: req.originalUrl, error: err instanceof Error ? err.message : String(err) });
    });
  });

  next();
}
