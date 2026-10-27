
import type { Request, Response, NextFunction } from 'express';

import * as service from '../../services/facturacion/factura.service';

import { conEmpleadoActual } from '../../../auth/empleadoActual';

// =====================================================
// LISTAR FACTURAS
// =====================================================

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const resultado = await service.listFacturas({
      page: req.query.page as string | undefined,
      limit: req.query.limit as string | undefined,
      search: req.query.search as string | undefined,
    });

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// VALIDAR FACTURA CON SAT SIMULADA
// =====================================================

export async function validar(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = await conEmpleadoActual(req);

    const resultado = await service.validarFacturaSat(input);

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// EMITIR Y CERTIFICAR FACTURA
// =====================================================

export async function emitir(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = await conEmpleadoActual(req);

    const factura = await service.emitirFactura(input);

    res.status(201).json(factura);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// OBTENER FACTURA POR ID
// =====================================================

export async function getOne(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);

    const factura = await service.getFactura(id);

    res.json(factura);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// ANULAR FACTURA
// =====================================================

export async function anular(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);

    const input = await conEmpleadoActual(
      req,
      'idEmpleadoAnulacion',
    );

    const factura = await service.anularFactura(id, input);

    res.json(factura);
  } catch (err) {
    next(err);
  }
}
