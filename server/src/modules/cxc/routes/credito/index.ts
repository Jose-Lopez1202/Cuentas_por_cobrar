import { Router } from 'express';
import * as condicionCreditoController from '../../controllers/credito/condicionCredito.controller';
import * as notaCreditoController from '../../controllers/credito/notaCredito.controller';
import * as aplicacionNotaCreditoController from '../../controllers/credito/aplicacionNotaCredito.controller';
import * as moraController from '../../controllers/credito/mora.controller';

const router = Router();

// --- Condiciones de crédito ---
router.get('/condiciones-credito', condicionCreditoController.list);
router.get('/condiciones-credito/:id', condicionCreditoController.getOne);
router.post('/condiciones-credito', condicionCreditoController.create);
router.patch('/condiciones-credito/:id', condicionCreditoController.update);
router.delete('/condiciones-credito/:id', condicionCreditoController.remove);

router.get('/notas-credito', notaCreditoController.list);
router.get('/notas-credito/:id', notaCreditoController.getOne);
router.post('/notas-credito', notaCreditoController.create);
router.patch('/notas-credito/:id', notaCreditoController.update);
router.delete('/notas-credito/:id', notaCreditoController.remove);
router.post('/notas-credito/:id/anular', notaCreditoController.anular);

router.get(
  '/aplicaciones-nota-credito',
  aplicacionNotaCreditoController.list,
);

router.get(
  '/aplicaciones-nota-credito/:id',
  aplicacionNotaCreditoController.getOne,
);

router.post(
  '/aplicaciones-nota-credito',
  aplicacionNotaCreditoController.create,
);

router.patch(
  '/aplicaciones-nota-credito/:id',
  aplicacionNotaCreditoController.update,
);

router.delete(
  '/aplicaciones-nota-credito/:id',
  aplicacionNotaCreditoController.remove,
);

router.post(
  '/aplicaciones-nota-credito/:id/reversar',
  aplicacionNotaCreditoController.reversar,
);



router.post('/mora/recalcular', moraController.recalcular);
router.get('/mora', moraController.list);
router.get('/mora/:id', moraController.getOne);
router.post('/mora', moraController.create);
router.patch('/mora/:id', moraController.update);
router.delete('/mora/:id', moraController.remove);


export default router;  