/**
 * Fecha de negocio en formato YYYY-MM-DD.
 * CxC opera con fechas civiles (no instantes UTC). El huso puede cambiarse
 * con APP_TIME_ZONE; por defecto se usa Guatemala para evitar que un servidor
 * UTC considere "mañana" antes que el usuario local.
 */
export function businessTodayIso(
  timeZone = process.env.APP_TIME_ZONE || 'America/Guatemala',
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
