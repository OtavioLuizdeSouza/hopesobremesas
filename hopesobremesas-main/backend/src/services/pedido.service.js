import { supabase } from '../config/supabase.js';

export class PedidoServiceError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function emCentavos(valor) {
  if (valor == null || valor === '') return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) return null;
  return Math.round(numero * 100);
}

export async function criarPedido({
  clienteNome,
  clienteTelefone,
  itens,
  tipoEntrega,
  enderecoEntrega,
  distanciaKm,
  valorFrete,
  horarioRetirada,
}) {
  const quantidades = new Map();
  itens.forEach((item) => {
    const id = String(item.produto_id);
    quantidades.set(id, (quantidades.get(id) ?? 0) + item.quantidade);
  });
  const ids = [...quantidades.keys()];
  const { data: produtos, error: erroProdutos } = await supabase
    .from('produtos')
    .select('id, nome, preco, estoque, esta_disponivel')
    .in('id', ids);

  if (erroProdutos) {
    console.error('Erro ao validar o estoque do pedido:', erroProdutos);
    throw new PedidoServiceError(503, 'Não foi possível confirmar o estoque agora.');
  }

  const produtosPorId = new Map((produtos ?? []).map((produto) => [String(produto.id), produto]));
  const itensDoPedido = [...quantidades].map(([id, quantidade]) => {
    const produto = produtosPorId.get(id);
    const estoque = Number(produto?.estoque);
    if (
      !produto ||
      produto.esta_disponivel === false ||
      !Number.isInteger(estoque) ||
      estoque < 1 ||
      quantidade > estoque
    ) {
      throw new PedidoServiceError(
        409,
        `Estoque insuficiente ou produto indisponível: ${produto?.nome ?? 'produto removido'}. Atualize o carrinho.`,
      );
    }

    const precoCentavos = emCentavos(produto.preco);
    if (precoCentavos === null) {
      throw new PedidoServiceError(409, `O preço de ${produto.nome} está inválido.`);
    }

    return {
      produto_id: produto.id,
      nome: produto.nome,
      quantidade,
      preco_unitario: precoCentavos,
      subtotal: precoCentavos * quantidade,
    };
  });

  const subtotalCentavos = itensDoPedido.reduce((total, item) => total + item.subtotal, 0);
  const freteCentavos = emCentavos(valorFrete);
  if (freteCentavos === null) {
    throw new PedidoServiceError(422, 'O valor do frete é inválido.');
  }

  const registroPedido = {
    cliente_nome: clienteNome,
    cliente_telefone: clienteTelefone,
    itens: itensDoPedido.map((item) => ({
      produto_id: item.produto_id,
      nome: item.nome,
      quantidade: item.quantidade,
      preco_unitario: (item.preco_unitario / 100).toFixed(2),
      subtotal: (item.subtotal / 100).toFixed(2),
      disponivel: true,
    })),
    subtotal: (subtotalCentavos / 100).toFixed(2),
    valor_frete: (freteCentavos / 100).toFixed(2),
    total: ((subtotalCentavos + freteCentavos) / 100).toFixed(2),
    tipo_entrega: tipoEntrega,
    endereco_entrega: enderecoEntrega,
    distancia_km: distanciaKm,
    horario_retirada: horarioRetirada,
    metodo_pagamento: 'WhatsApp',
    status_pagamento: 'pendente',
    status_pedido: 'pendente',
  };

  const { data: pedido, error: erroPedido } = await supabase
    .from('pedidos')
    .insert(registroPedido)
    .select('id')
    .single();

  if (erroPedido) {
    console.error('Erro ao salvar o pedido:', erroPedido);
    throw new PedidoServiceError(500, 'Não foi possível salvar o pedido. Tente novamente.');
  }

  const itensRelacionados = itensDoPedido.map((item) => ({
    pedido_id: pedido.id,
    produto_id: item.produto_id,
    quantidade: item.quantidade,
    preco_unitario: (item.preco_unitario / 100).toFixed(2),
    subtotal: (item.subtotal / 100).toFixed(2),
  }));
  const { error: erroItens } = await supabase
    .from('pedido_itens')
    .insert(itensRelacionados);

  if (erroItens) {
    console.error('Erro ao salvar os itens do pedido:', erroItens);
    const { error: erroRemocao } = await supabase
      .from('pedidos')
      .delete()
      .eq('id', pedido.id);
    if (erroRemocao) {
      console.error('Não foi possível remover o pedido incompleto:', erroRemocao);
    }
    throw new PedidoServiceError(500, 'Não foi possível salvar os itens do pedido. Tente novamente.');
  }

  return {
    id: pedido.id,
    subtotal: (subtotalCentavos / 100).toFixed(2),
    valor_frete: (freteCentavos / 100).toFixed(2),
    total: ((subtotalCentavos + freteCentavos) / 100).toFixed(2),
    itens: itensDoPedido.map((item) => ({
      produto_id: item.produto_id,
      nome: item.nome,
      quantidade: item.quantidade,
      preco_unitario: (item.preco_unitario / 100).toFixed(2),
      subtotal: (item.subtotal / 100).toFixed(2),
    })),
  };
}
