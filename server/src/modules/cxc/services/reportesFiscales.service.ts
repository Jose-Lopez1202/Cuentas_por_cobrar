import type { EstadisticaCobranza, EstadisticaVentas, LibroVentasReporte } from '@erp/contracts';
import { businessTodayIso } from '../../../shared/date';
import { BadRequestError } from '../../../shared/errors/AppError';
import * as repo from '../repositories/reportesFiscales.repository';

function isIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return y >= 1900 && y <= 2100 && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Rango por defecto: del primer día de hace 5 meses a hoy (6 meses calendario). */
function rangoPorDefecto(): { desde: string; hasta: string } {
  const hasta = businessTodayIso();
  const [y, m] = hasta.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - 5, 1));
  return { desde: d.toISOString().slice(0, 10), hasta };
}

function resolverRango(desde?: string, hasta?: string): { desde: string; hasta: string } {
  const def = rangoPorDefecto();
  const d = desde || def.desde;
  const h = hasta || def.hasta;
  if (!isIsoDate(d)) throw new BadRequestError('La fecha "desde" no es válida (usa AAAA-MM-DD).');
  if (!isIsoDate(h)) throw new BadRequestError('La fecha "hasta" no es válida (usa AAAA-MM-DD).');
  if (d > h) throw new BadRequestError('La fecha "desde" no puede ser posterior a "hasta".');
  return { desde: d, hasta: h };
}

export async function getLibroVentas(anio?: string, mes?: string): Promise<LibroVentasReporte> {
  const hoy = businessTodayIso();
  const a = anio ? Number(anio) : Number(hoy.slice(0, 4));
  const m = mes ? Number(mes) : Number(hoy.slice(5, 7));
  if (!Number.isInteger(a) || a < 2000 || a > 2100) throw new BadRequestError('El año debe estar entre 2000 y 2100.');
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new BadRequestError('El mes debe estar entre 1 y 12.');
  return repo.getLibroVentas(a, m);
}

export async function getEstadisticaVentas(desde?: string, hasta?: string): Promise<EstadisticaVentas> {
  const r = resolverRango(desde, hasta);
  return repo.getEstadisticaVentas(r.desde, r.hasta);
}

export async function getEstadisticaCobranza(desde?: string, hasta?: string): Promise<EstadisticaCobranza> {
  const r = resolverRango(desde, hasta);
  return repo.getEstadisticaCobranza(r.desde, r.hasta);
}
