const pad2 = (value: string | number) => String(value).padStart(2, '0');

/**
 * Formats a date for display in the CxC UI using Guatemala's business format: DD/MM/YYYY.
 * ISO date strings are parsed by their calendar components to avoid UTC/time-zone day shifts.
 * Keep form values as YYYY-MM-DD for native <input type="date"> controls.
 */
export const formatDateGT = (value: unknown, fallback = '—'): string => {
  if (value === null || value === undefined || value === '') return fallback;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback;
    return new Intl.DateTimeFormat('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Guatemala',
    }).format(value);
  }

  const text = String(value).trim();
  if (!text) return fallback;

  // Oracle/API commonly returns YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${pad2(day)}/${pad2(month)}/${year}`;
  }

  // Normalize an already-local D/M/YYYY value so it always has leading zeroes.
  const localMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (localMatch) {
    const [, day, month, year] = localMatch;
    return `${pad2(day)}/${pad2(month)}/${year}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fallback;

  return new Intl.DateTimeFormat('es-GT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Guatemala',
  }).format(parsed);
};
