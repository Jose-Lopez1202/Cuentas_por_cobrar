import type { Request, Response, NextFunction } from 'express';
import * as service from '../../services/organizacion/rutaOperacion.service';
const handle = (fn: (req: Request) => Promise<unknown>, status = 200) => async (req: Request,res: Response,next: NextFunction) => {
 try {const result=await fn(req);res.status(status).json(result ?? {ok:true});} catch(e){next(e);}
};
export const resumen=handle(req=>service.resumen(req.params.id));
export const pendientes=handle(()=>service.pendientes());
export const asignar=handle(req=>service.asignar(req.params.id,req.body),201);
export const registrar=handle(req=>service.registrar(req.params.id,req.body),201);
export const perfil=handle(req=>service.perfil(req.params.idEmpleado,req.body));

export const cobrar=handle(req=>service.cobrar(req.params.id,req.body),201);
export const pagosDisponibles=handle(()=>service.pagosDisponibles());
