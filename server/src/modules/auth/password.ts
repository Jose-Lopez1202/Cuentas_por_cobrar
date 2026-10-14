import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'crypto';

/**
 * Hash de contraseñas con scrypt (incluido en Node, sin dependencias nativas).
 * Formato: scrypt$N$r$p$salt(base64)$hash(base64). La sal es única por usuario
 * y los parámetros viajan en el propio hash, así se pueden subir sin romper
 * las contraseñas ya guardadas.
 */
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const MAXMEM = 128 * N * R * 2;

function scrypt(password: string, salt: Buffer, keyLen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize('NFKC'), salt, keyLen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const salt = Buffer.from(saltB64, 'base64');
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  const key = await scrypt(password, salt, expected.length, { ...params, maxmem: 128 * params.N * params.r * 2 });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Hash "señuelo": se verifica contra él cuando el usuario no existe, para que
// responder "usuario inexistente" tarde lo mismo que "contraseña incorrecta".
let decoy: Promise<string> | null = null;
export async function verifyDecoy(password: string): Promise<void> {
  decoy ??= hashPassword(randomBytes(12).toString('hex'));
  await verifyPassword(password, await decoy);
}

/** Contraseña temporal aleatoria que cumple la política (sin caracteres ambiguos como I, l, 1, O, 0). */
export function generarClaveTemporal(): string {
  const pick = (set: string) => set[randomBytes(1)[0] % set.length];
  const base = randomBytes(9).toString('base64url').replace(/[-_Il1O0]/g, 'x');
  return `${pick('ABCDEFGHJKLMNPQRSTUVWXYZ')}${pick('abcdefghijkmnpqrstuvwxyz')}${pick('23456789')}${pick('!#$%&*?')}${base}`;
}
