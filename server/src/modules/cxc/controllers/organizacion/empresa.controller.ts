import { Request, Response, NextFunction } from 'express';
import * as empresaService from '../../services/organizacion/empresa.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await empresaService.listEmpresas({
      page: req.query.page as string | undefined,
      limit: req.query.limit as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function options(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await empresaService.listEmpresaOptions();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const empresa = await empresaService.getEmpresa(Number(req.params.id));
    res.json(empresa);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const empresa = await empresaService.createEmpresa(req.body);
    res.status(201).json(empresa);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const empresa = await empresaService.updateEmpresa(Number(req.params.id), req.body);
    res.json(empresa);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await empresaService.deleteEmpresa(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
