const WHATSAPP_NUMBER = '5511999999999';

// Caminho do arquivo de produtos (relativo ao index.html).
const PRODUCTS_URL = 'frontend/dados.json';

// Liga o data-category das abas (index.html) ao campo "categoria" da api produtos.
const CATEGORY_MAP = {
	categoria1: 'Cookie',
	categoria2: 'Supreme',
	categoria3: 'Brownie',
	categoria4: 'Afogadinho',
	categoria5: 'BrownieT',
	categoria6: 'Bombom',
};

let products = [];
let currentCategory = 'total';
let cart = [];
let authMode = 'login';
const grid = document.querySelector('#product-grid');

const priceFormatter = new Intl.NumberFormat('pt-BR', {
	style: 'currency',
	currency: 'BRL',
});

// Retorna só os produtos disponíveis da categoria selecionada.
function getVisibleProducts() {
	return products.filter((product) => {
		if (!product.esta_disponivel) return false;
		return (
			currentCategory === 'total' ||
			product.categoria === CATEGORY_MAP[currentCategory]
		);
	});
}

function renderProducts() {
	const visibleProducts = getVisibleProducts();

	if (!visibleProducts.length) {
		grid.innerHTML =
			'<p class="empty">Nenhum produto disponível nesta categoria.</p>';
		return;
	}

	grid.innerHTML = visibleProducts
		.map(
			(product) => `
				<article class="product-card">
					<img class="product-image product-image-id${product.id}" src="${product.imagem}" alt="${product.nome}" loading="lazy">
					<div class="product-info">
						<h3 class="product-name">${product.nome}</h3>
						<p class="product-description">${product.descricao}</p>
						<p class="product-price">${priceFormatter.format(product.preco)}</p>
						<button class="add" type="button" disabled>
							Adicionar ao carrinho
						</button>
					</div>
				</article>
			`,
		)
		.join('');
}

async function loadProducts() {
	try {
		const response = await fetch(PRODUCTS_URL);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		products = await response.json();
		renderProducts();
	} catch (error) {
		console.error('Erro ao carregar os produtos:', error);
		grid.innerHTML =
			'<p class="empty">Não foi possível carregar os produtos.</p>';
	}
}

function openCart() {
	document.querySelector('#cart').classList.add('show');
	document.querySelector('#overlay').classList.add('show');
	document.querySelector('#cart').setAttribute('aria-hidden', 'false');
}

function closeCart() {
	document.querySelector('#cart').classList.remove('show');
	document.querySelector('#overlay').classList.remove('show');
	document.querySelector('#cart').setAttribute('aria-hidden', 'true');
}

document.querySelectorAll('.tab').forEach((tab) =>
	tab.addEventListener('click', () => {
		document.querySelector('.tab.active').classList.remove('active');
		tab.classList.add('active');
		currentCategory = tab.dataset.category;
		renderProducts();
	}),
);

document.querySelector('#open-cart').addEventListener('click', openCart);
document.querySelector('#close-cart').addEventListener('click', closeCart);
document.querySelector('#overlay').addEventListener('click', closeCart);
document.querySelector('#checkout').addEventListener('click', () => {
	if (!cart.length) return;

	const message = encodeURIComponent(
		`Olá! Gostaria de fazer este pedido:\n${cart
			.map((item) => `• ${item.name}`)
			.join('\n')}`,
	);

	window.open(
		`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`,
		'_blank',
	);
});

const authDialog = document.querySelector('#auth-dialog');
const authForm = document.querySelector('#auth-form');
const authError = document.querySelector('#auth-error');
const authTitle = document.querySelector('#auth-title');
const authSubmit = document.querySelector('#auth-submit');
const authToggle = document.querySelector('#auth-toggle');

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

document.querySelector('#open-auth').addEventListener('click', () => {
	authError.textContent = '';
	updateAuthMode();
	authDialog.showModal();
});
document.querySelector('#close-auth').addEventListener('click', () => authDialog.close());
authToggle.addEventListener('click', () => { authMode = authMode === 'login' ? 'register' : 'login'; updateAuthMode(); });
authForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	authError.textContent = '';
	const data = Object.fromEntries(new FormData(authForm));
	const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
	try {
		const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || 'Não foi possível concluir.');
		document.querySelector('#open-auth').textContent = `Olá, ${result.user.name}`;
		authDialog.close();
	} catch (error) { authError.textContent = error.message; }
});

async function restoreSession() {
	try {
		const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
		if (!response.ok) return;
		const result = await response.json();
		document.querySelector('#open-auth').textContent = `Olá, ${result.user.name}`;
	} catch {
		// A página continua disponível mesmo quando a API está temporariamente indisponível.
	}
}

loadProducts();
restoreSession();
