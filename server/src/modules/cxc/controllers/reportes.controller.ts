import { Request, Response, NextFunction } from 'express';
import * as service from '../services/reportes.service';

export async function antiguedadSaldos(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.getAntiguedadSaldos());
  } catch (e) {
    next(e);
  }
}

export async function estadoCuenta(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.getEstadoCuenta(Number(req.params.idCliente)));
  } catch (e) {
    next(e);
  }
}
