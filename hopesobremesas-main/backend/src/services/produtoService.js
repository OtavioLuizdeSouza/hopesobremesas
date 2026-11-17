import { supabase } from '../config/supabase.js';
import { listarProdutos } from '../repositories/produtoRepository.js';

const TTL_MS = 2 * 60 * 1000; // 2 minutos
const INTERVALO_MS = 60 * 1000; // rede de segurança: confere o banco a cada 1 minuto
const ESPERA_MS = 1000; // junta várias alterações seguidas em uma única atualização

let cache = { dados: null, expiraEm: 0 };

// Usado pela rota /api/produtos.
export async function obterCatalogo() {
  if (cache.dados && Date.now() < cache.expiraEm) return cache.dados;

  try {
    const dados = await listarProdutos();
    cache = { dados, expiraEm: Date.now() + TTL_MS };
    return dados;
  } catch (err) {
    if (cache.dados) return cache.dados; // Supabase fora do ar: usa o último catálogo válido
    throw err;
  }
}

// ---------- Atualização do cache (substitui a sincronização do dados.json) ----------

let atualizando = false;
let novaRodadaPendente = false;
let temporizador = null;

export async function atualizarCache() {
  // Se já houver uma atualização em andamento, roda mais uma assim que ela terminar.
  if (atualizando) {
    novaRodadaPendente = true;
    return;
  }

  atualizando = true;
  try {
    const dados = await listarProdutos();

    // Proteção: tabela vazia costuma indicar RLS sem política de leitura.
    // Nesse caso o cache atual é mantido em vez de ser substituído por uma lista vazia.
    if (!dados.length) {
      console.warn('Atualização ignorada: o Supabase retornou 0 produtos. Cache mantido.');
      return;
    }

    cache = { dados, expiraEm: Date.now() + TTL_MS };
    console.log(`Catálogo atualizado em memória (${dados.length} produtos).`);
  } catch (err) {
    // Supabase fora do ar: o cache anterior continua sendo usado.
    console.error('Falha ao atualizar o catálogo (cache anterior mantido):', err.message);
  } finally {
    atualizando = false;
    if (novaRodadaPendente) {
      novaRodadaPendente = false;
      atualizarCache();
    }
  }
}

function agendarAtualizacao() {
  clearTimeout(temporizador);
  temporizador = setTimeout(atualizarCache, ESPERA_MS);
}

// Chame uma vez ao iniciar o servidor (não precisa mais de caminho de arquivo).
export function iniciarAtualizacaoDoCache() {
  // 1) Carrega o catálogo ao iniciar.
  atualizarCache();

  // 2) Atualiza em tempo real a cada INSERT, UPDATE ou DELETE na tabela produtos.
  supabase
    .channel('produtos-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, agendarAtualizacao)
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('Escutando alterações da tabela produtos (Realtime).');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`Realtime indisponível (${status}${err ? `: ${err.message}` : ''}). Usando só a verificação periódica.`);
      }
    });

  // 3) Rede de segurança: se um evento se perder ou a conexão cair, o banco é conferido de novo.
  setInterval(atualizarCache, INTERVALO_MS);
}
