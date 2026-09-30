import type { Request, Response, NextFunction } from 'express';
import * as service from '../../services/credito/notaCredito.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(100, Math.max(Number(req.query.limit) || 10, 1));
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const result = await service.list({ page, limit, search });
    res.json({ data: result.data, meta: { page, limit, total: result.total, totalPages: Math.max(Math.ceil(result.total / limit), 1) } });
  } catch (error) { next(error); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.getOne(Number(req.params.id))); } catch (error) { next(error); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.create(req.body)); } catch (error) { next(error); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.update(Number(req.params.id), req.body)); } catch (error) { next(error); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try { await service.remove(Number(req.params.id)); res.status(204).send(); } catch (error) { next(error); }
}

export async function anular(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.anular(Number(req.params.id), req.body)); } catch (error) { next(error); }
}
