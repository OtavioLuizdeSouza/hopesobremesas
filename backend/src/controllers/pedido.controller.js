import { z } from 'zod';
import { calcularFretePorEndereco, FreteServiceError } from '../services/frete.service.js';
import { criarPedido, PedidoServiceError } from '../services/pedido.service.js';

const itemSchema = z.object({
  produto_id: z.union([
    z.string().trim().min(1).max(80),
    z.number().int().positive(),
  ]),
  quantidade: z.number().int().positive().max(100),
}).strict();

const pedidoSchema = z.object({
  cliente_nome: z.string().trim().min(2).max(120),
  cliente_telefone: z.string().trim().min(8).max(30),
  itens: z.array(itemSchema).min(1).max(50),
  tipo_entrega: z.enum(['entrega', 'retirada']),
  endereco_entrega: z.string().trim().max(300).optional(),
  horario_retirada: z.string().trim().max(80).optional(),
}).strict().superRefine((pedido, context) => {
  if (pedido.tipo_entrega === 'entrega' && (!pedido.endereco_entrega || pedido.endereco_entrega.length < 5)) {
    context.addIssue({
      code: 'custom',
      path: ['endereco_entrega'],
      message: 'Informe um endereço válido para entrega.',
    });
  }
  if (pedido.tipo_entrega === 'retirada' && !pedido.horario_retirada) {
    context.addIssue({
      code: 'custom',
      path: ['horario_retirada'],
      message: 'Informe o horário de retirada.',
    });
  }
});

export async function criarPedidoController(request, response) {
  const pedidoValidado = pedidoSchema.safeParse(request.body);
  if (!pedidoValidado.success) {
    return response.status(400).json({
      error: pedidoValidado.error.issues[0]?.message ?? 'Confira os dados do pedido.',
    });
  }

  const pedido = pedidoValidado.data;
  try {
    let frete = { distanciaKm: null, valorFrete: '0.00' };
    if (pedido.tipo_entrega === 'entrega') {
      frete = await calcularFretePorEndereco(pedido.endereco_entrega);
      if (frete.status === 'erro') {
        return response.status(422).json({
          error: frete.mensagem,
          frete,
        });
      }
    }

    const registro = await criarPedido({
      clienteNome: pedido.cliente_nome,
      clienteTelefone: pedido.cliente_telefone,
      itens: pedido.itens,
      distanciaKm: frete.distanciaKm,
      valorFrete: frete.valorFrete,
      enderecoEntrega: pedido.tipo_entrega === 'entrega' ? pedido.endereco_entrega : null,
      horarioRetirada: pedido.tipo_entrega === 'retirada' ? pedido.horario_retirada : null,
      tipoEntrega: pedido.tipo_entrega,
    });
    return response.status(201).json({ ...registro, frete });
  } catch (error) {
    if (error instanceof FreteServiceError || error instanceof PedidoServiceError) {
      return response.status(error.statusCode).json({ error: error.message });
    }
    console.error('Falha inesperada ao salvar o pedido:', error);
    return response.status(500).json({ error: 'Não foi possível salvar o pedido. Tente novamente.' });
  }
}
