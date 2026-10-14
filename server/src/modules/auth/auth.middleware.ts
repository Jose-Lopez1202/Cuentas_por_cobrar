import type { Request, Response, NextFunction } from 'express';
import type { Rol } from '@erp/contracts';
import { config } from '../../config';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors/AppError';
import { sesionVigente } from './auth.service';
import { verifyAccessToken, type AccessClaims } from './tokens';
import jwt from 'jsonwebtoken';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessClaims;
    }
  }
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

/** Exige un access token válido y una sesión no revocada. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearer(req);
    if (!token) throw new UnauthorizedError('Inicia sesión para continuar.', 'UNAUTHORIZED');
    const claims = verifyAccessToken(token);
    if (!claims) {
      // Distingue "expiró" (el cliente puede renovar) de "no es válido".
      const expirado = (() => { try { jwt.verify(token, config.auth.jwtSecret, { algorithms: ['HS256'] }); return false; } catch (e) { return e instanceof jwt.TokenExpiredError; } })();
      throw new UnauthorizedError(expirado ? 'Tu sesión expiró.' : 'Sesión no válida.', expirado ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED');
    }
    if (!(await sesionVigente(claims.sid))) throw new UnauthorizedError('Tu sesión fue cerrada. Inicia sesión de nuevo.', 'SESSION_INVALID');
    req.auth = claims;
    next();
  } catch (err) {
    next(err);
  }
}

/** Mientras la clave sea temporal, solo se puede cambiar la clave. */
export function blockIfPasswordChangeRequired(req: Request, _res: Response, next: NextFunction) {
  if (req.auth?.dcc) {
    return next(new ForbiddenError('Debes cambiar tu contraseña temporal antes de continuar.', 'PASSWORD_CHANGE_REQUIRED'));
  }
  next();
}

const LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Rol "solo consulta": únicamente lectura. */
export function enforceReadOnlyRole(req: Request, _res: Response, next: NextFunction) {
  if (req.auth?.rol === 'CONSULTA' && !LECTURA.has(req.method)) {
    return next(new ForbiddenError('Tu usuario es de solo consulta: no puede crear, modificar ni eliminar información.'));
  }
  next();
}

export const requireRole = (...roles: Rol[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth || !roles.includes(req.auth.rol)) return next(new ForbiddenError('No tienes permiso para realizar esta acción.'));
  next();
};

/** Defensa extra contra CSRF en las rutas que usan la cookie de renovación. */
export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && !config.corsOrigins.includes(origin)) {
    return next(new ForbiddenError('Origen no permitido.', 'ORIGIN_NOT_ALLOWED'));
  }
  next();
}
