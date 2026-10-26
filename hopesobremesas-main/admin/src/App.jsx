import React, { useState, useEffect, useRef } from 'react';
import './App.css'
import {
  produtoVazio,
  produtoEdicaoVazio,
  formatarPreco,
  criarHandleChange,
  buscarProdutos,
  inserirProduto,
  alternarDisponibilidade,
  atualizarProduto,
  atualizarEstoques,
  useToast
} from './funcoes'

const App = () => {

  const [produtos, setProdutos]=useState([])

  const [produto, setProduto]=useState(produtoVazio)

  const [produto2, setProduto2]=useState(produtoEdicaoVazio)

  const [estoques, setEstoques] = useState({})

  const { toast, mostrarToast } = useToast()

  const formEdicaoRef = useRef(null)
  const [pedidoScroll, setPedidoScroll] = useState(0)

  const handleChange = criarHandleChange(setProduto)
  const handleChange2 = criarHandleChange(setProduto2)

  console.log(produto2)

  useEffect(() => {
    fetchProdutos()
  }, [])

  useEffect(() => {
    if (pedidoScroll > 0) {
      formEdicaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [pedidoScroll])


  async function fetchProdutos () {
    const { data } = await buscarProdutos()
    setProdutos(data)
  }


  async function createProdutos (event) {
    event.preventDefault()
    const form = event.target

    const { error } = await inserirProduto(produto)

    if (error) {
      console.error('Erro ao cadastrar:', error.message, error.code)
      mostrarToast('Erro ao cadastrar o produto.', 'erro')
      return
    }

    mostrarToast(`Produto "${produto.nome}" adicionado com sucesso!`)
    form.reset()
    setProduto(produtoVazio)
    fetchProdutos()
  }


  async function deleteProdutos (produtoId, estaDisponivel) {
    const novoValor = estaDisponivel ? false : true
    const nome = produtos.find(p => p.id === produtoId)?.nome

    const { error } = await alternarDisponibilidade(produtoId, novoValor)

    if (error) {
      console.log(error)
      mostrarToast('Erro ao atualizar o produto.', 'erro')
      return
    }

    mostrarToast(novoValor ? `Produto "${nome}" restaurado.` : `Produto "${nome}" removido.`)
    fetchProdutos()
  }


  function displayProdutos(produtoId) {
    produtos.map((produto) => {

      if(produto.id==produtoId){
        setProduto2({id:produto.id, nome:produto.nome, descricao:produto.descricao, categoria:produto.categoria, preco:produto.preco, estoque:produto.estoque})
      }
    })
    setPedidoScroll(n => n + 1)
  }


  async function updateProdutos(event, produtoId){
    event.preventDefault()
    const form = event.target

    if (produtoId === '') {
      mostrarToast('Clique em "Editar" em um produto antes de salvar.', 'info')
      return
    }

    const { error } = await atualizarProduto(produtoId, produto2)

    if (error){
      console.log(error)
      mostrarToast('Erro ao salvar as alterações.', 'erro')
      return
    }

    mostrarToast(`Produto "${produto2.nome}" atualizado com sucesso!`)
    form.reset()
    setProduto2(produtoEdicaoVazio)
    fetchProdutos()
  }


  function cancelarUpdate() {
    setProduto2(produtoEdicaoVazio)
  }


  function handleEstoqueChange(produtoId, valor) {
    setEstoques(prev => ({ ...prev, [produtoId]: valor }))
  }


  async function salvarEstoque() {
    const { quantidade, error } = await atualizarEstoques(estoques)

    if (quantidade === 0) {
      mostrarToast('Nenhuma alteração de estoque para salvar.', 'info')
      return
    }

    if (error) {
      console.error('Erro ao salvar estoque:', error.message)
      mostrarToast('Erro ao salvar o estoque.', 'erro')
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

  return (
    <div>

    {/* 1. Formulario de criação */}
    <form id='criar_produto' className='form-card' onSubmit={createProdutos}>
        <input type='text'
          placeholder='Nome do produto'
          name='nome'
          onChange={handleChange}
        />

        <input type='text'
          placeholder='Descrição'
          name='descricao'
          onChange={handleChange}
        />

        <input type='text'
          placeholder='Categoria'
          name='categoria'
          onChange={handleChange}
        />

        <input type='number' step='any'
          placeholder='Preço'
          name='preco'
          onChange={handleChange}
        />

        <input type='number'
          placeholder='Estoque'
          name='estoque'
          onChange={handleChange}
        />
        <button type='submit'>
          Cadastrar
        </button>
    </form>

{/* 2. Formulario de edição (só aparece após clicar em Editar) */}
    {produto2.id !== '' && (
      <form
        ref={formEdicaoRef}
        key={produto2.id}
        className='form-card'
        onSubmit={(e) => updateProdutos(e, produto2.id)}
      >
          
          <input type='text'
            name='nome'
            onChange={handleChange2}
            defaultValue={produto2.nome}
          />

          <input type='text'
            name='descricao'
            onChange={handleChange2}
            defaultValue={produto2.descricao}
          />

          <input type='text'
            name='categoria'
            onChange={handleChange2}
            defaultValue={produto2.categoria}
          />

          <input type='number' step='any'
            name='preco'
            onChange={handleChange2}
            defaultValue={produto2.preco}
          />

          <input type='number'
            name='estoque'
            onChange={handleChange2}
            defaultValue={produto2.estoque}
          />
          <button type='submit'>Salvar Alterações</button>
          <button type='button' onClick={cancelarUpdate}>Cancelar</button>
      </form>
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
          {produtos.map((produto)=> 
            <tr 
            key={produto.id} 
            className={produto.esta_disponivel === false ? 'indisponivel' : ''}
            >
              
              <td>{produto.id}</td>
              <td>{produto.nome}</td>
              <td>{produto.descricao}</td>
              <td>{produto.categoria}</td>
              <td>{formatarPreco(produto.preco)}</td>
              <td>
                <input
                  className='input-estoque'
                  type='number'
                  min='0'
                  value={estoques[produto.id] ?? produto.estoque}
                  onChange={(e) => handleEstoqueChange(produto.id, e.target.value)}
                />
              </td>
              <td>
                <div className='acoes'>
                  <button
                    className={produto.esta_disponivel ? 'btn-remover' : 'btn-restaurar'}
                    onClick={() =>{deleteProdutos(produto.id, produto.esta_disponivel)}}>
                    {produto.esta_disponivel ? 'Remover' : 'Restaurar'}
                  </button>
                  <button
                    className='btn-editar'
                    onClick={() =>{displayProdutos(produto.id)}}>
                    Editar
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div id='botao_salvar'>
        <button onClick={salvarEstoque}>Salvar Estoque</button>
      </div>
      

      {toast && (
        <div className={`toast toast-${toast.tipo}`}>
          {toast.mensagem}
        </div>
      )}

    </div>
  )
}

export default App
