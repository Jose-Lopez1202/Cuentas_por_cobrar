import { Request, Response, NextFunction } from 'express';
import * as promesaPagoService from '../../services/cobranza/promesaPago.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await promesaPagoService.listPromesas({
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
    const promesa = await promesaPagoService.getPromesa(Number(req.params.id));
    res.json(promesa);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const promesa = await promesaPagoService.createPromesa(req.body);
    res.status(201).json(promesa);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const promesa = await promesaPagoService.updatePromesa(Number(req.params.id), req.body);
    res.json(promesa);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await promesaPagoService.deletePromesa(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
