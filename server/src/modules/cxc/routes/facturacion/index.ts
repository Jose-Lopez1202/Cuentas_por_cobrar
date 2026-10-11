import { Router } from 'express';
import * as controller from '../../controllers/facturacion/factura.controller';

const router = Router();

// Facturación electrónica (FEL) simulada. /validar corre las reglas de la SAT
// simulada sin guardar; POST /facturas certifica y crea el documento por cobrar.
router.get('/facturas', controller.list);
router.post('/facturas/validar', controller.validar);
router.post('/facturas', controller.emitir);
router.get('/facturas/:id', controller.getOne);
router.post('/facturas/:id/anular', controller.anular);

export default router;
