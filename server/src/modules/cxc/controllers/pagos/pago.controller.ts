import {Request,Response,NextFunction} from 'express'; import * as service from '../../services/pagos/pago.service';
export async function list(req:Request,res:Response,next:NextFunction){try{res.json(await service.listPagos({page:req.query.page as string|undefined,limit:req.query.limit as string|undefined,search:req.query.search as string|undefined}));}catch(e){next(e);}}
export async function getOne(req:Request,res:Response,next:NextFunction){try{res.json(await service.getPago(Number(req.params.id)));}catch(e){next(e);}}
export async function create(req:Request,res:Response,next:NextFunction){try{res.status(201).json(await service.createPago(req.body));}catch(e){next(e);}}
export async function update(req:Request,res:Response,next:NextFunction){try{res.json(await service.updatePago(Number(req.params.id),req.body));}catch(e){next(e);}}
export async function remove(req:Request,res:Response,next:NextFunction){try{await service.deletePago(Number(req.params.id));res.status(204).send();}catch(e){next(e);}}
export async function anular(req:Request,res:Response,next:NextFunction){try{res.json(await service.anularPago(Number(req.params.id),req.body));}catch(e){next(e);}}
