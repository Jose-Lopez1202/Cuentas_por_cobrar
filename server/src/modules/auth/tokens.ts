import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import type { Rol } from '@erp/contracts';
import { config } from '../../config';

export interface AccessClaims {
  sub: number;
  usr: string;
  nom: string;
  rol: Rol;
  sid: string;
  /** Debe cambiar la clave antes de usar el sistema. */
  dcc: boolean;
}

export function signAccessToken(claims: AccessClaims): { token: string; expiresIn: number } {
  const expiresIn = config.auth.accessTtlMinutes * 60;
  const token = jwt.sign(
    { usr: claims.usr, nom: claims.nom, rol: claims.rol, sid: claims.sid, dcc: claims.dcc },
    config.auth.jwtSecret,
    { algorithm: 'HS256', subject: String(claims.sub), expiresIn, issuer: 'erp-cxc', audience: 'erp-cxc-web' },
  );
  return { token, expiresIn };
}

/** Verifica firma, expiración, emisor y audiencia. Solo acepta HS256. */
export function verifyAccessToken(token: string): AccessClaims | null {
  try {
    const p = jwt.verify(token, config.auth.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'erp-cxc',
      audience: 'erp-cxc-web',
    }) as jwt.JwtPayload;
    if (!p.sub || typeof p.sid !== 'string') return null;
    return { sub: Number(p.sub), usr: String(p.usr), nom: String(p.nom), rol: p.rol as Rol, sid: p.sid, dcc: Boolean(p.dcc) };
  } catch {
    return null;
  }
}

/** Refresh token opaco: "<idSesion>.<secreto>". En BD solo se guarda sha256(secreto). */
export function newRefreshSecret(): string {
  return randomBytes(48).toString('base64url');
}

export const hashSecret = (secret: string): string => createHash('sha256').update(secret).digest('hex');

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function buildRefreshToken(idSesion: string, secret: string): string {
  return `${idSesion}.${secret}`;
}

export function parseRefreshToken(raw: string | undefined): { idSesion: string; secret: string } | null {
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot !== 36) return null;
  const idSesion = raw.slice(0, dot);
  const secret = raw.slice(dot + 1);
  if (!/^[0-9a-f-]{36}$/i.test(idSesion) || !/^[A-Za-z0-9_-]{40,100}$/.test(secret)) return null;
  return { idSesion, secret };
}
