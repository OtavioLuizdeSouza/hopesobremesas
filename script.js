/*
  ============================================================
  HOPE SOBREMESAS - LÓGICA DO SITE (script.js)
  ============================================================
  Este arquivo é carregado no final do index.html e faz:
    1. Busca o catálogo de produtos no servidor (/api/products),
       que lê o arquivo data/products.json;
    2. Desenha os cartões de produtos na tela (renderProducts);
    3. Filtra os produtos pelas abas de categoria;
    4. Abre e fecha o carrinho lateral;
    5. Monta a mensagem do pedido e abre o WhatsApp da loja;
    6. Controla a janela de login/cadastro e conversa com a API
       do servidor (/api/auth/...).

  Para editar ou incluir produtos NÃO é preciso mexer neste arquivo:
  basta alterar data/products.json (veja as instruções no server.js).

  Ordem do arquivo:
    CONFIGURAÇÃO -> ESTADO -> PRODUTOS -> CARRINHO ->
    WHATSAPP -> LOGIN/CADASTRO -> INICIALIZAÇÃO
*/

/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */

// Número de WhatsApp da loja que vai receber os pedidos.
// Formato: código do país (55) + DDD + número, sem espaços, parênteses ou traços.
// ATENÇÃO: este é um número de exemplo; troque pelo número real da loja.
const WHATSAPP_NUMBER = '5511999999999';

/* ============================================================
   ESTADO DA PÁGINA (variáveis que mudam enquanto o cliente usa o site)
   ============================================================ */

// ALTERADO: antes, os produtos eram escritos aqui dentro (objetos productsByCategory e products).
// Agora a lista começa como null (ainda não carregada) e é preenchida pela função
// loadProducts() com os dados vindos do servidor. Cada produto tem:
// id, name, description, price (número ou null), image, category.
let products = null;

// Categoria atualmente selecionada nas abas (começa em "Todos").
// Os valores ('total', 'categoria1'...) vêm do data-category dos botões do index.html.
let currentCategory = 'total';

// Lista de itens do carrinho.
// Obs.: hoje nenhum código adiciona itens aqui (o botão "Adicionar ao carrinho"
// está desativado), então a lista fica sempre vazia.
let cart = [];

// Modo da janela de autenticação: 'login' (entrar) ou 'register' (cadastrar).
let authMode = 'login';

// Referência à <div id="product-grid"> do index.html, onde os cartões serão inseridos.
const grid = document.querySelector('#product-grid');

/* ============================================================
   PRODUTOS: CARREGAMENTO E GERAÇÃO DOS CARTÕES
   ============================================================ */

// NOVO: busca a lista de produtos no servidor e desenha na tela.
// async/await: espera a resposta do servidor sem travar a página.
async function loadProducts() {
	// Mensagem exibida enquanto os produtos não chegam.
	grid.textContent = 'Carregando produtos...';

	try {
		// Pede ao servidor a lista de produtos (rota criada no server.js).
		const response = await fetch('/api/products');

		// response.ok é false quando o servidor responde com erro (404, 500...).
		if (!response.ok) throw new Error(`Erro ${response.status}`);

		// Converte a resposta de JSON para uma lista de produtos em JavaScript.
		products = await response.json();

		// Com os dados em mãos, desenha os cartões.
		renderProducts();
	} catch (error) {
		// Falha comum: abrir o index.html direto no navegador (file://) em vez de
		// pelo servidor, ou servidor desligado.
		console.error('Erro ao carregar produtos:', error);
		grid.textContent = 'Não foi possível carregar os produtos. Tente novamente mais tarde.';
	}
}

// NOVO: transforma o preço em texto para exibir.
//   - número (ex.: 12.5)  -> "R$ 12,50" (formato de moeda brasileira)
//   - null / sem preço    -> "R$ --,--" (mesmo texto de antes)
function formatPrice(price) {
	if (typeof price !== 'number') return 'R$ --,--';
	return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// NOVO: "escapa" caracteres especiais do HTML (< > & aspas) antes de colocar textos
// do JSON dentro da página. Evita que um nome com aspas ou "<" quebre o layout
// e impede a injeção de código se os dados vierem de uma fonte externa um dia.
function escapeHTML(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

// Gera um nome de classe CSS único para a foto de cada produto, a partir
// do nome do arquivo. Isso permite ajustar o enquadramento de cada foto no style.css.
// Exemplo: 'frontend/assets/Cookies/CookieAmargo.jpeg'
//   1) .split('/').pop()          -> 'CookieAmargo.jpeg' (último pedaço do caminho)
//   2) .replace(/\.[^.]+$/, '')   -> 'CookieAmargo' (remove a extensão)
//   3) separa letra minúscula + maiúscula com '-' -> 'Cookie-Amargo'
//   4) .toLowerCase()             -> 'cookie-amargo'
//   Resultado: 'product-image-cookie-amargo'
function getImageClass(image) {
	const fileName = image.split('/').pop().replace(/\.[^.]+$/, '');
	return `product-image-${fileName
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.toLowerCase()}`;
}

// Desenha na tela os produtos da categoria atual.
function renderProducts() {
	// NOVO: se os produtos ainda não chegaram do servidor, não há o que desenhar
	// (a mensagem "Carregando produtos..." continua visível).
	if (products === null) return;

	// ALTERADO: antes o filtro era products[currentCategory] (uma lista por categoria).
	// Agora há uma lista única; "total" mostra tudo e as demais abas mostram só os produtos
	// cujo campo "category" é igual à aba escolhida.
	const visibleProducts = currentCategory === 'total'
		? products
		: products.filter((product) => product.category === currentCategory);

	// NOVO: categoria sem produtos (ou todos escondidos com "available": false).
	if (!visibleProducts.length) {
		grid.textContent = 'Nenhum produto disponível nesta categoria no momento.';
		return;
	}

	// .map() transforma cada produto em um bloco de HTML (um cartão);
	// .join('') junta todos os blocos em um único texto;
	// grid.innerHTML = ... coloca esse HTML dentro da grade (substituindo o que havia).
	// ALTERADO: os textos passam por escapeHTML() e o preço por formatPrice().
	grid.innerHTML = visibleProducts
		.map(
			(product) => `
				<article class="product-card">
					<!-- loading="lazy": a foto só carrega quando o cliente rola até ela (site mais rápido) -->
					<img class="product-image ${escapeHTML(getImageClass(product.image))}" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy">
					<div class="product-info">
						<h3 class="product-name">${escapeHTML(product.name)}</h3>
						<p class="product-description">${escapeHTML(product.description)}</p>
						<p class="product-price">${formatPrice(product.price)}</p>
						<!-- Botão desativado (disabled) por enquanto: ainda não há função de adicionar ao carrinho -->
						<button class="add" type="button" disabled>
							Adicionar ao carrinho
						</button>
					</div>
				</article>
			`,
		)
		.join('');
}

/* ============================================================
   CARRINHO: ABRIR E FECHAR
   ============================================================ */

// Abre o carrinho: a classe "show" faz o painel deslizar para dentro da tela
// e o fundo escuro (overlay) aparecer. aria-hidden="false" avisa leitores de tela
// que o carrinho agora está visível.
function openCart() {
	document.querySelector('#cart').classList.add('show');
	document.querySelector('#overlay').classList.add('show');
	document.querySelector('#cart').setAttribute('aria-hidden', 'false');
}

// Fecha o carrinho: faz o inverso da função acima.
function closeCart() {
	document.querySelector('#cart').classList.remove('show');
	document.querySelector('#overlay').classList.remove('show');
	document.querySelector('#cart').setAttribute('aria-hidden', 'true');
}

/* ============================================================
   EVENTOS DA PÁGINA (reação aos cliques do cliente)
   ============================================================ */

// Abas de categoria: para cada botão .tab, ao clicar:
//   1) remove a marca "active" da aba que estava selecionada;
//   2) marca a aba clicada como "active";
//   3) guarda a categoria escolhida (lida do data-category do botão);
//   4) redesenha os produtos já filtrados.
document.querySelectorAll('.tab').forEach((tab) =>
	tab.addEventListener('click', () => {
		document.querySelector('.tab.active').classList.remove('active');
		tab.classList.add('active');
		currentCategory = tab.dataset.category;
		renderProducts();
	}),
);

// Botão "Carrinho" do topo abre o painel.
document.querySelector('#open-cart').addEventListener('click', openCart);
// Botão "×" do carrinho fecha o painel.
document.querySelector('#close-cart').addEventListener('click', closeCart);
// Clicar no fundo escuro (fora do carrinho) também fecha o painel.
document.querySelector('#overlay').addEventListener('click', closeCart);

/* ============================================================
   FINALIZAR PEDIDO PELO WHATSAPP
   ============================================================ */

// Ao clicar em "Finalizar pelo WhatsApp":
document.querySelector('#checkout').addEventListener('click', () => {
	// Se o carrinho estiver vazio, não faz nada.
	if (!cart.length) return;

	// Monta o texto do pedido:
	//   - cada item vira uma linha "• Nome do produto" (\n = quebra de linha);
	//   - encodeURIComponent converte espaços, acentos e quebras de linha para
	//     um formato que pode ser colocado dentro de um link (URL).
	const message = encodeURIComponent(
		`Olá! Gostaria de fazer este pedido:\n${cart
			.map((item) => `• ${item.name}`)
			.join('\n')}`,
	);

	// Abre o WhatsApp (wa.me) em uma nova aba, já no número da loja e com a
	// mensagem pronta. O cliente só precisa apertar "enviar".
	window.open(
		`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`,
		'_blank',
	);
});

/* ============================================================
   LOGIN / CADASTRO
   ============================================================ */

// Atalhos para os elementos da janela de autenticação (definidos no index.html).
const authDialog = document.querySelector('#auth-dialog'); // a janela (<dialog>)
const authForm = document.querySelector('#auth-form');     // o formulário
const authError = document.querySelector('#auth-error');   // texto de erro
const authTitle = document.querySelector('#auth-title');   // título da janela
const authSubmit = document.querySelector('#auth-submit'); // botão de enviar
const authToggle = document.querySelector('#auth-toggle'); // link para trocar de modo

// Ajusta a janela conforme o modo atual (login ou cadastro):
//   - troca os textos do título e dos botões;
//   - mostra/esconde os campos "register-only" (nome, telefone, endereço);
//   - torna esses campos obrigatórios apenas no cadastro;
//   - define o tipo de autopreenchimento da senha
//     ('new-password' sugere uma senha nova; 'current-password' usa a salva).
function updateAuthMode() {
	const register = authMode === 'register';
	authTitle.textContent = register ? 'Criar conta' : 'Entrar';
	authSubmit.textContent = register ? 'Cadastrar' : 'Entrar';
	authToggle.textContent = register ? 'Já tenho uma conta' : 'Criar uma conta';
	document.querySelectorAll('.register-only').forEach((field) => {
		field.hidden = !register;
		field.querySelector('input').required = register;
	});
	authForm.elements.password.autocomplete = register ? 'new-password' : 'current-password';
}

// Botão "Entrar" do topo: limpa erros antigos, ajusta o modo e abre a janela
// no formato "modal" (escurece o resto da página).
document.querySelector('#open-auth').addEventListener('click', () => {
	authError.textContent = '';
	updateAuthMode();
	authDialog.showModal();
});

// Botão "×" fecha a janela.
document.querySelector('#close-auth').addEventListener('click', () => authDialog.close());

// Link "Criar uma conta" / "Já tenho uma conta": alterna entre login e cadastro.
authToggle.addEventListener('click', () => { authMode = authMode === 'login' ? 'register' : 'login'; updateAuthMode(); });

// Envio do formulário (async = pode "esperar" respostas do servidor com await).
authForm.addEventListener('submit', async (event) => {
	// Impede o comportamento padrão (recarregar a página).
	event.preventDefault();
	authError.textContent = '';

	// Lê todos os campos do formulário e transforma em um objeto,
	// ex.: { email: '...', name: '...', phone: '...', address: '...', password: '...' }
	const data = Object.fromEntries(new FormData(authForm));

	// Escolhe o endereço da API no servidor conforme o modo.
	const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';

	try {
		// Envia os dados ao servidor (POST em formato JSON).
		// credentials: 'same-origin' permite enviar/receber o cookie de sessão do próprio site.
		const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) });
		const result = await response.json();

		// Se o servidor respondeu com erro, "lança" uma exceção com a mensagem dele
		// (ou uma mensagem padrão), que será exibida no bloco catch abaixo.
		if (!response.ok) throw new Error(result.error || 'Não foi possível concluir.');

		// Sucesso: o botão do topo passa a mostrar "Olá, Nome" e a janela fecha.
		document.querySelector('#open-auth').textContent = `Olá, ${result.user.name}`;
		authDialog.close();
	} catch (error) { authError.textContent = error.message; } // mostra o erro na janela
});

// Ao abrir o site, verifica no servidor se o cliente já está logado
// (cookie de sessão de uma visita anterior). Se sim, mostra "Olá, Nome" no topo.
async function restoreSession() {
	try {
		const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
		// Se não houver sessão ativa, encerra silenciosamente.
		if (!response.ok) return;
		const result = await response.json();
		document.querySelector('#open-auth').textContent = `Olá, ${result.user.name}`;
	} catch {
		// A página continua disponível mesmo quando a API está temporariamente indisponível.
	}
}

/* ============================================================
   INICIALIZAÇÃO (executado assim que o script carrega)
   ============================================================ */

// ALTERADO: antes chamava renderProducts() direto, com os dados fixos no código.
// Agora carrega os produtos do servidor (que depois chama renderProducts()).
loadProducts();
// Verifica se já existe um cliente logado.
restoreSession();
