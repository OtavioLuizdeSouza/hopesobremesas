import { Router } from 'express';
import { criarPedidoController } from '../controllers/pedido.controller.js';

const router = Router();
router.post('/', criarPedidoController);

export default router;
