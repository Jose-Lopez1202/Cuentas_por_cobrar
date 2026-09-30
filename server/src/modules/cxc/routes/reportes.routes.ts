import { Router } from 'express';
import * as controller from '../controllers/reportes.controller';

const router = Router();

router.get('/reportes/antiguedad-saldos', controller.antiguedadSaldos);
router.get('/reportes/estado-cuenta/:idCliente', controller.estadoCuenta);

export default router;
