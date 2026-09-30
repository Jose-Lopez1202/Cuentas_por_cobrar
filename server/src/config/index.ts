import 'dotenv/config';

const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

const envCorsOrigins = process.env.CORS_ORIGINS
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Configuración global. Nunca exportar credenciales al frontend ni imprimir
// passwords/connection strings completos en logs.
export const config = {
  port: Number(process.env.PORT || 3000),
  corsOrigins: envCorsOrigins?.length ? envCorsOrigins : defaultCorsOrigins,
  oracleConnection: {
    user: process.env.NODE_ORACLEDB_USER || '',
    password: process.env.NODE_ORACLEDB_PASSWORD || '',
    connectString: process.env.NODE_ORACLEDB_CONNECTIONSTRING || '',
  },
};
