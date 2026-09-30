import { Request, Response, NextFunction } from 'express';
import * as historialService from '../../services/documentos/documentoHistorial.service';

export async function listByDocumento(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await historialService.listHistorial(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await historialService.createHistorial(Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await historialService.updateHistorial(Number(req.params.idHistorial), req.body));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await historialService.deleteHistorial(Number(req.params.idHistorial));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
