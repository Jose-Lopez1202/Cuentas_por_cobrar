import { Router } from 'express';
import * as pago from '../../controllers/pagos/pago.controller';
import * as aplicacion from '../../controllers/pagos/aplicacionPago.controller';
import * as anticipo from '../../controllers/pagos/anticipo.controller';
import * as aplicacionAnticipo from '../../controllers/pagos/aplicacionAnticipo.controller';
import * as recibo from '../../controllers/pagos/recibo.controller';
import * as forma from '../../controllers/pagos/formaPago.controller';
import * as formaRepo from '../../repositories/pagos/formaPago.repository';
import * as pagoRepo from '../../repositories/pagos/pago.repository';
import * as catalogosRepository from '../../repositories/catalogos.repository';
const router=Router();
for (const [path,c] of [['/pagos',pago],['/aplicaciones-pago',aplicacion],['/anticipos',anticipo],['/aplicaciones-anticipo',aplicacionAnticipo],['/recibos',recibo],['/formas-pago',forma]] as const){router.get(path,c.list);router.get(`${path}/:id`,c.getOne);router.post(path,c.create);router.patch(`${path}/:id`,c.update);router.delete(`${path}/:id`,c.remove);}
router.post('/pagos/:id/anular', pago.anular);
router.post('/anticipos/:id/anular', anticipo.anular);
router.post('/aplicaciones-pago/:id/reversar', aplicacion.reversar);
router.post('/aplicaciones-anticipo/:id/reversar', aplicacionAnticipo.reversar);
router.get('/catalogos/pagos', async (req, res, next) => {
  try {
    const rawIdCliente = req.query.idCliente;
    const idCliente = rawIdCliente ? Number(rawIdCliente) : undefined;
    if (rawIdCliente && (!Number.isInteger(idCliente) || (idCliente as number) <= 0)) {
      return res.status(400).json({ message: 'idCliente debe ser un entero positivo' });
    }
    res.json(await pagoRepo.listOptions(idCliente));
  } catch (e) {
    next(e);
  }
});
router.get('/catalogos/formas-pago', async (_req,res,next)=>{try{res.json(await formaRepo.listActivas());}catch(e){next(e);}});
router.get('/catalogos/bancos', async (_req,res,next)=>{try{res.json(await catalogosRepository.listBancosActivos());}catch(e){next(e);}});
export default router;
