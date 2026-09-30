import { Request, Response, NextFunction } from 'express';
import * as rutaService from '../../services/organizacion/ruta.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await rutaService.listRutas({
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
    const ruta = await rutaService.getRuta(Number(req.params.id));
    res.json(ruta);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const ruta = await rutaService.createRuta(req.body);
    res.status(201).json(ruta);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const ruta = await rutaService.updateRuta(Number(req.params.id), req.body);
    res.json(ruta);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await rutaService.deleteRuta(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
