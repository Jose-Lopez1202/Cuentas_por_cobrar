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

import * as fiscales from '../services/reportesFiscales.service';

export async function libroVentas(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await fiscales.getLibroVentas(req.query.anio as string | undefined, req.query.mes as string | undefined));
  } catch (e) {
    next(e);
  }
}

export async function estadisticaVentas(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await fiscales.getEstadisticaVentas(req.query.desde as string | undefined, req.query.hasta as string | undefined));
  } catch (e) {
    next(e);
  }
}

export async function estadisticaCobranza(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await fiscales.getEstadisticaCobranza(req.query.desde as string | undefined, req.query.hasta as string | undefined));
  } catch (e) {
    next(e);
  }
}
