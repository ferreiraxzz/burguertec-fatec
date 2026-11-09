import React, { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { formatarData, formatarTelefone, mascararCpf } from "../../lib/formatos.js";

function useNumeroPedidos(userId) {
  const [total, setTotal] = useState(null);
  useEffect(() => {
    if (!userId || !supabase) return;
    let ativo = true;
    supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", userId)
      .then(({ count, error }) => {
        if (!ativo) return;
        if (error) console.error("Erro ao contar pedidos:", error.message);
        setTotal(error ? null : count ?? 0);
      });
    return () => {
      ativo = false;
    };
  }, [userId]);
  return total;
}

export default function PerfilResumo({ user, perfil, onPedidos }) {
  const totalPedidos = useNumeroPedidos(user?.id);

  return (
    <section className="perfil__secao" aria-labelledby="perfil-resumo">
      <h3 id="perfil-resumo" className="perfil__titulo">Resumo</h3>
      <dl className="perfil-resumo">
        <div>
          <dt>Nome</dt>
          <dd>{perfil?.nome || "—"}</dd>
        </div>
        <div>
          <dt>E-mail</dt>
          <dd>{user?.email || "—"}</dd>
        </div>
        <div>
          <dt>Telefone</dt>
          <dd>{perfil?.telefone ? formatarTelefone(perfil.telefone) : "Não informado"}</dd>
        </div>
        <div>
          <dt>CPF</dt>
          <dd>{mascararCpf(perfil?.cpf)}</dd>
        </div>
        <div>
          <dt>Cliente desde</dt>
          <dd>{formatarData(perfil?.created_at)}</dd>
        </div>
        <div>
          <dt>Pedidos</dt>
          <dd>{totalPedidos ?? "—"}</dd>
        </div>
      </dl>
      <button type="button" className="checkout__link" onClick={onPedidos}>
        <Receipt size={14} /> Ver meus pedidos
      </button>
    </section>
  );
}
