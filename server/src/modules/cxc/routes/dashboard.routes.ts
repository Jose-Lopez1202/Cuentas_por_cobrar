import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';

const router = Router();

router.get('/dashboard/resumen', dashboardController.getResumen);

export default router;
