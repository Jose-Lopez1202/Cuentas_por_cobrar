import { Request, Response, NextFunction } from 'express';
import * as catalogosRepository from '../../repositories/documentos/catalogosDocumentos.repository';

export async function clientes(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await catalogosRepository.listClientes(req.query.search as string | undefined));
  } catch (err) {
    next(err);
  }
}

export async function tiposDocumento(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await catalogosRepository.listTiposDocumento());
  } catch (err) {
    next(err);
  }
}

export async function monedas(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await catalogosRepository.listMonedas());
  } catch (err) {
    next(err);
  }
}

export async function condicionesCredito(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await catalogosRepository.listCondicionesCredito());
  } catch (err) {
    next(err);
  }
}

export async function empleados(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await catalogosRepository.listEmpleados());
  } catch (err) {
    next(err);
  }
}

export async function documentosPorCliente(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await catalogosRepository.listDocumentosPorCliente(Number(req.params.idCliente)));
  } catch (err) {
    next(err);
  }
}
