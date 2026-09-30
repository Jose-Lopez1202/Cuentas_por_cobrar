import { Request, Response, NextFunction } from 'express';
import * as convenioPagoService from '../../services/cobranza/convenioPago.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await convenioPagoService.listConvenios({
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
    const convenio = await convenioPagoService.getConvenio(Number(req.params.id));
    res.json(convenio);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const convenio = await convenioPagoService.createConvenio(req.body);
    res.status(201).json(convenio);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const convenio = await convenioPagoService.updateConvenio(Number(req.params.id), req.body);
    res.json(convenio);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await convenioPagoService.deleteConvenio(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function listCuotas(req: Request, res: Response, next: NextFunction) {
  try {
    const cuotas = await convenioPagoService.getCuotasDeConvenio(Number(req.params.id));
    res.json(cuotas);
  } catch (err) {
    next(err);
  }
}

export async function pagarCuota(req: Request, res: Response, next: NextFunction) {
  try {
    const cuota = await convenioPagoService.registrarPagoCuota(Number(req.params.idCuota), req.body);
    res.json(cuota);
  } catch (err) {
    next(err);
  }
}

export async function listDocumentos(req: Request, res: Response, next: NextFunction) {
  try {
    const documentos = await convenioPagoService.getDocumentosDeConvenio(Number(req.params.id));
    res.json(documentos);
  } catch (err) {
    next(err);
  }
}

export async function recalcular(_req: Request, res: Response, next: NextFunction) {
  try {
    const resultado = await convenioPagoService.recalcularConvenios();
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}
