/*
  ============================================================
  SERVIDOR (BACK-END) - HOPE SOBREMESAS (server.js)
  ============================================================
  O que este arquivo faz:
    1. Entrega o site (index.html e a pasta frontend/);
    2. Oferece a rota GET /api/products, que lê o arquivo
       data/products.json e devolve os produtos para o script.js;
    3. Deixa as rotas /api/auth/... respondendo com um aviso claro
       enquanto o login/cadastro ainda não foi implementado.

  Como usar (no terminal, dentro da pasta do projeto):
    npm init -y            -> cria o package.json (só na primeira vez)
    npm install express    -> instala o Express (só na primeira vez)
    node server.js         -> inicia o servidor
  Depois, abra no navegador:  http://localhost:4000

  ------------------------------------------------------------
  COMO EDITAR OS PRODUTOS (arquivo data/products.json)
  ------------------------------------------------------------
  Cada produto é um bloco { ... } dentro da lista "products":

    {
      "id": "cookie-nutella",          -> identificador ÚNICO (sem espaços ou acentos)
      "name": "Cookie de Nutella",     -> nome exibido no cartão
      "description": "Texto...",       -> descrição exibida no cartão
      "price": 12.5,                   -> preço como NÚMERO, com ponto e sem aspas
                                          (use null para exibir "R$ --,--")
      "image": "frontend/assets/...",  -> caminho da foto do produto
      "category": "categoria1",        -> categoria (mesmo valor do data-category das abas)
      "available": true                -> false esconde o produto do site sem apagá-lo
    }

  Para ADICIONAR um produto: copie um bloco, cole logo após outro (com vírgula entre
  eles) e altere os campos. Para EDITAR: altere o valor desejado. Depois é só
  recarregar a página: o servidor lê o arquivo a cada pedido, então NÃO precisa reiniciar.

  Cuidados com o JSON: use sempre aspas duplas ("), não deixe vírgula após o último
  item de uma lista ou bloco, e não coloque comentários dentro do arquivo.

  Categorias (ligadas às abas do index.html):
    categoria1 = Cookies                  categoria4 = Afogadinho de Brownie
    categoria2 = Brownie Supreme          categoria5 = Brownie Tradicional
    categoria3 = Fatia de Brownie         categoria6 = Bombom de Morango
*/

// Importa o Express (biblioteca que facilita criar servidores web em Node.js).
const express = require('express');

// Módulo nativo do Node para montar caminhos de pasta de forma segura (Windows, Linux e Mac).
const path = require('path');

// Módulo nativo do Node para ler arquivos; a versão "promises" permite usar async/await.
const fs = require('fs/promises');

// Cria a aplicação (o servidor em si).
const app = express();

// Porta do servidor. Usa a porta definida pelo ambiente (útil em hospedagens)
// e, se não houver, usa a 4000.
const port = process.env.PORT || 4000;

// Caminho completo do arquivo com os produtos.
// __dirname = pasta onde este server.js está, então funciona de qualquer diretório.
const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');

// Permite que o servidor entenda dados JSON no corpo de requisições (rotas POST/PUT).
// Será útil quando o login e o envio de pedidos forem implementados.
app.use(express.json());

/* ============================================================
   ARQUIVOS DO SITE
   ============================================================ */

// Serve SOMENTE a pasta frontend (CSS, JavaScript, imagens) no endereço /frontend.
// Assim, o server.js e a pasta data/ não ficam expostos publicamente.
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));

// Ao abrir http://localhost:4000, entrega o index.html.
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'index.html'));
});

/* ============================================================
   API DE PRODUTOS
   ============================================================ */

// Confere se um produto tem os campos essenciais e retorna um aviso (texto)
// descrevendo o problema, ou null se estiver tudo certo.
// Serve para o dono do site perceber rapidamente um erro ao editar o JSON.
function getProductProblem(product) {
	if (!product || typeof product !== 'object') return 'item inválido (não é um bloco { ... })';
	if (!product.id) return 'falta o campo "id"';
	if (!product.name) return 'falta o campo "name"';
	if (!product.image) return 'falta o campo "image"';
	if (!product.category) return 'falta o campo "category"';
	if (product.price !== null && typeof product.price !== 'number') {
		return 'o campo "price" deve ser um número (ex.: 12.5, sem aspas) ou null';
	}
	return null;
}

// Rota GET /api/products: devolve a lista de produtos disponíveis.
app.get('/api/products', async (req, res) => {
	try {
		// Lê o arquivo a cada pedido: assim, editar o JSON não exige reiniciar o servidor.
		const raw = await fs.readFile(PRODUCTS_FILE, 'utf8');

		// Converte o texto JSON em objeto JavaScript.
		// Se o arquivo tiver um erro de sintaxe (vírgula sobrando, aspas faltando...),
		// o JSON.parse lança um erro, tratado no catch abaixo.
		const { products } = JSON.parse(raw);

		if (!Array.isArray(products)) {
			throw new Error('O arquivo products.json precisa ter uma lista chamada "products".');
		}

		const ids = new Set(); // guarda os ids já vistos para detectar repetições
		const valid = [];

		products.forEach((product, index) => {
			// Produto com campo faltando ou inválido: avisa no terminal e não envia ao site.
			const problem = getProductProblem(product);
			if (problem) {
				console.warn(`[products.json] Produto nº ${index + 1} ignorado: ${problem}.`);
				return;
			}

			// Id repetido: avisa no terminal e ignora a repetição.
			if (ids.has(product.id)) {
				console.warn(`[products.json] Produto nº ${index + 1} ignorado: id "${product.id}" repetido.`);
				return;
			}
			ids.add(product.id);

			// "available": false esconde o produto do site (sem aviso, é intencional).
			if (product.available === false) return;

			valid.push(product);
		});

		// no-store: pede ao navegador para não guardar uma cópia antiga da lista,
		// garantindo que mudanças no JSON apareçam ao recarregar a página.
		res.set('Cache-Control', 'no-store');
		res.json(valid);
	} catch (error) {
		// Detalhes técnicos ficam no terminal; o navegador recebe só uma mensagem genérica.
		console.error('Erro ao carregar products.json:', error.message);
		res.status(500).json({ error: 'Não foi possível carregar os produtos.' });
	}
});

/* ============================================================
   LOGIN / CADASTRO (ainda não implementado)
   ============================================================ */

// O script.js chama /api/auth/login, /api/auth/register e /api/auth/me.
// Enquanto essas rotas não existem, respondemos com JSON e status 501 ("não implementado"),
// para a janela de login mostrar uma mensagem clara em vez de um erro confuso.
app.use('/api/auth', (req, res) => {
	res.status(501).json({ error: 'Login e cadastro ainda não estão disponíveis.' });
});

/* ============================================================
   INICIAR O SERVIDOR
   ============================================================ */

// Liga o servidor e fica aguardando pedidos. A mensagem aparece no terminal.
app.listen(port, () => {
	console.log(`Servidor rodando em http://localhost:${port}`);
});
