import { Router } from 'express';
import * as controller from './auth.controller';
import { requireAuth, requireTrustedOrigin } from './auth.middleware';

const router = Router();

router.post('/login', requireTrustedOrigin, controller.login);
router.post('/refresh', requireTrustedOrigin, controller.refresh);
router.post('/logout', requireTrustedOrigin, controller.logout);
router.get('/me', requireAuth, controller.me);
router.post('/cambiar-clave', requireTrustedOrigin, requireAuth, controller.cambiarClave);
router.post('/recuperar', requireTrustedOrigin, controller.recuperarSolicitar);
router.post('/recuperar/verificar', requireTrustedOrigin, controller.recuperarVerificar);
router.post('/recuperar/restablecer', requireTrustedOrigin, controller.recuperarRestablecer);

export default router;
