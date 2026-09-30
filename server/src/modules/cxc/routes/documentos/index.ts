import { Router } from 'express';
import * as documentoController from '../../controllers/documentos/documento.controller';
import * as tipoDocumentoController from '../../controllers/documentos/tipoDocumento.controller';
import * as detalleController from '../../controllers/documentos/documentoDetalle.controller';
import * as historialController from '../../controllers/documentos/documentoHistorial.controller';
import * as ajusteController from '../../controllers/documentos/ajuste.controller';
import * as catalogosController from '../../controllers/documentos/catalogosDocumentos.controller';

const router = Router();

// --- Catálogos de solo lectura para formularios de Documentos ---
router.get('/documentos/catalogos/clientes', catalogosController.clientes);
router.get('/documentos/catalogos/tipos-documento', catalogosController.tiposDocumento);
router.get('/documentos/catalogos/monedas', catalogosController.monedas);
router.get('/documentos/catalogos/condiciones-credito', catalogosController.condicionesCredito);
router.get('/documentos/catalogos/empleados', catalogosController.empleados);
router.get('/documentos/catalogos/clientes/:idCliente/documentos', catalogosController.documentosPorCliente);

// --- CXC_DOCUMENTOS ---
router.get('/documentos', documentoController.list);
router.get('/documentos/:id', documentoController.getOne);
router.post('/documentos', documentoController.create);
router.patch('/documentos/:id', documentoController.update);
router.delete('/documentos/:id', documentoController.remove);
router.post('/documentos/:id/anular', documentoController.anular);

// --- CXC_DOCUMENTO_DETALLE (anidado al documento) ---
router.get('/documentos/:id/detalles', detalleController.listByDocumento);
router.post('/documentos/:id/detalles', detalleController.create);
router.patch('/documentos/detalles/:idDetalle', detalleController.update);
router.delete('/documentos/detalles/:idDetalle', detalleController.remove);

// --- CXC_DOCUMENTO_HISTORIAL (anidado al documento) ---
router.get('/documentos/:id/historial', historialController.listByDocumento);
router.post('/documentos/:id/historial', historialController.create);
router.patch('/documentos/historial/:idHistorial', historialController.update);
router.delete('/documentos/historial/:idHistorial', historialController.remove);

// --- CXC_TIPOS_DOCUMENTO ---
router.get('/tipos-documento', tipoDocumentoController.list);
router.get('/tipos-documento/:id', tipoDocumentoController.getOne);
router.post('/tipos-documento', tipoDocumentoController.create);
router.patch('/tipos-documento/:id', tipoDocumentoController.update);
router.delete('/tipos-documento/:id', tipoDocumentoController.remove);

// --- CXC_AJUSTES ---
router.get('/ajustes', ajusteController.list);
router.get('/ajustes/:id', ajusteController.getOne);
router.post('/ajustes', ajusteController.create);
router.patch('/ajustes/:id', ajusteController.update);
router.delete('/ajustes/:id', ajusteController.remove);
router.post('/ajustes/:id/aprobar', ajusteController.aprobar);
router.post('/ajustes/:id/rechazar', ajusteController.rechazar);

export default router;
