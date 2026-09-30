import { createFormaPagoSchema, updateFormaPagoSchema, buildPaginationMeta, type PaginatedResponse, type FormaPago } from '@erp/contracts';
import * as repository from '../../repositories/pagos/formaPago.repository';
import { NotFoundError } from '../../../../shared/errors/AppError';
export async function listFormasPago(q:{page?:string;limit?:string;search?:string}):Promise<PaginatedResponse<FormaPago>>{const page=Math.max(1,Number(q.page)||1);const limit=Math.min(100,Math.max(1,Number(q.limit)||20));const {data,total}=await repository.findAll({page,limit,search:q.search});return{data,meta:buildPaginationMeta(total,page,limit)};}
export async function getFormaPago(id:number):Promise<FormaPago>{const item=await repository.findById(id);if(!item)throw new NotFoundError('FormaPago '+id+' no encontrado');return item;}
export async function createFormaPago(raw:unknown):Promise<FormaPago>{const input=createFormaPagoSchema.parse(raw);const id=await repository.create(input);return getFormaPago(id);}
export async function updateFormaPago(id:number,raw:unknown):Promise<FormaPago>{const input=updateFormaPagoSchema.parse(raw);await getFormaPago(id);await repository.update(id,input);return getFormaPago(id);}
export async function deleteFormaPago(id:number):Promise<void>{await getFormaPago(id);await repository.remove(id);}
