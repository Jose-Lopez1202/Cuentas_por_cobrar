import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cxcRoutes from './modules/cxc/routes';
import authRoutes from './modules/auth/auth.routes';
import usuariosRoutes from './modules/usuarios/usuarios.routes';
import { blockIfPasswordChangeRequired, enforceReadOnlyRole, requireAuth } from './modules/auth/auth.middleware';
import { errorHandler, noStore, requestLogger, securityHeaders } from './middlewares';
import { initOraclePool, closeOraclePool } from './config/database';
import { config } from './config';
import { logger } from './shared/logger';

const app = express();
const PORT = config.port;

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(requestLogger);
app.use(cors({
  origin(origin, callback) {
    // Herramientas locales/server-to-server pueden no enviar Origin.
    if (!origin || config.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no permitido por CORS'));
  },
  // La cookie de renovación viaja solo a orígenes de la lista blanca.
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Datos financieros: evitar caché de navegador/proxy en toda la API CxC.
// Login/renovación/cierre de sesión (públicas, con su propia protección).
app.use('/api/auth', noStore, authRoutes);

// Todo CxC exige sesión válida, clave ya cambiada y rol con permiso para la operación.
app.use('/api/admin/usuarios', noStore, requireAuth, blockIfPasswordChangeRequired, usuariosRoutes);
app.use('/api/cxc', noStore, requireAuth, blockIfPasswordChangeRequired, enforceReadOnlyRole, cxcRoutes);

app.use(errorHandler);

async function bootstrap() {
  try {
    await initOraclePool();

    const server = app.listen(PORT, () => {
      logger.info('server_started', { port: PORT });
    });

    let shuttingDown = false;
    const shutdown = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info('server_shutdown_initiated');

      server.close(async () => {
        try {
          await closeOraclePool();
        } finally {
          process.exit(0);
        }
      });
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    logger.error('server_startup_failed', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

void bootstrap();
