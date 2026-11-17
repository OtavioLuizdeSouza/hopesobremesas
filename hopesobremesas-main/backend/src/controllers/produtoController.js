import { obterCatalogo } from '../services/produtoService.js';

export async function getProdutos(req, res) {
  try {
    res.json(await obterCatalogo());
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Não foi possível carregar os produtos.' });
  }
}
