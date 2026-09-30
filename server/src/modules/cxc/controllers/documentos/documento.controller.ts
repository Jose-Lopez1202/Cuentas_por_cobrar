import { Request, Response, NextFunction } from 'express';
import * as documentoService from '../../services/documentos/documento.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await documentoService.listDocumentos({
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
    res.json(await documentoService.getDocumento(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await documentoService.createDocumento(req.body));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await documentoService.updateDocumento(Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await documentoService.deleteDocumento(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function anular(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await documentoService.anularDocumento(Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
}
