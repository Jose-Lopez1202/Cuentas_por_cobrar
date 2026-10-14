import type { Request, Response, NextFunction } from 'express';
import { config } from '../../config';
import * as service from './auth.service';
import * as recuperacion from './recuperacion.service';
import { verifyAccessToken } from './tokens';

const ctx = (req: Request): service.ClientContext => ({
  ip: req.ip ?? null,
  userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
});

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/** Cookie de renovación: inaccesible desde JavaScript, solo viaja a /api/auth y nunca entre sitios. */
function setRefreshCookie(res: Response, value: string, maxAgeSeconds: number) {
  const attrs = [
    `${config.auth.cookieName}=${encodeURIComponent(value)}`,
    'Path=/api/auth', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`,
    ...(config.auth.cookieSecure ? ['Secure'] : []),
  ];
  res.append('Set-Cookie', attrs.join('; '));
}

function clearRefreshCookie(res: Response) {
  const attrs = [`${config.auth.cookieName}=`, 'Path=/api/auth', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0', ...(config.auth.cookieSecure ? ['Secure'] : [])];
  res.append('Set-Cookie', attrs.join('; '));
}

function sendSesion(res: Response, r: service.ResultadoSesion) {
  if (r.refreshToken) setRefreshCookie(res, r.refreshToken, r.refreshMaxAgeSeconds);
  res.json(r.respuesta);
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try { sendSesion(res, await service.login(req.body, ctx(req))); } catch (e) { next(e); }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    sendSesion(res, await service.refresh(readCookie(req, config.auth.cookieName), ctx(req)));
  } catch (e) {
    clearRefreshCookie(res);
    next(e);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? verifyAccessToken(req.headers.authorization.slice(7).trim()) : null;
    await service.logout(bearer, readCookie(req, config.auth.cookieName), ctx(req));
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (e) { next(e); }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.me(req.auth!)); } catch (e) { next(e); }
}

export async function cambiarClave(req: Request, res: Response, next: NextFunction) {
  try { sendSesion(res, await service.cambiarClave(req.auth!, req.body, ctx(req))); } catch (e) { next(e); }
}

export async function recuperarSolicitar(req: Request, res: Response, next: NextFunction) {
  try {
    await recuperacion.solicitar(req.body, ctx(req));
    // Misma respuesta exista o no la cuenta.
    res.status(202).json({ mensaje: 'Si los datos coinciden con una cuenta con correo registrado, enviaremos un enlace para restablecer la contraseña.' });
  } catch (e) { next(e); }
}

export async function recuperarVerificar(req: Request, res: Response, next: NextFunction) {
  try { res.json(await recuperacion.verificarEnlace(req.body?.token, ctx(req))); } catch (e) { next(e); }
}

export async function recuperarRestablecer(req: Request, res: Response, next: NextFunction) {
  try {
    await recuperacion.restablecer(req.body, ctx(req));
    clearRefreshCookie(res);
    res.json({ mensaje: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' });
  } catch (e) { next(e); }
}
