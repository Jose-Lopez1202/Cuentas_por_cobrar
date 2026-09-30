const KEY = 'cxc.tutoriales.completados';

/** localStorage puede lanzar (modo privado, bloqueo de datos): siempre degradar en silencio. */
export const getCompleted = (): string[] => {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

export const markCompleted = (id: string): void => {
  try {
    const next = Array.from(new Set([...getCompleted(), id]));
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* sin persistencia disponible */
  }
};

export const resetCompleted = (): void => {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* sin persistencia disponible */
  }
};
