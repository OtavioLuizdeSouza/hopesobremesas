import { z } from 'zod';
import {
  calcularFrete,
  calcularFretePorEndereco,
  FreteServiceError,
} from '../services/frete.service.js';

const coordenadasSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
}).strict();
const enderecoSchema = z.object({
  endereco: z.string().trim().min(5).max(300),
}).strict();
const destinoSchema = z.union([coordenadasSchema, enderecoSchema]);

function respostaErro(mensagem) {
  return {
    status: 'erro',
    distanciaKm: null,
    tempoMin: null,
    valorFrete: null,
    mensagem,
  };
}

export async function calcularFreteController(request, response) {
  const destino = destinoSchema.safeParse(request.body);
  if (!destino.success) {
    return response.status(400).json(
      respostaErro('Informe latitude e longitude válidas para o endereço de entrega.'),
    );
  }

  try {
    const resultado = 'endereco' in destino.data
      ? await calcularFretePorEndereco(destino.data.endereco)
      : await calcularFrete(destino.data);
    return response.status(resultado.status === 'erro' ? 422 : 200).json(resultado);
  } catch (error) {
    if (error instanceof FreteServiceError) {
      return response.status(error.statusCode).json(error.body);
    }
    console.error('Falha inesperada ao calcular o frete:', error);
    return response.status(500).json(
      respostaErro('Não foi possível calcular o frete agora. Tente novamente mais tarde.'),
    );
  }
}
