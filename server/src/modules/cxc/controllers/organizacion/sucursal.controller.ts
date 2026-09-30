import { Request, Response, NextFunction } from 'express';
import * as sucursalService from '../../services/organizacion/sucursal.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await sucursalService.listSucursales({
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
    const sucursal = await sucursalService.getSucursal(Number(req.params.id));
    res.json(sucursal);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const sucursal = await sucursalService.createSucursal(req.body);
    res.status(201).json(sucursal);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const sucursal = await sucursalService.updateSucursal(Number(req.params.id), req.body);
    res.json(sucursal);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await sucursalService.deleteSucursal(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
