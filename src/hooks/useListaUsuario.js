import { useCallback, useEffect, useState } from "react";
import { MSG_SUPABASE_NAO_CONFIGURADO, supabase } from "../lib/supabase.js";

/**
 * Lista as linhas do próprio usuário numa tabela com `usuario_id` e `principal`
 * (enderecos, formas_pagamento_salvas), com o principal primeiro.
 * O filtro por `usuario_id` é explícito porque o RLS deixa o admin ler tudo.
 */
export function useListaUsuario(tabela, colunas, userId, mensagemErro) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const recarregar = useCallback(async () => {
    if (!userId) return;
    if (!supabase) {
      setErro(MSG_SUPABASE_NAO_CONFIGURADO);
      setCarregando(false);
      return;
    }
    const { data, error } = await supabase
      .from(tabela)
      .select(colunas)
      .eq("usuario_id", userId)
      .order("principal", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.error(`Erro ao carregar ${tabela}:`, error.message);
      setErro(mensagemErro);
    } else {
      setErro("");
      setItens(data ?? []);
    }
    setCarregando(false);
  }, [tabela, colunas, userId, mensagemErro]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { itens, setItens, carregando, erro, recarregar };
}

/**
 * Marca uma linha como principal. Só pode haver uma por usuário (índice único
 * parcial), então desmarca as outras antes.
 */
export async function marcarPrincipal(tabela, userId, id) {
  if (!supabase) return { error: { message: MSG_SUPABASE_NAO_CONFIGURADO } };
  const desmarcar = await supabase
    .from(tabela)
    .update({ principal: false })
    .eq("usuario_id", userId)
    .eq("principal", true)
    .neq("id", id);
  if (desmarcar.error) return desmarcar;
  return supabase.from(tabela).update({ principal: true }).eq("id", id).eq("usuario_id", userId);
}
