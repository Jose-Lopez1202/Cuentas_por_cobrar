import type { Request, Response, NextFunction } from 'express';
import { logger } from '../shared/logger';

/**
 * Registra cada request de la API: método, ruta, status y duración. No
 * registra body/query (puede traer datos financieros/PII) ni headers de
 * autorización. Es la base mínima de observabilidad de producción que
 * faltaba: antes de esto, la única señal de qué pasa en el servidor era
 * console.log/console.error sueltos en cada catch.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
    });
  });

  next();
}
