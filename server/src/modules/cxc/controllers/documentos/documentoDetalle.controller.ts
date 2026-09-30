import { Request, Response, NextFunction } from 'express';
import * as detalleService from '../../services/documentos/documentoDetalle.service';

export async function listByDocumento(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await detalleService.listDetalles(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await detalleService.createDetalle(Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await detalleService.updateDetalle(Number(req.params.idDetalle), req.body));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await detalleService.deleteDetalle(Number(req.params.idDetalle));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
