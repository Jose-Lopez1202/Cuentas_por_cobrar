import { Request, Response, NextFunction } from 'express';
import * as gestionCobroService from '../../services/cobranza/gestionCobro.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await gestionCobroService.listGestiones({
      page: req.query.page as string | undefined,
      limit: req.query.limit as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const gestion = await gestionCobroService.getGestion(Number(req.params.id));
    res.json(gestion);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const gestion = await gestionCobroService.createGestion(req.body);
    res.status(201).json(gestion);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const gestion = await gestionCobroService.updateGestion(Number(req.params.id), req.body);
    res.json(gestion);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await gestionCobroService.deleteGestion(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
