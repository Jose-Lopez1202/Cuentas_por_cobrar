import { Request, Response, NextFunction } from 'express';
import * as tipoDocumentoService from '../../services/documentos/tipoDocumento.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await tipoDocumentoService.listTiposDocumento({
      page: req.query.page as string | undefined,
      limit: req.query.limit as string | undefined,
      search: req.query.search as string | undefined,
    }));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await tipoDocumentoService.getTipoDocumento(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await tipoDocumentoService.createTipoDocumento(req.body));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await tipoDocumentoService.updateTipoDocumento(Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await tipoDocumentoService.deleteTipoDocumento(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
