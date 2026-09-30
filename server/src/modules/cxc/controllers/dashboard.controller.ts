import type { Request, Response, NextFunction } from 'express';
import * as service from '../services/dashboard.service';

export async function getResumen(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.getResumen());
  } catch (error) {
    next(error);
  }
}
