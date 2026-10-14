import { Router } from 'express';
import { getProdutos } from '../controllers/produtoController.js';

const router = Router();
router.get('/', getProdutos);

export default router;
