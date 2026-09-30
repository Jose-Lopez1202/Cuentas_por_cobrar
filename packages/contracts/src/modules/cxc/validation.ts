import { z } from 'zod';

export const DATE_MIN = '1900-01-01';
export const DATE_MAX = '2100-12-31';

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1900 || year > 2100) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isoDateSchema(fieldLabel: string) {
  return z
    .string()
    .min(1, `${fieldLabel} es obligatoria`)
    .refine(isIsoDate, `${fieldLabel} debe ser una fecha válida entre ${DATE_MIN} y ${DATE_MAX}`);
}

export function optionalIsoDateSchema(fieldLabel: string) {
  return z
    .string()
    .refine(
      (value) => value === '' || isIsoDate(value),
      `${fieldLabel} debe ser una fecha válida entre ${DATE_MIN} y ${DATE_MAX}`,
    )
    .optional();
}

export function nullableIsoDateSchema(fieldLabel: string) {
  return z
    .string()
    .refine(
      (value) => value === '' || isIsoDate(value),
      `${fieldLabel} debe ser una fecha válida entre ${DATE_MIN} y ${DATE_MAX}`,
    )
    .nullable()
    .optional();
}

export function hasAtMostDecimals(value: number, places: number): boolean {
  if (!Number.isFinite(value)) return false;
  const factor = 10 ** places;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-8;
}

export function moneySchema(fieldLabel: string, positive = false) {
  const base = z.number().finite(`${fieldLabel} debe ser un número válido`);
  const signed = positive
    ? base.positive(`${fieldLabel} debe ser mayor a 0`)
    : base.nonnegative(`${fieldLabel} no puede ser negativo`);

  return signed.refine(
    (value) => hasAtMostDecimals(value, 2),
    `${fieldLabel} admite como máximo 2 decimales`,
  );
}

export function optionalMoneySchema(fieldLabel: string, positive = false) {
  return moneySchema(fieldLabel, positive).nullable().optional();
}

export function percentageSchema(fieldLabel: string, decimals = 4) {
  return z
    .number()
    .finite(`${fieldLabel} debe ser un número válido`)
    .min(0, `${fieldLabel} no puede ser negativo`)
    .max(100, `${fieldLabel} no puede superar 100`)
    .refine(
      (value) => hasAtMostDecimals(value, decimals),
      `${fieldLabel} admite como máximo ${decimals} decimales`,
    );
}

export const identifierSchema = (fieldLabel: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${fieldLabel} es obligatorio`)
    .max(max, `${fieldLabel} no puede superar ${max} caracteres`)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9\-_/]*$/,
      `${fieldLabel} solo admite letras, números, guion, guion bajo o diagonal`,
    );

export const optionalIdentifierSchema = (fieldLabel: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${fieldLabel} no puede superar ${max} caracteres`)
    .refine(
      (value) => value === '' || /^[A-Za-z0-9][A-Za-z0-9\-_/]*$/.test(value),
      `${fieldLabel} solo admite letras, números, guion, guion bajo o diagonal`,
    )
    .nullable()
    .optional();

export const nitSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(20, 'El NIT no puede superar 20 caracteres')
  .refine(
    (value) => value === 'CF' || /^\d{4,12}-?[0-9K]$/.test(value),
    'El NIT debe tener un formato válido, por ejemplo 1234567-8',
  );

export function optionalTrimmedText(fieldLabel: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${fieldLabel} no puede superar ${max} caracteres`)
    .nullable()
    .optional();
}

export const timeSchema = (fieldLabel: string) =>
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${fieldLabel} debe tener formato HH:MM`)
    .optional();
