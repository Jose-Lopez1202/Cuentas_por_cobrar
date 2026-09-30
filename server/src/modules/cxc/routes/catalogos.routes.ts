import { Router, Request, Response, NextFunction } from 'express';
import * as catalogosRepository from '../repositories/catalogos.repository';

const router = Router();

router.get('/clientes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientes = await catalogosRepository.listClientesActivos(req.query.search as string | undefined);
    res.json(clientes);
  } catch (err) {
    next(err);
  }
});

router.get('/empleados', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const empleados = await catalogosRepository.listEmpleadosActivos();
    res.json(empleados);
  } catch (err) {
    next(err);
  }
});

router.get('/clientes/:idCliente/documentos-pendientes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documentos = await catalogosRepository.listDocumentosPendientesPorCliente(Number(req.params.idCliente));
    res.json(documentos);
  } catch (err) {
    next(err);
  }
});

router.get('/clientes/:idCliente/anticipos-disponibles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const anticipos = await catalogosRepository.listAnticiposDisponiblesPorCliente(Number(req.params.idCliente));
    res.json(anticipos);
  } catch (err) {
    next(err);
  }
});


router.get('/monedas', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const monedas = await catalogosRepository.listMonedas();
    res.json(monedas);
  } catch (err) {
    next(err);
  }
});

router.get('/formas-pago', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const formasPago = await catalogosRepository.listFormasPagoActivas();
    res.json(formasPago);
  } catch (err) {
    next(err);
  }
});

router.get(
  '/notas-credito',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const notas =
        await catalogosRepository.listNotasCreditoActivas();

      res.json(notas);
    } catch (err) {
      next(err);
    }
  },
);

export default router;