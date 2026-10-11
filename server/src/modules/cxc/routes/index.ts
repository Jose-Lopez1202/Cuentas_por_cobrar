import { Router } from 'express';
import organizacionRoutes from './organizacion';
import cobranzaRoutes from './cobranza';
import creditoRoutes from './credito';
import catalogosRoutes from './catalogos.routes';
import dashboardRoutes from './dashboard.routes';
import reportesRoutes from './reportes.routes';
import pagosRoutes from './pagos';
import documentosRoutes from './documentos';
import facturacionRoutes from './facturacion';

const router = Router();

// Catálogos para los formularios
router.use('/catalogos', catalogosRoutes);

// Dashboard: agregaciones de solo lectura sobre todos los submódulos de CxC
router.use('/', dashboardRoutes);

// Reportes: antigüedad de saldos, estado de cuenta (solo lectura)
router.use('/', reportesRoutes);

// Cada área monta su propio sub-router aquí. Mantener el prefijo alineado
// con el nombre del área para que las rutas queden legibles:
// /api/cxc/empresas, /api/cxc/rutas, etc. (organización)
router.use('/', organizacionRoutes);

// Rutas de Cobranza
router.use('/', cobranzaRoutes);

// Rutas de Pagos
router.use('/', pagosRoutes);

// Rutas de Crédito
router.use('/', creditoRoutes);

// Rutas de Documentos
router.use('/', documentosRoutes);

// Facturación electrónica (FEL) simulada
router.use('/', facturacionRoutes);

export default router;