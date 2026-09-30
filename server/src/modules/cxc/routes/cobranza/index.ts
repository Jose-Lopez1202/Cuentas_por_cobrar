import { Router } from 'express';
import * as gestionCobroController from '../../controllers/cobranza/gestionCobro.controller';
import * as promesaPagoController from '../../controllers/cobranza/promesaPago.controller';
import * as convenioPagoController from '../../controllers/cobranza/convenioPago.controller';

const router = Router();

// --- Gestiones de cobro ---
router.get('/gestiones-cobro', gestionCobroController.list);
router.get('/gestiones-cobro/:id', gestionCobroController.getOne);
router.post('/gestiones-cobro', gestionCobroController.create);
router.patch('/gestiones-cobro/:id', gestionCobroController.update);
router.delete('/gestiones-cobro/:id', gestionCobroController.remove);

// --- Promesas de pago ---
router.get('/promesas-pago', promesaPagoController.list);
router.get('/promesas-pago/:id', promesaPagoController.getOne);
router.post('/promesas-pago', promesaPagoController.create);
router.patch('/promesas-pago/:id', promesaPagoController.update);
router.delete('/promesas-pago/:id', promesaPagoController.remove);

// --- Convenios de pago (las cuotas se generan automáticamente al crear) ---
router.get('/convenios-pago', convenioPagoController.list);
router.post('/convenios-pago/recalcular', convenioPagoController.recalcular);
router.get('/convenios-pago/:id', convenioPagoController.getOne);
router.post('/convenios-pago', convenioPagoController.create);
router.patch('/convenios-pago/:id', convenioPagoController.update);
router.delete('/convenios-pago/:id', convenioPagoController.remove);

// --- Cuotas y documentos de un convenio (anidados bajo el convenio) ---
router.get('/convenios-pago/:id/cuotas', convenioPagoController.listCuotas);
router.get('/convenios-pago/:id/documentos', convenioPagoController.listDocumentos);
router.post('/convenios-pago/cuotas/:idCuota/pagos', convenioPagoController.pagarCuota);

export default router;
