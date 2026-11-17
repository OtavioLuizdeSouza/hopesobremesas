const WHATSAPP_NUMBER = '5511999999999';
const PRODUCTS_URL = '/api/produtos';

let products = [];
let currentCategory = null;
let cart = [];
let authMode = 'login';
let shippingMethod = 'retirada';
let shippingQuote = null;
let shippingState = 'idle';
let deliveryRequestId = 0;
let deliveryRequestController = null;
let deliveryDebounce = null;
let checkoutInProgress = false;

const grid = document.querySelector('#product-grid');
const categoryTabs = document.querySelector('.category-tabs');
const cartItems = document.querySelector('#cart-items');
const cartCount = document.querySelector('#cart-count');
const cartTitleCount = document.querySelector('#cart-title-count');
const deliveryAddressInputs = [...document.querySelectorAll('.delivery-address-input')];
const deliveryDistance = document.querySelector('#delivery-distance');
const deliveryStatus = document.querySelector('#delivery-status');
const deliveryAlert = document.querySelector('#delivery-alert');
const deliveryAlertText = document.querySelector('#delivery-alert-text');
const checkoutButton = document.querySelector('#checkout');
const checkoutError = document.querySelector('#checkout-error');
const checkoutHint = document.querySelector('#checkout-hint');

const priceFormatter = new Intl.NumberFormat('pt-BR', {
	style: 'currency',
	currency: 'BRL',
});

function escapeHtml(value) {
	return String(value ?? '').replace(/[&<>"']/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	})[character]);
}

function stockOf(product) {
	const stock = Number(product?.estoque);
	return Number.isInteger(stock) && stock > 0 ? stock : 0;
}

function formatCents(value) {
	return priceFormatter.format(value / 100);
}

function getDeliveryAddress() {
	const cep = document.querySelector('#delivery-cep').value.trim();
	const street = document.querySelector('#delivery-street').value.trim();
	const number = document.querySelector('#delivery-number').value.trim();
	const neighborhood = document.querySelector('#delivery-neighborhood').value.trim();
	const city = document.querySelector('#delivery-city').value.trim();

	if (
		cep.replace(/\D/g, '').length !== 8 ||
		![street, number, neighborhood, city].every(Boolean)
	) return '';
	return `${street}, ${number}, ${neighborhood}, ${city}, CEP ${cep}`;
}

function getVisibleProducts() {
	return products.filter((product) => (
		product.esta_disponivel &&
		(currentCategory === null ||
			String(product.categoria || '').trim() === currentCategory)
	));
}

function renderCategories() {
	const categories = [
		...new Set(
			products
				.filter((product) => product.esta_disponivel)
				.map((product) => String(product.categoria || '').trim())
				.filter(Boolean),
		),
	];

	categoryTabs
		.querySelectorAll('.tab:not([data-category=""])')
		.forEach((tab) => tab.remove());

	categories.forEach((category) => {
		const tab = document.createElement('button');
		tab.className = 'tab';
		tab.type = 'button';
		tab.dataset.category = category;
		tab.textContent = category;
		categoryTabs.append(tab);
	});
}

function getStockBadge(product) {
	const stock = stockOf(product);
	if (stock === 0) return 'Esgotado';
	return `${stock} ${stock === 1 ? 'unidade disponível' : 'unidades disponíveis'}`;
}

function renderProducts() {
	const visibleProducts = getVisibleProducts();
	if (!visibleProducts.length) {
		grid.innerHTML = '<p class="empty">Nenhum produto disponível nesta categoria.</p>';
		return;
	}

	grid.innerHTML = visibleProducts.map((product) => {
		const stock = stockOf(product);
		const productId = escapeHtml(product.id);
		return `
			<article class="product-card">
				<img class="product-image product-image-id${productId}" src="${escapeHtml(product.imagem)}" alt="${escapeHtml(product.nome)}" loading="lazy">
				<span class="product-badge">${getStockBadge(product)}</span>
				<div class="product-info">
					<h3 class="product-name">${escapeHtml(product.nome)}</h3>
					<p class="product-description">${escapeHtml(product.descricao)}</p>
					<p class="product-price">${priceFormatter.format(Number(product.preco) || 0)}</p>
					<button class="add" type="button" data-add-product="${productId}" ${stock === 0 ? 'disabled' : ''}>
						${stock === 0 ? 'Esgotado' : 'Adicionar ao carrinho'}
					</button>
				</div>
			</article>
		`;
	}).join('');
}

async function loadProducts() {
	try {
		const response = await fetch(PRODUCTS_URL);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const catalog = await response.json();
		if (!Array.isArray(catalog)) throw new Error('Resposta inválida do catálogo.');
		products = catalog;
		renderCategories();
		renderProducts();
		reconcileCartStock();
	} catch (error) {
		console.error('Erro ao carregar os produtos:', error);
		grid.innerHTML = '<p class="empty">Não foi possível carregar os produtos.</p>';
	}
}

function itemCount() {
	return cart.reduce((total, item) => total + item.quantidade, 0);
}

function subtotalCents() {
	return cart.reduce((total, item) => {
		const price = Math.round((Number(item.product.preco) || 0) * 100);
		return total + price * item.quantidade;
	}, 0);
}

function reconcileCartStock() {
	let changed = false;
	const keptItems = [];

	cart.forEach((item) => {
		const latestProduct = products.find((product) => String(product.id) === String(item.product.id));
		const availableStock = stockOf(latestProduct);
		if (!latestProduct?.esta_disponivel || availableStock < 1) {
			changed = true;
			return;
		}
		if (item.quantidade > availableStock) {
			item.quantidade = availableStock;
			changed = true;
		}
		item.product = latestProduct;
		keptItems.push(item);
	});

	cart = keptItems;
	if (changed) {
		checkoutError.textContent = 'O estoque foi atualizado. Confira as quantidades do carrinho.';
		checkoutError.hidden = false;
	} else if (checkoutError.textContent.includes('estoque foi atualizado')) {
		checkoutError.textContent = '';
		checkoutError.hidden = true;
	}
	renderCart();
}

function renderSummary() {
	const subtotal = subtotalCents();
	const shippingCost = document.querySelector('#cart-shipping-cost');
	let freightCents = 0;

	if (shippingMethod === 'retirada') {
		shippingCost.textContent = 'Grátis';
	} else if (shippingState === 'valid' && shippingQuote?.valorFrete != null) {
		freightCents = Math.round(Number(shippingQuote.valorFrete) * 100);
		shippingCost.textContent = formatCents(freightCents);
	} else {
		shippingCost.textContent = '-- (Indisponível)';
	}

	document.querySelector('#cart-subtotal').textContent = formatCents(subtotal);
	document.querySelector('#cart-total').textContent = formatCents(subtotal + freightCents);
}

function updateCheckoutState() {
	const customerName = document.querySelector('#customer-name').value.trim();
	const customerPhone = document.querySelector('#customer-phone').value.replace(/\D/g, '');
	const stockIsValid = cart.every((item) => (
		stockOf(item.product) >= item.quantidade && item.quantidade > 0
	));
	const logisticsIsValid = shippingMethod === 'retirada'
		? Boolean(document.querySelector('#pickup-time').value)
		: shippingState === 'valid';
	const canCheckout = cart.length > 0
		&& stockIsValid
		&& logisticsIsValid
		&& customerName.length >= 2
		&& customerPhone.length >= 8
		&& !checkoutInProgress;

	checkoutButton.disabled = !canCheckout;
	checkoutButton.textContent = checkoutInProgress
		? 'Salvando pedido…'
		: 'Finalizar pelo WhatsApp';
	checkoutHint.hidden = canCheckout;
}

function renderCart() {
	const count = itemCount();
	cartCount.textContent = count;
	cartTitleCount.textContent = `(${count} ${count === 1 ? 'item' : 'itens'})`;

	if (!cart.length) {
		cartItems.innerHTML = '<p class="empty">Seu carrinho está vazio.</p>';
	} else {
		cartItems.innerHTML = cart.map(({ product, quantidade }) => {
			const stock = stockOf(product);
			const priceCents = Math.round((Number(product.preco) || 0) * 100);
			const name = escapeHtml(product.nome);
			const image = escapeHtml(product.imagem || '');
			const id = escapeHtml(product.id);
			return `
				<article class="cart-item" data-product-id="${id}">
					<img src="${image}" alt="" loading="lazy">
					<div class="cart-item-content">
						<div class="cart-item-heading">
							<h3>${name}</h3>
							<button class="cart-remove" type="button" data-cart-action="remove" aria-label="Remover ${name} do carrinho">
								<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"></path></svg>
							</button>
						</div>
						<div class="cart-item-controls">
							<span class="cart-unit-price">${formatCents(priceCents)}</span>
							<div class="quantity-control" aria-label="Quantidade">
								<button type="button" data-cart-action="decrease" aria-label="Diminuir quantidade" ${quantidade <= 1 ? 'disabled' : ''}>−</button>
								<span>${quantidade}</span>
								<button type="button" data-cart-action="increase" aria-label="Aumentar quantidade" ${quantidade >= stock ? 'disabled' : ''}>+</button>
							</div>
							<strong class="cart-line-total">${formatCents(priceCents * quantidade)}</strong>
						</div>
						${quantidade >= stock ? '<span class="stock-limit">Máx. disponível</span>' : ''}
					</div>
				</article>
			`;
		}).join('');
	}

	renderSummary();
	updateCheckoutState();
}

function renderShipping() {
	const deliverySelected = shippingMethod === 'entrega';
	document.querySelector('#delivery-fields').hidden = !deliverySelected;
	document.querySelector('#pickup-fields').hidden = deliverySelected;
	deliveryAlert.hidden = !deliverySelected || shippingState !== 'error';
	deliveryDistance.hidden = !deliverySelected || shippingState !== 'valid';
	deliveryStatus.hidden = !deliverySelected
		|| !['incomplete', 'pending', 'valid'].includes(shippingState);
	renderSummary();
	updateCheckoutState();
}

function invalidateFreightRequest() {
	deliveryRequestController?.abort();
	deliveryRequestController = null;
	deliveryRequestId += 1;
}

function addProduct(productId) {
	const product = products.find((item) => String(item.id) === String(productId));
	const stock = stockOf(product);
	if (!product || !product.esta_disponivel || stock < 1) {
		checkoutError.textContent = 'Este produto está esgotado e não pode ser adicionado.';
		checkoutError.hidden = false;
		return;
	}

	const existingItem = cart.find((item) => String(item.product.id) === String(product.id));
	if (existingItem) {
		if (existingItem.quantidade >= stock) {
			checkoutError.textContent = 'Máx. disponível para este produto.';
			checkoutError.hidden = false;
			return;
		}
		existingItem.quantidade += 1;
	} else {
		cart.push({ product, quantidade: 1 });
	}
	checkoutError.textContent = '';
	checkoutError.hidden = true;
	renderCart();
}

async function calcularFreteDoEndereco() {
	const endereco = getDeliveryAddress();
	deliveryRequestController?.abort();
	deliveryRequestId += 1;
	const requestId = deliveryRequestId;
	shippingQuote = null;
	deliveryDistance.hidden = true;
	deliveryAlert.hidden = true;
	deliveryStatus.hidden = true;

	if (!endereco) {
		shippingState = 'incomplete';
		deliveryStatus.textContent = 'Preencha CEP, rua, número, bairro e cidade para calcular o frete.';
		renderShipping();
		return;
	}

	shippingState = 'pending';
	deliveryStatus.textContent = 'Calculando distância e frete…';
	deliveryStatus.hidden = false;
	deliveryRequestController = new AbortController();
	renderShipping();

	try {
		const response = await fetch('/api/frete', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ endereco }),
			signal: deliveryRequestController.signal,
		});
		const result = await response.json();
		if (requestId !== deliveryRequestId) return;

		if (result.status === 'erro' || !response.ok) {
			shippingState = 'error';
			const hasDistance = result.distanciaKm != null
				&& result.distanciaKm !== ''
				&& Number.isFinite(Number(result.distanciaKm));
			const distance = hasDistance ? Number(result.distanciaKm) : null;
			const distanceText = hasDistance
				? `Sua distância: ${distance.toFixed(1).replace('.', ',')} km. `
				: '';
			deliveryAlertText.textContent = hasDistance
				? `Fora do raio de entrega! ${result.mensagem} ${distanceText}Por favor, altere o endereço ou selecione 'Retirada'.`
				: result.mensagem || result.error || 'Não foi possível calcular o frete para este endereço.';
			deliveryStatus.hidden = true;
		} else if (Number.isFinite(Number(result.distanciaKm)) && result.valorFrete != null) {
			shippingQuote = result;
			shippingState = 'valid';
			const distancia = Number(result.distanciaKm).toFixed(1).replace('.', ',');
			deliveryDistance.textContent = `${endereco} (${distancia} km)`;
			deliveryStatus.textContent = result.status === 'alerta'
				? result.mensagem
				: 'Entrega disponível para este endereço.';
			deliveryDistance.hidden = false;
			deliveryStatus.hidden = false;
		} else {
			throw new Error(result.mensagem || 'Resposta inválida do cálculo de frete.');
		}
	} catch (error) {
		if (error.name === 'AbortError' || requestId !== deliveryRequestId) return;
		console.error('Erro ao calcular o frete:', error);
		shippingState = 'error';
		deliveryAlertText.textContent = error.message || 'Não foi possível calcular o frete. Tente novamente.';
	} finally {
		if (requestId === deliveryRequestId) renderShipping();
	}
}

function scheduleFreightCalculation() {
	clearTimeout(deliveryDebounce);
	deliveryDebounce = setTimeout(calcularFreteDoEndereco, 550);
}

async function finalizarPedido() {
	if (checkoutButton.disabled) return;
	checkoutError.textContent = '';
	checkoutError.hidden = true;
	const whatsappWindow = window.open('about:blank', '_blank');
	if (!whatsappWindow) {
		checkoutError.textContent = 'Permita a abertura de janelas para continuar pelo WhatsApp.';
		checkoutError.hidden = false;
		return;
	}
	whatsappWindow.opener = null;
	checkoutInProgress = true;
	updateCheckoutState();

	const payload = {
		cliente_nome: document.querySelector('#customer-name').value.trim(),
		cliente_telefone: document.querySelector('#customer-phone').value.trim(),
		itens: cart.map(({ product, quantidade }) => ({
			produto_id: product.id,
			quantidade,
		})),
		tipo_entrega: shippingMethod,
		...(shippingMethod === 'entrega'
			? { endereco_entrega: getDeliveryAddress() }
			: { horario_retirada: document.querySelector('#pickup-time').value }),
	};

	try {
		const response = await fetch('/api/pedidos', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload),
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o pedido.');

		const lines = result.itens.map((item) => (
			`• ${item.quantidade}x ${item.nome} — ${formatCents(Math.round(Number(item.preco_unitario) * 100))}`
		));
		const delivery = shippingMethod === 'entrega'
			? `Entrega: ${getDeliveryAddress()} (${Number(result.frete.distanciaKm).toFixed(1).replace('.', ',')} km)\nFrete: ${formatCents(Math.round(Number(result.valor_frete) * 100))}`
			: `Retirada: ${document.querySelector('#pickup-time').value}\nFrete: Grátis`;
		const message = encodeURIComponent(
			`Olá! Gostaria de confirmar o pedido #${result.id}.\n${lines.join('\n')}\n${delivery}\nSubtotal: ${formatCents(Math.round(Number(result.subtotal) * 100))}\nTotal: ${formatCents(Math.round(Number(result.total) * 100))}`,
		);
		whatsappWindow.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
		cart = [];
		renderCart();
	} catch (error) {
		whatsappWindow.close();
		console.error('Erro ao finalizar o pedido:', error);
		checkoutError.textContent = error.message || 'Não foi possível salvar o pedido. Tente novamente.';
		checkoutError.hidden = false;
		if (error.message.includes('Estoque insuficiente')) await loadProducts();
	} finally {
		checkoutInProgress = false;
		updateCheckoutState();
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

grid.addEventListener('click', (event) => {
	const button = event.target.closest('[data-add-product]');
	if (button && grid.contains(button)) addProduct(button.dataset.addProduct);
});

cartItems.addEventListener('click', (event) => {
	const button = event.target.closest('[data-cart-action]');
	if (!button) return;
	const article = button.closest('[data-product-id]');
	const item = cart.find(({ product }) => String(product.id) === article?.dataset.productId);
	if (!item) return;

	if (button.dataset.cartAction === 'remove') {
		cart = cart.filter((entry) => entry !== item);
	} else if (button.dataset.cartAction === 'decrease' && item.quantidade > 1) {
		item.quantidade -= 1;
	} else if (button.dataset.cartAction === 'increase') {
		if (item.quantidade >= stockOf(item.product)) {
			checkoutError.textContent = 'Máx. disponível para este produto.';
			checkoutError.hidden = false;
			return;
		}
		item.quantidade += 1;
	}
	renderCart();
});

document.querySelectorAll('input[name="shipping-method"]').forEach((input) => {
	input.addEventListener('change', () => {
		shippingMethod = input.value;
		shippingQuote = null;
		shippingState = 'idle';
		clearTimeout(deliveryDebounce);
		invalidateFreightRequest();
		renderShipping();
		if (shippingMethod === 'entrega') scheduleFreightCalculation();
	});
});

deliveryAddressInputs.forEach((input) => input.addEventListener('input', () => {
	invalidateFreightRequest();
	shippingQuote = null;
	shippingState = 'idle';
	if (input.id === 'delivery-cep') {
		const digits = input.value.replace(/\D/g, '').slice(0, 8);
		input.value = digits.length > 5
			? `${digits.slice(0, 5)}-${digits.slice(5)}`
			: digits;
	}
	renderShipping();
	scheduleFreightCalculation();
}));
document.querySelector('#pickup-time').addEventListener('input', updateCheckoutState);
document.querySelector('#customer-name').addEventListener('input', updateCheckoutState);
document.querySelector('#customer-phone').addEventListener('input', updateCheckoutState);

categoryTabs.addEventListener('click', (event) => {
	const tab = event.target.closest('.tab');
	if (!tab || !categoryTabs.contains(tab)) return;

	categoryTabs.querySelector('.tab.active')?.classList.remove('active');
	tab.classList.add('active');
	currentCategory = tab.dataset.category || null;
	renderProducts();
});

document.querySelector('#open-cart').addEventListener('click', openCart);
document.querySelector('#close-cart').addEventListener('click', closeCart);
document.querySelector('#overlay').addEventListener('click', closeCart);
checkoutButton.addEventListener('click', finalizarPedido);

const authDialog = document.querySelector('#auth-dialog');
const authForm = document.querySelector('#auth-form');
const authError = document.querySelector('#auth-error');
const authTitle = document.querySelector('#auth-title');
const authSubmit = document.querySelector('#auth-submit');
const authToggle = document.querySelector('#auth-toggle');

function preencherDadosDoCliente(user) {
	if (!user) return;
	const nameInput = document.querySelector('#customer-name');
	const phoneInput = document.querySelector('#customer-phone');
	if (!nameInput.value) nameInput.value = user.name || '';
	if (!phoneInput.value) phoneInput.value = user.phone || '';
	updateCheckoutState();
}

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
authToggle.addEventListener('click', () => {
	authMode = authMode === 'login' ? 'register' : 'login';
	updateAuthMode();
});
authForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	authError.textContent = '';
	const data = Object.fromEntries(new FormData(authForm));
	const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
	try {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify(data),
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || 'Não foi possível concluir.');
		document.querySelector('#open-auth').textContent = `Olá, ${result.user.name}`;
		preencherDadosDoCliente(result.user);
		authDialog.close();
	} catch (error) {
		authError.textContent = error.message;
	}
});

async function restoreSession() {
	try {
		const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
		if (!response.ok) return;
		const result = await response.json();
		document.querySelector('#open-auth').textContent = `Olá, ${result.user.name}`;
		preencherDadosDoCliente(result.user);
	} catch {
		// A página continua disponível mesmo quando a API está temporariamente indisponível.
	}
}

renderCart();
renderShipping();
loadProducts();
restoreSession();
setInterval(() => {
	if (cart.length) loadProducts();
}, 60_000);
