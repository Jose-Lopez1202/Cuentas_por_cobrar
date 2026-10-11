import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors/AppError';
import { logger } from '../shared/logger';

/**
 * Punto único para transformar errores de dominio/validación en HTTP.
 * Nunca devuelve stack traces, SQL, credenciales ni mensajes internos al
 * navegador. El detalle técnico se conserva solo en el log del servidor.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Datos inválidos',
      details: err.issues.map((issue) => ({
        campo: issue.path.join('.'),
        mensaje: issue.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.expose ? err.message : 'No fue posible completar la operación',
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Compatibilidad con módulos que todavía lancen su NotFoundError local.
  if (err instanceof Error && err.name === 'NotFoundError') {
    res.status(404).json({ error: err.message, code: 'NOT_FOUND' });
    return;
  }

  logger.error('unhandled_error', {
    method: req.method,
    path: req.originalUrl,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR',
  });
}
