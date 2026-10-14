import { readFile, writeFile, rename } from 'node:fs/promises';
import { supabase } from '../config/supabase.js';
import { listarProdutos } from '../repositories/produtoRepository.js';

const TTL_MS = 2 * 60 * 1000; // 2 minutos
const INTERVALO_MS = 60 * 1000; // rede de segurança: confere o banco a cada 1 minuto
const ESPERA_MS = 1000; // junta várias alterações seguidas em uma única sincronização

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

// ---------- Sincronização do frontend/dados.json ----------

let caminhoDados = null;
let sincronizando = false;
let novaRodadaPendente = false;
let temporizador = null;

// Grava o arquivo só se o conteúdo mudou. Escreve em um arquivo temporário e depois
// o renomeia, para o navegador nunca ler um dados.json pela metade.
async function gravarSeMudou(dados) {
  const conteudo = JSON.stringify(dados, null, 4) + '\n';

  try {
    if ((await readFile(caminhoDados, 'utf-8')) === conteudo) return false;
  } catch {
    // o arquivo ainda não existe: será criado abaixo
  }

  const temporario = `${caminhoDados}.tmp`;
  await writeFile(temporario, conteudo, 'utf-8');
  await rename(temporario, caminhoDados);
  return true;
}

export async function sincronizarDados() {
  // Se já houver uma sincronização em andamento, roda mais uma assim que ela terminar.
  if (sincronizando) {
    novaRodadaPendente = true;
    return;
  }

  sincronizando = true;
  try {
    const dados = await listarProdutos();

    // Proteção: tabela vazia costuma indicar RLS sem política de leitura.
    // Nesse caso o dados.json atual é mantido em vez de ser apagado.
    if (!dados.length) {
      console.warn('Sincronização ignorada: o Supabase retornou 0 produtos. dados.json mantido.');
      return;
    }

    cache = { dados, expiraEm: Date.now() + TTL_MS };

    if (await gravarSeMudou(dados)) {
      console.log(`dados.json atualizado (${dados.length} produtos).`);
    }
  } catch (err) {
    // Supabase fora do ar ou erro de gravação: o dados.json anterior continua intacto.
    console.error('Falha ao sincronizar dados.json (arquivo anterior mantido):', err.message);
  } finally {
    sincronizando = false;
    if (novaRodadaPendente) {
      novaRodadaPendente = false;
      sincronizarDados();
    }
  }
}

function agendarSincronizacao() {
  clearTimeout(temporizador);
  temporizador = setTimeout(sincronizarDados, ESPERA_MS);
}

// Chame uma vez ao iniciar o servidor, passando o caminho do frontend/dados.json.
export function iniciarSincronizacao(caminho) {
  caminhoDados = caminho;

  // 1) Sincroniza ao iniciar.
  sincronizarDados();

  // 2) Atualiza em tempo real a cada INSERT, UPDATE ou DELETE na tabela produtos.
  supabase
    .channel('produtos-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, agendarSincronizacao)
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('Escutando alterações da tabela produtos (Realtime).');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`Realtime indisponível (${status}${err ? `: ${err.message}` : ''}). Usando só a verificação periódica.`);
      }
    });

  // 3) Rede de segurança: se um evento se perder ou a conexão cair, o banco é conferido de novo.
  setInterval(sincronizarDados, INTERVALO_MS);
}
