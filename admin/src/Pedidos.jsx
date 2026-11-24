import { useEffect, useMemo, useState } from 'react'
import { atualizarStatusPedido, buscarPedidos } from './funcoes'
import adminProfileIcon from './assets/admin-profile.svg'
import pedidosFavicon from './assets/pedidos.svg'
import './Pedidos.css'

const filtros = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'verificado', label: 'Verificados' },
  { id: 'cancelado', label: 'Cancelados' }
]

const statusLabel = {
  pendente: 'Pendente',
  verificado: 'Verificado',
  cancelado: 'Cancelado'
}

const moeda = valor => {
  if (valor == null || valor === '' || !Number.isFinite(Number(valor))) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(valor))
}

const textoSeguro = valor => valor == null || valor === '' ? '—' : String(valor)

function normalizarDisponibilidade(disponibilidade) {
  if (typeof disponibilidade === 'boolean') return disponibilidade
  if (typeof disponibilidade === 'number') {
    if (disponibilidade === 1) return true
    if (disponibilidade === 0) return false
  }
  if (typeof disponibilidade !== 'string') return null

  const normalizada = disponibilidade.trim().toLocaleLowerCase('pt-BR')
  if (['true', '1', 'sim', 'disponivel', 'disponível'].includes(normalizada)) return true
  if (['false', '0', 'nao', 'não', 'indisponivel', 'indisponível'].includes(normalizada)) return false
  return null
}

function normalizarStatus(status) {
  const normalizado = String(status ?? '').trim().toLocaleLowerCase('pt-BR')
  if (normalizado.includes('pend')) return 'pendente'
  if (normalizado.includes('verific') || normalizado.includes('confirm')) return 'verificado'
  if (normalizado.includes('cancel') || normalizado.includes('recus')) return 'cancelado'
  return normalizado
}

function normalizarItens(itens) {
  let lista = itens

  if (typeof lista === 'string') {
    try {
      lista = JSON.parse(lista)
    } catch {
      return lista.trim() ? [{ nome: lista.trim() }] : []
    }
  }

  if (!Array.isArray(lista) && lista && typeof lista === 'object') {
    lista = lista.itens ?? lista.items ?? lista.produtos ?? []
  }

  if (!Array.isArray(lista)) return []

  return lista.map(item => {
    if (typeof item === 'string' || typeof item === 'number') {
      return { nome: String(item) }
    }
    if (!item || typeof item !== 'object') return { nome: 'Item não identificado' }

    const produto = item.produto && typeof item.produto === 'object' ? item.produto : {}
    const disponibilidade = normalizarDisponibilidade(item.disponivel ?? item.em_estoque ?? item.available ?? null)
    const quantidade = item.quantidade ?? item.qtd ?? item.quantity ?? null
    const quantidadeNumerica = quantidade == null || quantidade === '' ? null : Number(quantidade)

    return {
      nome: item.nome ?? item.nome_produto ?? item.produto_nome ?? produto.nome
        ?? (typeof item.produto === 'string' ? item.produto : null)
        ?? item.name ?? item.descricao ?? 'Item sem nome',
      quantidade: Number.isFinite(quantidadeNumerica) ? quantidadeNumerica : null,
      disponivel: disponibilidade
    }
  })
}

function normalizarPedido(registro) {
  const tipoEntrega = String(registro.tipo_entrega ?? '').toLocaleLowerCase('pt-BR')
  const distancia = registro.distancia_km == null || registro.distancia_km === ''
    ? null
    : Number(registro.distancia_km)

  return {
    id: registro.id,
    cliente: registro.cliente_nome,
    telefone: registro.cliente_telefone,
    itens: normalizarItens(registro.itens),
    subtotal: registro.subtotal,
    taxaEntrega: registro.valor_frete,
    total: registro.total,
    entrega: {
      tipo: tipoEntrega.includes('retir') ? 'retirada' : tipoEntrega.includes('entreg') ? 'entrega' : 'desconhecido',
      endereco: registro.endereco_entrega,
      distancia: Number.isFinite(distancia) ? distancia : null,
      horario: registro.horario_retirada
    },
    pagamento: registro.metodo_pagamento,
    statusPagamento: registro.status_pagamento,
    status: normalizarStatus(registro.status_pedido),
    statusOriginal: registro.status_pedido
  }
}

const resumoDosItens = pedido => pedido.itens
  .map(item => `${item.quantidade ? `${item.quantidade}x ` : ''}${item.nome}`)
  .join(', ') || 'Itens não informados'

const distanciaFormatada = distancia => Number.isFinite(distancia)
  ? `${distancia.toFixed(1).replace('.', ',')} km`
  : null

const destinoDoPedido = pedido => {
  if (pedido.entrega.tipo === 'retirada') {
    return `Retirada — Horário: ${textoSeguro(pedido.entrega.horario)}`
  }
  if (pedido.entrega.tipo === 'entrega') {
    const endereco = textoSeguro(pedido.entrega.endereco)
    const distancia = distanciaFormatada(pedido.entrega.distancia)
    return distancia ? `${endereco} (${distancia})` : endereco
  }
  return 'Logística não informada'
}

function Pedidos() {
  const [pedidos, setPedidos] = useState([])
  const [filtroAtivo, setFiltroAtivo] = useState('pendente')
  const [busca, setBusca] = useState('')
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState(null)
  const [painelMobileAberto, setPainelMobileAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const favicon = document.querySelector('link[rel="icon"]')
    if (!favicon) throw new Error('Não foi possível localizar o favicon da página.')

    const faviconAnterior = favicon.getAttribute('href')
    favicon.setAttribute('href', pedidosFavicon)
    document.body.classList.add('pedidos-body')

    return () => {
      document.body.classList.remove('pedidos-body')
      if (faviconAnterior) favicon.setAttribute('href', faviconAnterior)
    }
  }, [])

  useEffect(() => {
    let ativo = true

    async function carregarPedidos() {
      setCarregando(true)
      setErro('')
      try {
        const { data, error: erroConsulta } = await buscarPedidos()
        if (erroConsulta) throw erroConsulta
        if (!ativo) return

        const pedidosCarregados = (data ?? []).map(normalizarPedido)
        setPedidos(pedidosCarregados)
        const primeiroPendente = pedidosCarregados.find(pedido => pedido.status === 'pendente')
        setPedidoSelecionadoId(primeiroPendente?.id ?? pedidosCarregados[0]?.id ?? null)
      } catch (erroConsulta) {
        console.error('Erro ao carregar pedidos:', erroConsulta)
        if (ativo) setErro(erroConsulta.message || 'Não foi possível carregar os pedidos.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarPedidos()
    return () => { ativo = false }
  }, [])

  const pedidosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return pedidos.filter(pedido => {
      const correspondeAoStatus = filtroAtivo === 'todos' || pedido.status === filtroAtivo
      const textoBusca = `${pedido.cliente ?? ''} ${pedido.id}`.toLocaleLowerCase('pt-BR')
      return correspondeAoStatus && textoBusca.includes(termo)
    })
  }, [busca, filtroAtivo, pedidos])

  const pedidoSelecionado = pedidos.find(pedido => pedido.id === pedidoSelecionadoId)

  function abrirPedido(pedidoId) {
    setPedidoSelecionadoId(pedidoId)
    setPainelMobileAberto(true)
  }

  async function atualizarStatus(status) {
    if (!pedidoSelecionado || pedidoSelecionado.status !== 'pendente' || salvandoStatus) return

    setSalvandoStatus(true)
    setErro('')
    const statusPersistido = status === 'verificado' ? 'Verificado' : 'Cancelado'
    try {
      const { error: erroAtualizacao } = await atualizarStatusPedido(pedidoSelecionado.id, statusPersistido)
      if (erroAtualizacao) throw erroAtualizacao

      setPedidos(pedidosAtuais => pedidosAtuais.map(pedido => (
        pedido.id === pedidoSelecionado.id
          ? { ...pedido, status, statusOriginal: statusPersistido }
          : pedido
      )))
    } catch (erroAtualizacao) {
      console.error('Erro ao atualizar status do pedido:', erroAtualizacao)
      setErro(erroAtualizacao.message || 'Não foi possível atualizar o status do pedido.')
    } finally {
      setSalvandoStatus(false)
    }
  }

  function linkWhatsApp(pedido) {
    const telefone = String(pedido.telefone ?? '').replace(/\D/g, '')
    const mensagem = `Olá, ${pedido.cliente}! Sobre o pedido #${pedido.id}: ${resumoDosItens(pedido)}.`
    return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`
  }

  return (
    <div className={`pedidos-page${pedidos.length === 0 ? ' pedidos-sem-registros' : ''}`}>
      <main className="pedidos-main">
        <header className="pedidos-header">
          <a className="admin-profile-link" href="/admin/" aria-label="Voltar ao painel de produtos">
            <img className="admin-profile-icon" src={adminProfileIcon} alt="" />
          </a>
          <h1>Verificação de Pedidos</h1>
        </header>

        <div className="pedidos-toolbar">
          <nav className="pedidos-filtros" aria-label="Filtrar pedidos por status">
            {filtros.map(filtro => (
              <button
                key={filtro.id}
                type="button"
                className={`filtro-pill${filtroAtivo === filtro.id ? ' ativo' : ''}`}
                aria-pressed={filtroAtivo === filtro.id}
                onClick={() => setFiltroAtivo(filtro.id)}
              >
                {filtro.label}
              </button>
            ))}
          </nav>
          <label className="pedidos-busca">
            <span className="sr-only">Buscar por cliente ou ID do pedido</span>
            <input
              type="search"
              placeholder="Buscar por cliente..."
              value={busca}
              onChange={event => setBusca(event.target.value)}
            />
            <span aria-hidden="true">⌕</span>
          </label>
        </div>

        <section className="pedidos-lista" aria-labelledby="lista-pedidos-titulo">
          <div className="pedidos-lista-heading">
            <h2 id="lista-pedidos-titulo">Lista de Pedidos</h2>
            <span>{pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos'}</span>
          </div>
          {erro && <p className="pedidos-feedback pedidos-erro" role="alert">Não foi possível processar os pedidos: {erro}</p>}
          {carregando ? (
            <p className="pedidos-feedback" role="status">Carregando pedidos...</p>
          ) : pedidos.length === 0 ? (
            erro ? null : <p className="pedidos-feedback pedidos-vazio-geral">Nenhum pedido no momento</p>
          ) : (
          <div className="pedidos-tabela-scroll">
            <table className="pedidos-tabela">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Itens do Pedido</th>
                  <th scope="col">Entrega / Retirada</th>
                  <th scope="col">Subtotal</th>
                  <th scope="col">Total (c/ frete)</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map(pedido => {
                  return (
                    <tr key={pedido.id}>
                      <td className="pedido-id">#{pedido.id}</td>
                      <td>
                        <strong>{textoSeguro(pedido.cliente)}</strong>
                        <span className="cliente-telefone">{textoSeguro(pedido.telefone)}</span>
                      </td>
                      <td className="pedido-itens-resumo">{resumoDosItens(pedido)}</td>
                      <td className="pedido-destino">{destinoDoPedido(pedido)}</td>
                      <td>{moeda(pedido.subtotal)}</td>
                      <td className="pedido-total">{moeda(pedido.total)}</td>
                      <td><span className={`status-pill status-${pedido.status}`}>{statusLabel[pedido.status] ?? textoSeguro(pedido.statusOriginal)}</span></td>
                      <td>
                        <button
                          type="button"
                          className="verificar-button"
                          onClick={() => abrirPedido(pedido.id)}
                        >
                          Verificar
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {pedidosFiltrados.length === 0 && (
                  <tr>
                    <td className="pedidos-vazio" colSpan="8">Nenhum pedido encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </section>
      </main>

      {pedidoSelecionado && (
        <aside
          className={`pedido-painel${painelMobileAberto ? ' painel-mobile-aberto' : ''}`}
          aria-label="Detalhes do pedido selecionado"
        >
          <>
            <div className="painel-conteudo">
              <div className="painel-titulo">
                <div>
                  <span className="painel-sobretitulo">Revisão do pedido</span>
                  <h2>Verificar Pedido #{pedidoSelecionado.id} - {textoSeguro(pedidoSelecionado.cliente)}</h2>
                </div>
                <button
                  type="button"
                  className="painel-fechar"
                  aria-label="Fechar detalhes do pedido"
                  onClick={() => setPainelMobileAberto(false)}
                >
                  ×
                </button>
              </div>

              <section className="painel-secao" aria-labelledby="pedido-itens-titulo">
                <h3 id="pedido-itens-titulo">Itens do Pedido</h3>
                <ul className="painel-itens">
                  {pedidoSelecionado.itens.length === 0 && (
                    <li className="painel-item-vazio">Itens não informados</li>
                  )}
                  {pedidoSelecionado.itens.map((item, index) => (
                    <li key={`${pedidoSelecionado.id}-${index}`}>
                      <span className={`item-check${item.disponivel === false ? ' item-indisponivel' : ''}${item.disponivel == null ? ' item-disponibilidade-desconhecida' : ''}`} aria-hidden="true">
                        {item.disponivel === true ? '✓' : item.disponivel === false ? '×' : '•'}
                      </span>
                      <span>
                        <strong>{item.quantidade ? `${item.quantidade}x ` : ''}{item.nome}</strong>
                        <small>{item.disponivel === true
                          ? 'Em estoque'
                          : item.disponivel === false
                            ? 'Indisponível no estoque'
                            : 'Disponibilidade não informada'}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="painel-secao painel-informacoes" aria-labelledby="pedido-info-titulo">
                <h3 id="pedido-info-titulo">Informações do Pedido</h3>
                <dl>
                  <div><dt>Subtotal</dt><dd>{moeda(pedidoSelecionado.subtotal)}</dd></div>
                  <div>
                    <dt>{pedidoSelecionado.entrega.tipo === 'entrega' ? 'Frete' : 'Taxa de entrega'}</dt>
                    <dd>{pedidoSelecionado.taxaEntrega == null
                      ? '—'
                      : Number(pedidoSelecionado.taxaEntrega) === 0
                        ? 'Grátis'
                        : moeda(pedidoSelecionado.taxaEntrega)}
                    </dd>
                  </div>
                  <div className="info-total"><dt>Total (com frete)</dt><dd>{moeda(pedidoSelecionado.total)}</dd></div>
                </dl>
                <div className="painel-logistica">
                  <span className="logistica-icone" aria-hidden="true">
                    {pedidoSelecionado.entrega.tipo === 'entrega' ? '⌖' : pedidoSelecionado.entrega.tipo === 'retirada' ? '⌂' : '·'}
                  </span>
                  <div>
                    <strong>{pedidoSelecionado.entrega.tipo === 'entrega' ? 'Entrega' : pedidoSelecionado.entrega.tipo === 'retirada' ? 'Retirada' : 'Logística não informada'}</strong>
                    <p>{pedidoSelecionado.entrega.tipo === 'entrega'
                      ? destinoDoPedido(pedidoSelecionado)
                      : pedidoSelecionado.entrega.tipo === 'retirada'
                        ? `Horário agendado: ${textoSeguro(pedidoSelecionado.entrega.horario)}`
                        : 'Endereço ou horário não informado'}
                    </p>
                  </div>
                </div>
                <p className="painel-pagamento">
                  <strong>Pagamento</strong>
                  <span>{textoSeguro(pedidoSelecionado.pagamento)} <small>({textoSeguro(pedidoSelecionado.statusPagamento)})</small></span>
                </p>
              </section>
            </div>

            <div className="painel-acoes">
              <p className={`painel-status-atual status-texto-${pedidoSelecionado.status}`} aria-live="polite">
                Status: {statusLabel[pedidoSelecionado.status] ?? textoSeguro(pedidoSelecionado.statusOriginal)}
              </p>
              <button
                type="button"
                className="acao-confirmar"
                disabled={pedidoSelecionado.status !== 'pendente' || salvandoStatus}
                onClick={() => atualizarStatus('verificado')}
              >
                {salvandoStatus ? 'Salvando...' : 'Confirmar Pedido'}
              </button>
              <button
                type="button"
                className="acao-recusar"
                disabled={pedidoSelecionado.status !== 'pendente' || salvandoStatus}
                onClick={() => atualizarStatus('cancelado')}
              >
                Recusar
              </button>
              <a
                className="acao-whatsapp"
                href={linkWhatsApp(pedidoSelecionado)}
                target="_blank"
                rel="noreferrer"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.5 11.8a8.6 8.6 0 0 1-12.7 7.5L3 20.5l1.2-4.6a8.6 8.6 0 1 1 16.3-4.1Z" />
                  <path d="M8.5 8.2c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4 0 .5l-.5.7c-.2.2-.2.4 0 .6.5.9 1.2 1.5 2.1 2 .2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.2.3.4 0 .3-.2 1.1-.7 1.5-.5.4-1.1.6-1.8.4-1.5-.4-2.8-1.2-3.9-2.3-1-.9-1.8-2.1-2.2-3.3-.3-.8 0-1.5.4-1.9Z" />
                </svg>
                Chamar no WhatsApp
              </a>
            </div>
          </>
        </aside>
      )}
      {painelMobileAberto && (
        <button
          type="button"
          className="painel-overlay"
          aria-label="Fechar detalhes do pedido"
          onClick={() => setPainelMobileAberto(false)}
        />
      )}
    </div>
  )
}

export default Pedidos
