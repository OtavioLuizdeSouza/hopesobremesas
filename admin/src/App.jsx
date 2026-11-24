import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css'
import Pedidos from './Pedidos.jsx'
import pedidosIcon from './assets/pedidos.svg'
import { supabase } from './createClient'
import {
  produtoVazio,
  PRODUTOS_BUCKET,
  caminhoImagemProduto,
  formatarPreco,
  criarHandleChange,
  buscarProdutos,
  inserirProduto,
  alternarDisponibilidade,
  atualizarProduto,
  atualizarEstoques,
  useToast
} from './funcoes'

function zoomValido(valor) {
  const zoom = Number(valor)
  return Number.isFinite(zoom) && zoom > 0 && zoom <= 100 ? zoom : 100
}

async function converterParaJpeg(file) {
  const ehWebp = file?.type?.toLowerCase() === 'image/webp'
    || /\.webp$/i.test(file?.name ?? '')
  if (!file || (!file.type?.startsWith('image/') && !ehWebp)) {
    throw new Error('Selecione um arquivo de imagem válido.')
  }

  const fonteImagem = ehWebp && !file.type
    ? new Blob([file], { type: 'image/webp' })
    : file
  const objectUrl = URL.createObjectURL(fonteImagem)
  try {
    const image = new Image()
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new Error('Não foi possível abrir a imagem selecionada.'))
      image.src = objectUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não foi possível processar a imagem.')

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)

    const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!jpeg) throw new Error('Não foi possível converter a imagem para JPEG.')
    return jpeg
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const ProductAdmin = () => {
  const [produtos, setProdutos] = useState([])
  const [produto, setProduto] = useState({ ...produtoVazio })
  const [estoques, setEstoques] = useState({})
  const [modalAberto, setModalAberto] = useState(false)
  const [modoModal, setModoModal] = useState('criar')
  const [produtoIdEditando, setProdutoIdEditando] = useState(null)
  const [imagemSelecionada, setImagemSelecionada] = useState(null)
  const [imagemPreparada, setImagemPreparada] = useState(null)
  const [previewImagem, setPreviewImagem] = useState('')
  const [imagemAtualUrl, setImagemAtualUrl] = useState('')
  const [removerImagem, setRemoverImagem] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [produtoPendenteId, setProdutoPendenteId] = useState(null)

  const { toast, mostrarToast } = useToast()
  const previewUrlRef = useRef(null)
  const handleChange = criarHandleChange(setProduto)

  const fetchProdutos = useCallback(async () => {
    try {
      const { data, error } = await buscarProdutos()
      if (error) throw error
      setProdutos(data ?? [])
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
      mostrarToast('Não foi possível carregar os produtos.', 'erro')
    }
  }, [mostrarToast])

  useEffect(() => {
    let ignorar = false
    buscarProdutos()
      .then(({ data, error }) => {
        if (error) throw error
        if (!ignorar) setProdutos(data ?? [])
      })
      .catch((error) => {
        if (ignorar) return
        console.error('Erro ao carregar produtos:', error)
        mostrarToast('Não foi possível carregar os produtos.', 'erro')
      })

    return () => {
      ignorar = true
    }
  }, [mostrarToast])

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  function limparPreviewLocal() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  function limparModal() {
    limparPreviewLocal()
    setProduto({ ...produtoVazio })
    setProdutoIdEditando(null)
    setImagemSelecionada(null)
    setImagemPreparada(null)
    setPreviewImagem('')
    setImagemAtualUrl('')
    setRemoverImagem(false)
    setProdutoPendenteId(null)
    setModalAberto(false)
  }

  function abrirCadastro() {
    if (modoModal === 'criar' && produtoPendenteId !== null) {
      setModalAberto(true)
      return
    }

    limparModal()
    setModoModal('criar')
    setModalAberto(true)
  }

  function fecharModal() {
    if (modoModal === 'criar' && produtoPendenteId !== null) {
      setModalAberto(false)
      return
    }
    limparModal()
  }

  function selecionarImagem(event) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return

    limparPreviewLocal()
    previewUrlRef.current = URL.createObjectURL(file)
    setImagemSelecionada(file)
    setImagemPreparada(null)
    setRemoverImagem(false)
    setPreviewImagem(previewUrlRef.current)
  }

  function alternarRemocaoImagem() {
    if (removerImagem) {
      setRemoverImagem(false)
      setPreviewImagem(imagemAtualUrl)
      return
    }

    limparPreviewLocal()
    setImagemSelecionada(null)
    setImagemPreparada(null)
    setPreviewImagem('')
    setRemoverImagem(true)
  }

  function abrirEdicao(produtoSelecionado) {
    limparPreviewLocal()
    const urlImagem = supabase.storage
      .from(PRODUTOS_BUCKET)
      .getPublicUrl(caminhoImagemProduto(produtoSelecionado.id))
      .data.publicUrl

    setProduto({
      nome: produtoSelecionado.nome,
      descricao: produtoSelecionado.descricao,
      categoria: produtoSelecionado.categoria,
      preco: produtoSelecionado.preco,
      estoque: produtoSelecionado.estoque,
      imagem: String(zoomValido(produtoSelecionado.imagem))
    })
    setProdutoIdEditando(produtoSelecionado.id)
    setImagemSelecionada(null)
    setImagemPreparada(null)
    setImagemAtualUrl(urlImagem)
    setPreviewImagem(urlImagem)
    setRemoverImagem(false)
    setProdutoPendenteId(null)
    setModoModal('editar')
    setModalAberto(true)
  }

  async function createProdutos(event) {
    event.preventDefault()
    if (enviando) return
    if (produtoPendenteId === null && !imagemSelecionada) {
      mostrarToast('Selecione uma imagem para cadastrar o produto.', 'erro')
      return
    }

    setEnviando(true)
    let produtoId = produtoPendenteId
    try {
      let imagemJpeg = imagemPreparada
      if (produtoId === null) {
        imagemJpeg = await converterParaJpeg(imagemSelecionada)
        setImagemPreparada(imagemJpeg)

        const { data, error } = await inserirProduto(produto)
        if (error) throw error
        if (!data?.id) throw new Error('O cadastro não retornou o ID do produto.')
        produtoId = data.id
      }

      const { error: erroUpload } = await supabase.storage
        .from(PRODUTOS_BUCKET)
        .upload(caminhoImagemProduto(produtoId), imagemJpeg, {
          contentType: 'image/jpeg',
          upsert: true
        })

      if (erroUpload) throw erroUpload

      mostrarToast(`Produto "${produto.nome}" cadastrado com sucesso!`)
      limparModal()
      fetchProdutos()
    } catch (error) {
      console.error('Erro ao cadastrar produto ou enviar imagem:', error)
      if (produtoId !== null) {
        setProdutoPendenteId(produtoId)
        mostrarToast(
          `Produto criado (ID ${produtoId}), mas a imagem não foi enviada: ${error.message || 'erro desconhecido'}`,
          'erro'
        )
      } else {
        mostrarToast(error.message || 'Erro ao cadastrar o produto.', 'erro')
      }
    } finally {
      setEnviando(false)
    }
  }

  async function updateProdutos(event) {
    event.preventDefault()
    if (produtoIdEditando === null || enviando) return

    setEnviando(true)
    let dadosSalvos = false
    try {
      let imagemJpeg = imagemPreparada
      if (imagemSelecionada && !imagemJpeg) {
        imagemJpeg = await converterParaJpeg(imagemSelecionada)
        setImagemPreparada(imagemJpeg)
      }

      const { error } = await atualizarProduto(produtoIdEditando, produto)
      if (error) throw error
      dadosSalvos = true

      if (imagemSelecionada) {
        const { error: erroUpload } = await supabase.storage
          .from(PRODUTOS_BUCKET)
          .upload(caminhoImagemProduto(produtoIdEditando), imagemJpeg, {
            contentType: 'image/jpeg',
            upsert: true
          })
        if (erroUpload) throw erroUpload
      } else if (removerImagem) {
        const { error: erroRemocao } = await supabase.storage
          .from(PRODUTOS_BUCKET)
          .remove([caminhoImagemProduto(produtoIdEditando)])
        if (erroRemocao) throw erroRemocao
      }

      mostrarToast(`Produto "${produto.nome}" atualizado com sucesso!`)
      limparModal()
      fetchProdutos()
    } catch (error) {
      console.error('Erro ao atualizar produto ou imagem:', error)
      mostrarToast(
        dadosSalvos
          ? `Dados salvos, mas não foi possível atualizar a imagem: ${error.message || 'erro desconhecido'}`
          : error.message || 'Erro ao salvar as alterações.',
        'erro'
      )
    } finally {
      setEnviando(false)
    }
  }

  async function deleteProdutos(produtoId, estaDisponivel) {
    const novoValor = !estaDisponivel
    const nome = produtos.find(p => p.id === produtoId)?.nome
    const { error } = await alternarDisponibilidade(produtoId, novoValor)

    if (error) {
      console.error('Erro ao atualizar disponibilidade:', error)
      mostrarToast('Erro ao atualizar o produto.', 'erro')
      return
    }

    mostrarToast(novoValor ? `Produto "${nome}" restaurado.` : `Produto "${nome}" removido.`)
    fetchProdutos()
  }

  function handleEstoqueChange(produtoId, valor) {
    setEstoques(prev => ({ ...prev, [produtoId]: valor }))
  }

  async function salvarEstoque() {
    const { quantidade, error } = await atualizarEstoques(estoques)

    if (error) {
      console.error('Erro ao salvar estoque:', error)
      mostrarToast('Erro ao salvar o estoque.', 'erro')
      return
    }

    if (quantidade === 0) {
      mostrarToast('Nenhuma alteração de estoque para salvar.', 'info')
      return
    }

    setEstoques({})
    mostrarToast(
      quantidade === 1
        ? '1 estoque atualizado com sucesso!'
        : `${quantidade} estoques atualizados com sucesso!`
    )
    fetchProdutos()
  }

  const criando = modoModal === 'criar'
  const imagemBloqueada = enviando || (criando && produtoPendenteId !== null)

  return (
    <div>
      <a className='pedidos-shortcut' href='/admin/pedidos' aria-label='Acessar pedidos'>
        <img src={pedidosIcon} alt='' />
      </a>
      <div className='toolbar-produtos'>
        <button type='button' onClick={abrirCadastro}>
          Cadastrar
        </button>
      </div>

      {modalAberto && (
        <div
          className='modal-overlay'
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !enviando) fecharModal()
          }}
        >
          <section className='modal-cadastro' role='dialog' aria-modal='true' aria-labelledby='titulo-produto'>
            <h1 id='titulo-produto'>{criando ? 'Cadastrar Produto' : 'Editar Produto'}</h1>
            <form className='form-cadastro' onSubmit={criando ? createProdutos : updateProdutos}>
              <div className='controle-imagem'>
                <label className='seletor-imagem' htmlFor='imagem-produto'>
                  {previewImagem
                    ? (
                      <img
                        src={previewImagem}
                        alt='Pré-visualização do produto'
                        onError={() => setPreviewImagem('')}
                      />
                    )
                    : (
                      <span>
                        <svg viewBox='0 0 48 48' aria-hidden='true'>
                          <path d='M7 11a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v3h-4v-2H11v20h13v4H10a3 3 0 0 1-3-3V11Zm7 14 5-6 4 5 3-3 6 8H14v-4Zm3-7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm20-5v5h5v4h-5v5h-4v-5h-5v-4h5v-5h4Z' />
                        </svg>
                        <span>Inserir imagem</span>
                      </span>
                    )}
                </label>
                <input
                  id='imagem-produto'
                  type='file'
                  accept='image/*,.webp'
                  onChange={selecionarImagem}
                  disabled={imagemBloqueada}
                />
                {!criando && (
                  <button
                    type='button'
                    className='btn-remover-imagem'
                    onClick={alternarRemocaoImagem}
                    disabled={enviando}
                  >
                    {removerImagem ? 'Cancelar remoção' : 'Remover imagem'}
                  </button>
                )}
                <label className='controle-zoom' htmlFor='zoom-produto'>
                  <span>Zoom</span>
                  <span className='zoom-valor'>
                    <input
                      id='zoom-produto'
                      type='number'
                      min='0.01'
                      max='100'
                      step='0.01'
                      name='imagem'
                      value={produto.imagem}
                      onChange={handleChange}
                      required
                      disabled={imagemBloqueada}
                    />
                    <span>%</span>
                  </span>
                </label>
              </div>

              <div className='campos-cadastro'>
                {criando && produtoPendenteId !== null && (
                  <p className='aviso-upload'>
                    O produto já foi criado. Tente novamente para enviar a imagem sem duplicá-lo.
                  </p>
                )}
                {!criando && removerImagem && (
                  <p className='aviso-upload'>A imagem será removida ao salvar.</p>
                )}
                <input
                  type='text'
                  placeholder='Nome do produto'
                  name='nome'
                  value={produto.nome}
                  onChange={handleChange}
                  required
                  disabled={enviando || (criando && produtoPendenteId !== null)}
                />
                <textarea
                  placeholder='Descrição'
                  name='descricao'
                  value={produto.descricao}
                  onChange={handleChange}
                  required
                  disabled={enviando || (criando && produtoPendenteId !== null)}
                />
                <input
                  type='text'
                  placeholder='Categoria'
                  name='categoria'
                  value={produto.categoria}
                  onChange={handleChange}
                  required
                  disabled={enviando || (criando && produtoPendenteId !== null)}
                />
                <div className='linha-campos'>
                  <input
                    type='number'
                    min='0'
                    step='any'
                    placeholder='Preço'
                    name='preco'
                    value={produto.preco}
                    onChange={handleChange}
                    required
                    disabled={enviando || (criando && produtoPendenteId !== null)}
                  />
                  <input
                    type='number'
                    min='0'
                    step='1'
                    placeholder='Estoque'
                    name='estoque'
                    value={produto.estoque}
                    onChange={handleChange}
                    required
                    disabled={enviando || (criando && produtoPendenteId !== null)}
                  />
                </div>
                <div className='acoes-modal'>
                  <button type='submit' disabled={enviando}>
                    {enviando
                      ? 'Salvando…'
                      : criando && produtoPendenteId !== null
                        ? 'Tentar novamente'
                        : criando
                          ? 'Cadastrar'
                          : 'Salvar alterações'}
                  </button>
                  <button type='button' className='btn-cancelar' onClick={fecharModal} disabled={enviando}>
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Id</th>
            <th>Produto</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Preço</th>
            <th>Estoque</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {produtos.map((item) =>
            <tr
              key={item.id}
              className={item.esta_disponivel === false ? 'indisponivel' : ''}
            >
              <td>{item.id}</td>
              <td>{item.nome}</td>
              <td>{item.descricao}</td>
              <td>{item.categoria}</td>
              <td>{formatarPreco(item.preco)}</td>
              <td>
                <input
                  className='input-estoque'
                  type='number'
                  min='0'
                  value={estoques[item.id] ?? item.estoque}
                  onChange={(event) => handleEstoqueChange(item.id, event.target.value)}
                />
              </td>
              <td>
                <div className='acoes'>
                  <button
                    type='button'
                    className={item.esta_disponivel ? 'btn-remover' : 'btn-restaurar'}
                    onClick={() => deleteProdutos(item.id, item.esta_disponivel)}>
                    {item.esta_disponivel ? 'Remover' : 'Restaurar'}
                  </button>
                  <button type='button' className='btn-editar' onClick={() => abrirEdicao(item)}>
                    Editar
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div id='botao_salvar'>
        <button type='button' onClick={salvarEstoque}>Salvar Estoque</button>
      </div>

      {toast && (
        <div className={`toast toast-${toast.tipo}`} role='status'>
          {toast.mensagem}
        </div>
      )}
    </div>
  )
}

const App = () => {
  const isOrdersPage = window.location.pathname.replace(/\/+$/, '') === '/admin/pedidos'
  return isOrdersPage ? <Pedidos /> : <ProductAdmin />
}

export default App
