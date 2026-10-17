import { z } from 'zod';

export const ROLES = ['ADMIN', 'OPERADOR', 'CONSULTA'] as const;
export type Rol = (typeof ROLES)[number];

export const ROL_LABEL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  OPERADOR: 'Operador',
  CONSULTA: 'Solo consulta',
};

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const COMUNES = [
  'password', 'contrasena', 'contraseña', '123456', '12345678', 'qwerty', 'admin', 'letmein', 'welcome',
  'abc123', 'iloveyou', 'guatemala', 'cuentasporcobrar', 'erp',
];

export interface RequisitoClave {
  id: string;
  texto: string;
  cumple: boolean;
}

/** Requisitos de la contraseña; el cliente los muestra en vivo y el servidor los exige. */
export function evaluarClave(password: string, username = ''): RequisitoClave[] {
  const lower = password.toLowerCase();
  const user = username.trim().toLowerCase();
  return [
    { id: 'largo', texto: `Al menos ${PASSWORD_MIN} caracteres`, cumple: password.length >= PASSWORD_MIN },
    { id: 'minuscula', texto: 'Una letra minúscula', cumple: /[a-záéíóúñ]/.test(password) },
    { id: 'mayuscula', texto: 'Una letra mayúscula', cumple: /[A-ZÁÉÍÓÚÑ]/.test(password) },
    { id: 'numero', texto: 'Un número', cumple: /\d/.test(password) },
    { id: 'simbolo', texto: 'Un símbolo (por ejemplo ! ? # $ %)', cumple: /[^A-Za-z0-9áéíóúñÁÉÍÓÚÑ]/.test(password) },
    { id: 'repetidos', texto: 'Sin 4 caracteres iguales seguidos', cumple: !/(.)\1{3,}/.test(password) },
    { id: 'usuario', texto: 'No contiene tu usuario', cumple: !(user.length >= 3 && lower.includes(user)) },
    { id: 'comun', texto: 'No es una contraseña común', cumple: !COMUNES.some((c) => lower.includes(c)) },
  ];
}

export function clavePermitida(password: string, username = ''): boolean {
  return password.length <= PASSWORD_MAX && evaluarClave(password, username).every((r) => r.cumple);
}

/** 0 (muy débil) a 4 (fuerte), para la barra de fortaleza. */
export function fortalezaClave(password: string, username = ''): number {
  if (!password) return 0;
  const cumplidos = evaluarClave(password, username).filter((r) => r.cumple).length;
  const extra = password.length >= 14 ? 1 : 0;
  return Math.min(4, Math.floor(((cumplidos + extra) / 9) * 4.4));
}

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Ingresa tu usuario').max(50, 'El usuario no puede superar 50 caracteres'),
  password: z.string().min(1, 'Ingresa tu contraseña').max(PASSWORD_MAX, 'La contraseña es demasiado larga'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const cambiarClaveSchema = z.object({
  claveActual: z.string().min(1, 'Ingresa tu contraseña actual').max(PASSWORD_MAX),
  claveNueva: z.string().min(PASSWORD_MIN, `La contraseña nueva debe tener al menos ${PASSWORD_MIN} caracteres`).max(PASSWORD_MAX, 'La contraseña es demasiado larga'),
});
export type CambiarClaveInput = z.infer<typeof cambiarClaveSchema>;

export interface UsuarioSesion {
  idUsuario: number;
  username: string;
  nombre: string;
  rol: Rol;
  debeCambiarClave: boolean;
}

export interface SesionRespuesta {
  accessToken: string;
  /** Segundos de vida del access token. */
  expiresIn: number;
  usuario: UsuarioSesion;
}

// --- Administración de usuarios (solo ADMIN) -------------------------------------

export const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,50}$/;

export const crearUsuarioSchema = z.object({
  username: z.string().trim()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50, 'El usuario no puede superar 50 caracteres')
    .regex(USERNAME_REGEX, 'El usuario solo admite letras, números, punto, guion y guion bajo (sin espacios)'),
  nombre: z.string().trim().min(2, 'Ingresa el nombre completo').max(120, 'El nombre no puede superar 120 caracteres'),
  email: z.string().trim().max(150, 'El correo no puede superar 150 caracteres')
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), 'Ingresa un correo válido (ejemplo: nombre@empresa.com)')
    .optional(),
  rol: z.enum(ROLES, { message: 'Selecciona un rol' }),
});
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export const editarUsuarioSchema = crearUsuarioSchema.omit({ username: true }).extend({
  estado: z.enum(['ACTIVO', 'INACTIVO'], { message: 'Selecciona un estado' }),
});
export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;

export interface UsuarioAdmin {
  idUsuario: number;
  username: string;
  nombre: string;
  email: string | null;
  rol: Rol;
  estado: 'ACTIVO' | 'INACTIVO';
  debeCambiarClave: boolean;
  /** Minutos que faltan para que termine el bloqueo por intentos fallidos (0 = no bloqueado). */
  minutosBloqueo: number;
  intentosFallidos: number;
  sesionesActivas: number;
  ultimoLogin: string | null;
  fechaCreacion: string;
}

export interface UsuarioCreado {
  usuario: UsuarioAdmin;
  /** Contraseña temporal: se muestra una sola vez; el servidor no la guarda. */
  claveTemporal: string;
}

export interface BitacoraAcceso {
  idBitacora: number;
  username: string | null;
  evento: string;
  ip: string | null;
  userAgent: string | null;
  detalle: string | null;
  fecha: string;
}

// --- Recuperación de contraseña -------------------------------------------------

export const recuperarClaveSchema = z.object({
  identificador: z.string().trim().min(1, 'Ingresa tu usuario o tu correo').max(150, 'El texto es demasiado largo'),
});
export type RecuperarClaveInput = z.infer<typeof recuperarClaveSchema>;

export const restablecerClaveSchema = z.object({
  token: z.string().min(20, 'El enlace no es válido').max(200, 'El enlace no es válido'),
  claveNueva: z.string().min(PASSWORD_MIN, `La contraseña nueva debe tener al menos ${PASSWORD_MIN} caracteres`).max(PASSWORD_MAX, 'La contraseña es demasiado larga'),
});
export type RestablecerClaveInput = z.infer<typeof restablecerClaveSchema>;
