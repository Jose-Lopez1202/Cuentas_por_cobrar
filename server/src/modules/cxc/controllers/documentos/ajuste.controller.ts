import { Request, Response, NextFunction } from 'express';
import * as ajusteService from '../../services/documentos/ajuste.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await ajusteService.listAjustes({
      page: req.query.page as string | undefined,
      limit: req.query.limit as string | undefined,
      search: req.query.search as string | undefined,
    }));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await ajusteService.getAjuste(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await ajusteService.createAjuste(req.body));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await ajusteService.updateAjuste(Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await ajusteService.deleteAjuste(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function aprobar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await ajusteService.aprobarAjuste(Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
}

export async function rechazar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await ajusteService.rechazarAjuste(Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
}
