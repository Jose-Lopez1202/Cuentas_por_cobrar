import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireRole } from '../auth/auth.middleware';
import type { ClientContext } from '../auth/auth.service';
import * as service from './usuarios.service';

const ctx = (req: Request): ClientContext => ({
  ip: req.ip ?? null,
  userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
});

const handle = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch(next);
};

const router = Router();

// Solo administradores (el montaje en index.ts ya exige sesión y clave no temporal).
router.use(requireRole('ADMIN'));

router.get('/', handle(async (req, res) => { res.json(await service.listar(req.query)); }));
router.get('/bitacora', handle(async (req, res) => { res.json(await service.bitacora(req.query)); }));
router.post('/', handle(async (req, res) => { res.status(201).json(await service.crear(req.body, req.auth!, ctx(req))); }));
router.patch('/:id', handle(async (req, res) => { res.json(await service.editar(Number(req.params.id), req.body, req.auth!, ctx(req))); }));
router.post('/:id/restablecer-clave', handle(async (req, res) => { res.json(await service.restablecerClave(Number(req.params.id), req.auth!, ctx(req))); }));
router.post('/:id/desbloquear', handle(async (req, res) => { res.json(await service.desbloquear(Number(req.params.id), req.auth!, ctx(req))); }));
router.post('/:id/cerrar-sesiones', handle(async (req, res) => { res.json(await service.cerrarSesiones(Number(req.params.id), req.auth!, ctx(req))); }));

export default router;
