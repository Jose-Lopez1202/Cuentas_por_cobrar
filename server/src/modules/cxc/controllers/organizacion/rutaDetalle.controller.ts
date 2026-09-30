import { Request, Response, NextFunction } from 'express';
import * as rutaDetalleService from '../../services/organizacion/rutaDetalle.service';

export async function listByRuta(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await rutaDetalleService.listDetalleByRuta(Number(req.params.id));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const detalle = await rutaDetalleService.createDetalle(Number(req.params.id), req.body);
    res.status(201).json(detalle);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const detalle = await rutaDetalleService.updateDetalle(Number(req.params.idDetalle), req.body);
    res.json(detalle);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await rutaDetalleService.deleteDetalle(Number(req.params.idDetalle));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
