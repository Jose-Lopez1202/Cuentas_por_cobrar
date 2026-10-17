// Cliente API único para todo el frontend. Centraliza URL, timeout, errores,
// cabeceras y política de caché para evitar fetch() inconsistentes por módulo.

import { toast } from '../components/Toast';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 15000);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
    public code?: string,
    /** Segundos de espera cuando el servidor limita los intentos (429). */
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// --- Sesión ----------------------------------------------------------------------
// El access token vive SOLO en memoria (nunca en localStorage): un script malicioso no
// puede leerlo. La renovación usa una cookie httpOnly que JavaScript tampoco ve.
let accessToken: string | null = null;
export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null) => { accessToken = token; };

/** Eventos de sesión: 'session-lost' (volver al login) y 'password-change-required'. */
export const authEvents = new EventTarget();

interface RefreshResult { accessToken: string; expiresIn: number; usuario: unknown }
let refreshing: Promise<RefreshResult | null> | null = null;

/** Renueva el access token. Una sola petición a la vez: varias pantallas pueden pedirlo juntas. */
export function refreshAccessToken(): Promise<RefreshResult | null> {
  refreshing ??= fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = (await res.json()) as RefreshResult;
      accessToken = body.accessToken;
      return body;
    })
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
}

/**
 * successMessage: texto del aviso al terminar bien un POST/PATCH/DELETE.
 * Usa `false` para no mostrar aviso en una llamada concreta.
 */
export type ApiOptions = RequestInit & { successMessage?: string | false };

function defaultSuccessMessage(method: string, path: string): string {
  if (path.endsWith('/recalcular')) return 'Recálculo completado correctamente.';
  if (method === 'DELETE') return 'Registro eliminado correctamente.';
  if (method === 'PATCH' || method === 'PUT') return 'Cambios guardados correctamente.';
  return 'Información guardada correctamente.';
}

async function request<T>(path: string, { successMessage, ...options }: ApiOptions = {}, retried = false): Promise<T> {
  const notifySuccess = () => {
    const method = (options.method ?? 'GET').toUpperCase();
    if (method === 'GET' || successMessage === false) return;
    toast.success(successMessage ?? defaultSuccessMessage(method, path));
  };

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  externalSignal?.addEventListener('abort', abortFromExternal, { once: true });

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: 'include',
      cache: options.method === 'GET' || !options.method ? 'no-store' : options.cache,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

    if (response.status === 204) {
      notifySuccess();
      return undefined as T;
    }

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const isAuthCall = path.startsWith('/auth/');
      // Token vencido: se renueva una vez y se repite la petición sin que el usuario lo note.
      if (response.status === 401 && !isAuthCall && !retried && (body?.code === 'TOKEN_EXPIRED' || body?.code === 'UNAUTHORIZED')) {
        if (await refreshAccessToken()) {
          window.clearTimeout(timeoutId);
          return request<T>(path, { ...options, successMessage }, true);
        }
      }
      if (response.status === 401 && !isAuthCall) {
        accessToken = null;
        authEvents.dispatchEvent(new Event('session-lost'));
      }
      if (response.status === 403 && body?.code === 'PASSWORD_CHANGE_REQUIRED') {
        authEvents.dispatchEvent(new Event('password-change-required'));
      }
      throw new ApiError(
        body?.error ?? `Error ${response.status}`,
        response.status,
        body?.details,
        body?.code,
        body?.retryAfter,
      );
    }

    notifySuccess();
    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('La solicitud tardó demasiado. Verifica tu conexión e intenta nuevamente.', 408);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

export const apiClient = {
  get: <T>(path: string, options: ApiOptions = {}) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, data: unknown, options: ApiOptions = {}) =>
    request<T>(path, { ...options, method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown, options: ApiOptions = {}) =>
    request<T>(path, { ...options, method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(path: string, options: ApiOptions = {}) => request<T>(path, { ...options, method: 'DELETE' }),
};

/** Construye un query string ignorando valores undefined/vacíos. */
export function buildQueryString(params: Record<string, string | number | undefined>): string {
  const usable = Object.entries(params).filter(([, value]) => value !== undefined && value !== '');
  if (usable.length === 0) return '';
  return '?' + new URLSearchParams(usable.map(([key, value]) => [key, String(value)])).toString();
}
