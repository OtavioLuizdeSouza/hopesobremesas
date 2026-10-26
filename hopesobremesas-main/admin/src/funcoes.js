import { useState, useRef } from 'react'
import { supabase } from './createClient'


/*  Formulários  */

export const produtoVazio = {
  nome:'', descricao:'', categoria:'', preco:'', estoque:''
}

export const produtoEdicaoVazio = {
  id:'', nome:'', descricao:'', categoria:'', preco:'', estoque:''
}


/*  Diversos  */

export function formatarPreco(preco) {
  return `R$ ${Number(preco).toFixed(2).replace('.', ',')}`
}

export function criarHandleChange(setEstado) {
  return function (event) {
    setEstado(prevFormData => ({
      ...prevFormData,
      [event.target.name]: event.target.value
    }))
  }
}


/*  Banco de dados (Supabase)  */

export function buscarProdutos() {
  return supabase
    .from('produtos')
    .select('id, nome, descricao, categoria, preco, estoque, esta_disponivel')
    .order('id', { ascending: true })
}

export function inserirProduto(produto) {
  return supabase
    .from('produtos')
    .insert({
      nome: produto.nome,
      descricao: produto.descricao,
      categoria: produto.categoria,
      preco: produto.preco,
      estoque: produto.estoque
    })
}

export function alternarDisponibilidade(produtoId, novoValor) {
  return supabase
    .from('produtos')
    .update({ esta_disponivel: novoValor })
    .eq('id', produtoId)
}

export function atualizarProduto(produtoId, produto) {
  return supabase
    .from('produtos')
    .update({
      id: produto.id,
      nome: produto.nome,
      descricao: produto.descricao,
      categoria: produto.categoria,
      preco: produto.preco,
      estoque: produto.estoque
    })
    .eq('id', produtoId)
}

export async function atualizarEstoques(estoques) {
  const ids = Object.keys(estoques).filter(id => estoques[id] !== '') 

  const resultados = await Promise.all(
    ids.map(id =>
      supabase
        .from('produtos')
        .update({ estoque: Number(estoques[id]) })
        .eq('id', id)
    )
  )

  const comErro = resultados.find(r => r.error)

  return { quantidade: ids.length, error: comErro ? comErro.error : null }
}


/*  Pop-up toast  */

export function useToast() {
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  function mostrarToast(mensagem, tipo = 'sucesso') {
    clearTimeout(toastTimer.current)   // se já tiver um toast na tela, reinicia o tempo
    setToast({ mensagem, tipo })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  return { toast, mostrarToast }
}
