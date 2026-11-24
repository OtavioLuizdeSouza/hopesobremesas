import { supabase } from '../config/supabase.js';

export async function listarProdutos() {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .order('id');

  if (error) throw error;
  return data.map((produto) => ({
    ...produto,
    imagem_url: supabase.storage
      .from('Hope produtos')
      .getPublicUrl(`Produtos/id${produto.id}.jpeg`)
      .data.publicUrl,
  }));
}
