import { Request, Response, NextFunction } from 'express';
import * as condicionCreditoService from '../../services/credito/condicionCredito.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await condicionCreditoService.listCondiciones({
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
    const condicion = await condicionCreditoService.getCondicion(
      Number(req.params.id),
    );

    res.json(condicion);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const condicion = await condicionCreditoService.createCondicion(req.body);

    res.status(201).json(condicion);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const condicion = await condicionCreditoService.updateCondicion(
      Number(req.params.id),
      req.body,
    );

    res.json(condicion);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await condicionCreditoService.deleteCondicion(Number(req.params.id));

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}