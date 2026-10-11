import { Request, Response, NextFunction } from 'express';
import * as service from '../../services/facturacion/factura.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listFacturas({
      page: req.query.page as string | undefined,
      limit: req.query.limit as string | undefined,
      search: req.query.search as string | undefined,
    }));
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.getFactura(Number(req.params.id))); } catch (err) { next(err); }
}

export async function validar(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.validarFacturaSat(req.body)); } catch (err) { next(err); }
}

export async function emitir(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.emitirFactura(req.body)); } catch (err) { next(err); }
}

export async function anular(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.anularFactura(Number(req.params.id), req.body)); } catch (err) { next(err); }
}
