// Configuración de conexión y pool de la base de datos Oracle
import oracledb from 'oracledb';
import { config } from './index';
import { logger } from '../shared/logger';

// oracledb corre en modo Thin por defecto desde v6+: no requiere Oracle
// Instant Client instalado en la máquina ni en el contenedor de despliegue.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false; // control explícito de commit/rollback en cada repositorio

let pool: oracledb.Pool | null = null;

/**
 * Inicializa el pool de conexiones. Debe llamarse UNA vez al arrancar el
 * servidor (ver src/index.ts), nunca dentro de un repositorio individual.
 */
export async function initOraclePool(): Promise<oracledb.Pool> {
  if (pool) return pool;

  const { user, password, connectString } = config.oracleConnection;

  // Chequeo de sanidad: si el .env no cargó (o falta una variable), es mejor
  // fallar aquí con un mensaje claro que dejar que oracledb tire un error
  // críptico (NJS-125 y similares) por recibir valores vacíos.
  if (!user || !password || !connectString) {
    throw new Error(
      '[Oracle] Faltan variables de conexión (NODE_ORACLEDB_USER, NODE_ORACLEDB_PASSWORD o ' +
      'NODE_ORACLEDB_CONNECTIONSTRING). Verifica que existe server/.env y que "dotenv/config" ' +
      'se está importando al inicio de src/index.ts.',
    );
  }

  logger.info('oracle_pool_initializing', { user });

  pool = await oracledb.createPool({
    user,
    password,
    connectString,
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 1,
    poolTimeout: 60,
  });

  logger.info('oracle_pool_initialized');
  return pool;
}

/**
 * Obtiene una conexión del pool. Úsalo dentro de un try/finally y SIEMPRE
 * cierra la conexión (conn.close()) para devolverla al pool — nunca la
 * mantengas abierta entre requests.
 */
export async function getConnection(): Promise<oracledb.Connection> {
  if (!pool) {
    throw new Error(
      'El pool de Oracle no está inicializado. Verifica que initOraclePool() se llamó en el bootstrap del servidor (src/index.ts).',
    );
  }
  return pool.getConnection();
}

/** Cierra el pool. Llamar en el shutdown del servidor (SIGINT/SIGTERM). */
export async function closeOraclePool(): Promise<void> {
  if (pool) {
    await pool.close(10);
    pool = null;
    logger.info('oracle_pool_closed');
  }
}