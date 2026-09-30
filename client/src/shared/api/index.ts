// Cliente API único para todo el frontend. Centraliza URL, timeout, errores,
// cabeceras y política de caché para evitar fetch() inconsistentes por módulo.

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 15000);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
      cache: options.method === 'GET' || !options.method ? 'no-store' : options.cache,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(
        body?.error ?? `Error ${response.status}`,
        response.status,
        body?.details,
      );
    }

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
  get: <T>(path: string, options: RequestInit = {}) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, data: unknown, options: RequestInit = {}) =>
    request<T>(path, { ...options, method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown, options: RequestInit = {}) =>
    request<T>(path, { ...options, method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(path: string, options: RequestInit = {}) => request<T>(path, { ...options, method: 'DELETE' }),
};

/** Construye un query string ignorando valores undefined/vacíos. */
export function buildQueryString(params: Record<string, string | number | undefined>): string {
  const usable = Object.entries(params).filter(([, value]) => value !== undefined && value !== '');
  if (usable.length === 0) return '';
  return '?' + new URLSearchParams(usable.map(([key, value]) => [key, String(value)])).toString();
}
