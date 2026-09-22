const WHATSAPP_NUMBER = '5511999999999';
const productsByCategory = {
	categoria1: [
		{ name: 'Cookie Meio Amargo', description: 'Cookie artesanal com chocolate meio amargo.', price: 'R$ --,--', image: 'frontend/assets/Cookies/CookieAmargo.jpeg' },
		{ name: 'Cookie de Kinder', description: 'Cookie recheado com o sabor irresistível de Kinder.', price: 'R$ --,--', image: 'frontend/assets/Cookies/CookiedeKinder.jpeg' },
		{ name: 'Cookie de Ninho', description: 'Cookie macio com recheio cremoso de leite Ninho.', price: 'R$ --,--', image: 'frontend/assets/Cookies/CookiedeNinho.jpeg' },
		{ name: 'Cookie de Nutella', description: 'Cookie artesanal com recheio cremoso de Nutella.', price: 'R$ --,--', image: 'frontend/assets/Cookies/CookiedeNutella.jpeg' },
		{ name: 'Cookie de Ovomaltine', description: 'Cookie com recheio cremoso e crocante de Ovomaltine.', price: 'R$ --,--', image: 'frontend/assets/Cookies/CookiedeOvomaltine.jpeg' },
		{ name: 'Cookie de Stikadinho', description: 'Cookie recheado com chocolate e sabor de morango.', price: 'R$ --,--', image: 'frontend/assets/Cookies/CookiedeStikadinho.jpeg' },
	],
	categoria2: [
		{ name: 'Brownie Supreme de Kinder', description: 'Brownie intenso com cobertura especial de Kinder.', price: 'R$ --,--', image: 'frontend/assets/BrownieSupreme/BrowniesupdeKinder.jpeg' },
		{ name: 'Brownie Supreme de Ninho com Nutella', description: 'Brownie com creme de Ninho e Nutella.', price: 'R$ --,--', image: 'frontend/assets/BrownieSupreme/BrowniesupdeNinhocomNutella.jpeg' },
		{ name: 'Brownie Supreme de Nutella', description: 'Brownie de chocolate finalizado com Nutella.', price: 'R$ --,--', image: 'frontend/assets/BrownieSupreme/BrowniesupdeNutella.jpeg' },
		{ name: 'Brownie Supreme de Ovomaltine', description: 'Brownie com cobertura cremosa e crocante de Ovomaltine.', price: 'R$ --,--', image: 'frontend/assets/BrownieSupreme/BrowniesupdeOvomaltine.jpeg' },
	],
	categoria3: [
		{ name: 'Fatia de Kinder', description: 'Fatia generosa de brownie com Kinder.', price: 'R$ --,--', image: 'frontend/assets/FatiaBrownie/FatiadeKinder.jpeg' },
		{ name: 'Fatia de Ninho com Nutella', description: 'Fatia de brownie com Ninho e Nutella.', price: 'R$ --,--', image: 'frontend/assets/FatiaBrownie/FatiadeNinhocomNutella.jpeg' },
		{ name: 'Fatia de Nutella', description: 'Fatia de brownie com cobertura de Nutella.', price: 'R$ --,--', image: 'frontend/assets/FatiaBrownie/FatiadeNutella.jpeg' },
		{ name: 'Fatia de Ovomaltine', description: 'Fatia de brownie com creme de Ovomaltine.', price: 'R$ --,--', image: 'frontend/assets/FatiaBrownie/FatiadeOvomaltine.jpeg' },
	],
	categoria4: [
		{ name: 'Afogadinho de Kinder', description: 'Brownie servido com creme especial de Kinder.', price: 'R$ --,--', image: 'frontend/assets/AfogadinhoBrownie/AfogadinhodeKinder.jpeg' },
		{ name: 'Afogadinho de Ninho', description: 'Brownie servido com creme de leite Ninho.', price: 'R$ --,--', image: 'frontend/assets/AfogadinhoBrownie/AfogadinhodeNinho.jpeg' },
		{ name: 'Afogadinho de Nutella', description: 'Brownie servido com uma camada cremosa de Nutella.', price: 'R$ --,--', image: 'frontend/assets/AfogadinhoBrownie/AfogadinhodeNutella.jpeg' },
		{ name: 'Afogadinho de Ovomaltine', description: 'Brownie servido com creme crocante de Ovomaltine.', price: 'R$ --,--', image: 'frontend/assets/AfogadinhoBrownie/AfogadinhodeOvomaltine.jpeg' },
		{ name: 'Afogadinho Meio Amargo', description: 'Brownie servido com creme de chocolate meio amargo.', price: 'R$ --,--', image: 'frontend/assets/AfogadinhoBrownie/AfogadinhoMeioAmargo.jpeg' },
	],
	categoria5: [
		{ name: 'Brownie ao Leite', description: 'Brownie tradicional, macio por dentro e com chocolate ao leite.', price: 'R$ --,--', image: 'frontend/assets/Brownie/BrownieaoLeite.jpeg' },
	],
	categoria6: [
		{ name: 'Bombom de Morango Cravejado', description: 'Morango envolvido em creme e finalizado com chocolate.', price: 'R$ --,--', image: 'frontend/assets/BombomMorango/BombomCravejado.jpeg' },
		{ name: 'Bombom de Morango Tradicional', description: 'Morango fresco, creme delicado e cobertura de chocolate.', price: 'R$ --,--', image: 'frontend/assets/BombomMorango/BombomTradicional.jpeg' },
	],
};
const products = {
	total: Object.values(productsByCategory).flat(),
	...productsByCategory,
};

let currentCategory = 'total';
let cart = [];
let authMode = 'login';
const grid = document.querySelector('#product-grid');

function getImageClass(image) {
	const fileName = image.split('/').pop().replace(/\.[^.]+$/, '');
	return `product-image-${fileName
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.toLowerCase()}`;
}

function renderProducts() {
	grid.innerHTML = products[currentCategory]
		.map(
			(product) => `
				<article class="product-card">
					<img class="product-image ${getImageClass(product.image)}" src="${product.image}" alt="${product.name}" loading="lazy">
					<div class="product-info">
						<h3 class="product-name">${product.name}</h3>
						<p class="product-description">${product.description}</p>
						<p class="product-price">${product.price}</p>
						<button class="add" type="button" disabled>
							Adicionar ao carrinho
						</button>
					</div>
				</article>
			`,
		)
		.join('');
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

renderProducts();
restoreSession();
