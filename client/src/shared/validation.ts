// Validaciones reutilizables para todos los formularios CxC.
// Mantener estas reglas centralizadas evita que cada CRUD interprete de
// manera distinta conceptos como "fecha válida", "monto" o "campo requerido".

export type ValidationErrors = Record<string, string>;

export const BUSINESS_DATE_MIN = '1900-01-01';
export const BUSINESS_DATE_MAX = '2100-12-31';

function isBlank(value: string | undefined | null): boolean {
  return value === undefined || value === null || value.trim() === '';
}

export function validateRequired(
  value: string | undefined | null,
  fieldLabel: string,
): string | undefined {
  if (isBlank(value)) return `${fieldLabel} es obligatorio.`;
  return undefined;
}

export function validateRequiredSelect(
  value: string | undefined | null,
  fieldLabel: string,
): string | undefined {
  if (isBlank(value)) return `Debes seleccionar ${fieldLabel}.`;
  return undefined;
}

interface NumberOptions {
  positive?: boolean;
  integer?: boolean;
  min?: number;
  max?: number;
  decimalPlaces?: number;
}

export function validateNumber(
  value: string,
  fieldLabel: string,
  opts: NumberOptions = {},
): string | undefined {
  if (isBlank(value)) return undefined;
  const trimmed = value.trim();

  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return `${fieldLabel} debe ser un número válido, sin letras ni símbolos.`;
  }

  const num = Number(trimmed);
  if (!Number.isFinite(num)) return `${fieldLabel} debe ser un número válido.`;

  if (opts.integer && !Number.isInteger(num)) {
    return `${fieldLabel} debe ser un número entero (sin decimales).`;
  }

  if (opts.decimalPlaces !== undefined && trimmed.includes('.')) {
    const decimals = trimmed.split('.')[1]?.length ?? 0;
    if (decimals > opts.decimalPlaces) {
      return `${fieldLabel} admite como máximo ${opts.decimalPlaces} decimales.`;
    }
  }

  if (opts.positive && num <= 0) {
    return `${fieldLabel} debe ser mayor a 0.`;
  }
  if (opts.min !== undefined && num < opts.min) {
    return `${fieldLabel} debe ser mayor o igual a ${opts.min}.`;
  }
  if (opts.max !== undefined && num > opts.max) {
    return `${fieldLabel} debe ser menor o igual a ${opts.max}.`;
  }
  return undefined;
}

export function validateRequiredNumber(
  value: string,
  fieldLabel: string,
  opts: NumberOptions = {},
): string | undefined {
  const requiredError = validateRequired(value, fieldLabel);
  if (requiredError) return requiredError;
  return validateNumber(value, fieldLabel, opts);
}

export function validateMoney(
  value: string,
  fieldLabel: string,
  opts: { required?: boolean; positive?: boolean; min?: number; max?: number } = {},
): string | undefined {
  if (opts.required) {
    const requiredError = validateRequired(value, fieldLabel);
    if (requiredError) return requiredError;
  }
  return validateNumber(value, fieldLabel, {
    positive: opts.positive,
    min: opts.min,
    max: opts.max,
    decimalPlaces: 2,
  });
}

export function parseDateOnly(value: string): Date | null {
  if (isBlank(value)) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface DateOptions {
  notFuture?: boolean;
  notPast?: boolean;
  minDate?: string;
  maxDate?: string;
  notBefore?: { date: string; label: string };
  notAfter?: { date: string; label: string };
}

export function validateDate(
  value: string,
  fieldLabel: string,
  opts: DateOptions = {},
): string | undefined {
  if (isBlank(value)) return undefined;

  const date = parseDateOnly(value);
  if (!date) return `${fieldLabel} no es una fecha válida.`;

  const minDate = parseDateOnly(opts.minDate ?? BUSINESS_DATE_MIN);
  const maxDate = parseDateOnly(opts.maxDate ?? BUSINESS_DATE_MAX);

  if (minDate && date < minDate) {
    return `${fieldLabel} no puede ser anterior a ${opts.minDate ?? BUSINESS_DATE_MIN}.`;
  }
  if (maxDate && date > maxDate) {
    return `${fieldLabel} no puede ser posterior a ${opts.maxDate ?? BUSINESS_DATE_MAX}.`;
  }

  const today = parseDateOnly(todayIso())!;
  if (opts.notFuture && date > today) {
    return `${fieldLabel} no puede ser una fecha futura.`;
  }
  if (opts.notPast && date < today) {
    return `${fieldLabel} no puede ser anterior a hoy.`;
  }

  if (opts.notBefore) {
    const otherDate = parseDateOnly(opts.notBefore.date);
    if (otherDate && date < otherDate) {
      return `${fieldLabel} no puede ser anterior a ${opts.notBefore.label}.`;
    }
  }

  if (opts.notAfter) {
    const otherDate = parseDateOnly(opts.notAfter.date);
    if (otherDate && date > otherDate) {
      return `${fieldLabel} no puede ser posterior a ${opts.notAfter.label}.`;
    }
  }

  return undefined;
}

export function validateRequiredDate(
  value: string,
  fieldLabel: string,
  opts: DateOptions = {},
): string | undefined {
  const requiredError = validateRequired(value, fieldLabel);
  if (requiredError) return requiredError;
  return validateDate(value, fieldLabel, opts);
}

export function validateMaxLength(
  value: string | undefined | null,
  fieldLabel: string,
  max: number,
): string | undefined {
  if (isBlank(value)) return undefined;
  if ((value as string).length > max) {
    return `${fieldLabel} no puede superar los ${max} caracteres.`;
  }
  return undefined;
}

export function validateLettersOnly(
  value: string | undefined | null,
  fieldLabel: string,
): string | undefined {
  if (isBlank(value)) return undefined;
  if (!/^[\p{L}\s.'’-]+$/u.test((value as string).trim())) {
    return `${fieldLabel} solo admite letras.`;
  }
  return undefined;
}

export function validateAlphanumericCode(
  value: string | undefined | null,
  fieldLabel: string,
): string | undefined {
  if (isBlank(value)) return undefined;
  const normalized = (value as string).trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\s.,:'’\-_/#+&()]*$/u.test(normalized)) {
    return `${fieldLabel} contiene caracteres no permitidos.`;
  }
  return undefined;
}

export function validateIdentifier(
  value: string | undefined | null,
  fieldLabel: string,
): string | undefined {
  if (isBlank(value)) return undefined;
  const normalized = (value as string).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9\-_/]*$/.test(normalized)) {
    return `${fieldLabel} solo admite letras, números, guion, guion bajo o diagonal.`;
  }
  return undefined;
}

export function validateGuatemalaNit(
  value: string | undefined | null,
  fieldLabel = 'NIT',
): string | undefined {
  if (isBlank(value)) return undefined;
  const normalized = (value as string).trim().toUpperCase().replace(/\s+/g, '');
  if (normalized === 'CF') return undefined;
  if (!/^\d{4,12}-?[0-9K]$/.test(normalized)) {
    return `${fieldLabel} debe tener un formato válido, por ejemplo 1234567-8.`;
  }
  return undefined;
}

export function validatePercentage(
  value: string,
  fieldLabel: string,
  opts: { required?: boolean; decimalPlaces?: number } = {},
): string | undefined {
  if (opts.required) {
    const requiredError = validateRequired(value, fieldLabel);
    if (requiredError) return requiredError;
  }
  return validateNumber(value, fieldLabel, {
    min: 0,
    max: 100,
    decimalPlaces: opts.decimalPlaces ?? 4,
  });
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.values(errors).some((msg) => Boolean(msg));
}
