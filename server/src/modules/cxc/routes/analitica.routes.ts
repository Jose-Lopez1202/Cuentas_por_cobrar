import { Router } from 'express';
import * as c from '../controllers/analitica.controller';

const router = Router();

// Análisis de cobranza (solo lectura). Todos aceptan ?desde=&hasta=&idEmpleado=&idRuta=
router.get('/analitica/filtros', c.filtros);
router.get('/analitica/resumen', c.resumen);
router.get('/analitica/cobradores', c.cobradores);
router.get('/analitica/cobradores/:id', c.cobradorDetalle);
router.get('/analitica/dias-cobro', c.diasCobro);
router.get('/analitica/dias-cobro/detalle', c.diasCobroDetalle);
router.get('/analitica/rutas', c.rutas);
router.get('/analitica/rutas/detalle', c.rutaDetalle);
router.get('/analitica/clientes-riesgo', c.clientesRiesgo);
router.get('/analitica/clientes/:idCliente', c.cliente360);

export default router;
