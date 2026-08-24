const WHATSAPP_NUMBER = '5511999999999';
const emptyProducts = () =>
	Array.from({ length: 6 }, () => ({ name: '', image: '' }));
const products = {
	categoria1: emptyProducts(),
	categoria2: emptyProducts(),
	categoria3: emptyProducts(),
	categoria4: emptyProducts(),
};

let currentCategory = 'categoria1';
let cart = [];
const grid = document.querySelector('#product-grid');

function renderProducts() {
	grid.innerHTML = products[currentCategory]
		.map(
			(_, index) => `
				<article class="product-card">
					<div
						class="image-space product-placeholder"
						aria-label="Espaço para imagem do produto ${index + 1}"
					>
						<span>IMAGEM DO PRODUTO</span>
					</div>
					<div class="product-info">
						<div
							class="product-name-space"
							aria-label="Espaço para nome do produto"
						></div>
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

renderProducts();
