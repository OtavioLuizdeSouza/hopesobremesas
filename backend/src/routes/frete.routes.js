import { Router } from 'express';
import { calcularFreteController } from '../controllers/frete.controller.js';

const router = Router();
router.post('/', calcularFreteController);

export default router;
