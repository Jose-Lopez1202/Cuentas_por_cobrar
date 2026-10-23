import type { Request, Response, NextFunction } from 'express';
import * as service from '../services/analitica.service';
import * as repo from '../repositories/analitica.repository';
import { BadRequestError } from '../../../shared/errors/AppError';

type Handler = (req: Request) => Promise<unknown>;
const wrap = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await fn(req)); } catch (e) { next(e); }
};
const id = (req: Request, nombre = 'id') => {
  const n = Number(req.params[nombre]);
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestError('El identificador no es válido.');
  return n;
};

export const filtros = wrap(() => repo.catalogoFiltros());
export const resumen = wrap((req) => service.resumenEjecutivo(req.query));
export const cobradores = wrap((req) => service.cobradores(req.query));
export const cobradorDetalle = wrap((req) => service.cobradorDetalle(id(req), req.query));
export const diasCobro = wrap((req) => service.diasCobro(req.query));
export const diasCobroDetalle = wrap((req) => service.diasCobroDetalle(req.query));
export const rutas = wrap((req) => service.rutas(req.query));
export const rutaDetalle = wrap((req) => service.rutaGrupoDetalle(String(req.query.base ?? ''), req.query));
export const clientesRiesgo = wrap((req) => service.clientesRiesgo(req.query));
export const cliente360 = wrap((req) => service.cliente360(id(req, 'idCliente'), req.query));
