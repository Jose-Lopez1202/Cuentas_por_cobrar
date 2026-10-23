import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiClient, buildQueryString } from '../../../shared/api';

type Params = Record<string, string | number | undefined>;

/**
 * Carga de datos para los tableros. Conserva el dato anterior mientras llega el nuevo
 * (no parpadea al cambiar un filtro) y cancela la petición anterior.
 */
export function useApi<T>(path: string | null, params: Params = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const clave = path ? `${path}${buildQueryString(params)}` : null;
  const claveAnterior = useRef<string | null>(null);

  useEffect(() => {
    if (!clave) { setData(null); setLoading(false); return; }
    const controller = new AbortController();
    // Si cambió el recurso (no solo el filtro) el dato viejo ya no sirve.
    if (claveAnterior.current && claveAnterior.current.split('?')[0] !== clave.split('?')[0]) setData(null);
    claveAnterior.current = clave;
    setLoading(true);
    setError(null);
    apiClient.get<T>(clave, { signal: controller.signal })
      .then((r) => { if (!controller.signal.aborted) setData(r); })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setError(e instanceof ApiError ? e.message : 'No se pudo cargar la información.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [clave, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}
