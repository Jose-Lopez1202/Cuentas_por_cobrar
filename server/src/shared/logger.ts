/**
 * Logger estructurado mínimo, sin dependencias externas (no hay Sentry/Winston
 * instalado y no se agrega ninguno sin que el equipo lo decida). Cada línea es
 * un JSON de una sola línea — cualquier agregador de logs real (CloudWatch,
 * Datadog, journald, etc.) puede parsear esto directo sin cambios; hoy solo
 * sale por stdout/stderr porque no hay ningún backend de logs configurado
 * todavía en este entorno.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, fields?: LogFields) {
  const line = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const serialized = JSON.stringify(line);
  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
};
