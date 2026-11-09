import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { MSG_SUPABASE_NAO_CONFIGURADO, supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import StatusTimeline from "../components/pedido/StatusTimeline.jsx";
import ItensPedidoLista from "../components/pedido/ItensPedidoLista.jsx";
import {
  FORMA_PAGAMENTO_LABEL,
  SELECT_HISTORICO,
  ehRetirada,
  formatarDataHora,
  formatarPreco,
  rotuloStatus,
  textoEnderecoEntrega,
} from "../lib/pedido.js";

const SELECT_PEDIDOS = `
  id, status, forma_pagamento, subtotal, taxa_entrega, total, observacao,
  endereco_entrega, created_at, updated_at,
  itens_pedido(*, itens_pedido_adicionais(*, adicionais(nome))),
  ${SELECT_HISTORICO}
`;

function PedidoCard({ pedido, destaque }) {
  const retirada = ehRetirada(pedido);

  return (
    <article
      id={`pedido-${pedido.id}`}
      className={`pedido pedido--${pedido.status} ${destaque ? "pedido--destaque" : ""}`}
    >
      <header className="pedido__header">
        <div>
          <h3 className="pedido__numero">Pedido nº {pedido.id}</h3>
          <time className="pedido__data" dateTime={pedido.created_at}>
            {formatarDataHora(pedido.created_at)}
          </time>
        </div>
        <span className={`status-badge status-badge--${pedido.status}`}>
          {rotuloStatus(pedido.status, retirada)}
        </span>
      </header>

      <StatusTimeline
        status={pedido.status}
        retirada={retirada}
        historico={pedido.pedidos_status_historico}
      />

      <dl className="pedido__meta">
        <div>
          <dt>Recebimento</dt>
          <dd>
            {retirada
              ? "Retirada no balcão"
              : `Entrega · ${textoEnderecoEntrega(pedido.endereco_entrega)}`}
          </dd>
        </div>
        <div>
          <dt>Pagamento</dt>
          <dd>{FORMA_PAGAMENTO_LABEL[pedido.forma_pagamento] || pedido.forma_pagamento}</dd>
        </div>
      </dl>

      <ItensPedidoLista itens={pedido.itens_pedido} />

      {pedido.observacao && <p className="pedido__obs">Obs.: {pedido.observacao}</p>}

      <div className="pedido__totais">
        <span>Subtotal {formatarPreco(pedido.subtotal)}</span>
        <span>Taxa {formatarPreco(pedido.taxa_entrega)}</span>
        <strong>Total {formatarPreco(pedido.total)}</strong>
      </div>
    </article>
  );
}

export default function MeusPedidos({ destaqueId, onBack }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [realtimeFalhou, setRealtimeFalhou] = useState(false);

  const carregar = useCallback(async () => {
    if (!supabase) {
      setErro(MSG_SUPABASE_NAO_CONFIGURADO);
      return;
    }
    if (!userId) return;
    const { data, error } = await supabase
      .from("pedidos")
      .select(SELECT_PEDIDOS)
      // Filtro explícito: o RLS deixa o admin ler pedidos de todos os clientes.
      .eq("usuario_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Erro ao carregar pedidos:", error.message);
      setErro("Não foi possível carregar seus pedidos.");
    } else {
      setErro("");
      setPedidos(data ?? []);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let ativo = true;
    carregar().finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [userId, carregar]);

  // Tempo real: atualiza status/totais sem recarregar. Requer `pedidos` na
  // publicação supabase_realtime; se não vier evento, o botão "Atualizar" resolve.
  useEffect(() => {
    if (!userId || !supabase) return;
    const canal = supabase
      .channel(`pedidos-usuario-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `usuario_id=eq.${userId}` },
        async ({ new: novo }) => {
          // Aplica o status na hora e depois busca o pedido de novo para trazer
          // o horário da etapa (pedidos_status_historico).
          setPedidos((lista) => lista.map((p) => (p.id === novo.id ? { ...p, ...novo } : p)));
          const { data } = await supabase
            .from("pedidos")
            .select(SELECT_PEDIDOS)
            .eq("id", novo.id)
            .maybeSingle();
          if (data) setPedidos((lista) => lista.map((p) => (p.id === data.id ? data : p)));
        }
      )
      .subscribe((status) => {
        setRealtimeFalhou(status === "CHANNEL_ERROR" || status === "TIMED_OUT");
      });
    return () => {
      supabase.removeChannel(canal);
    };
  }, [userId]);

  // Leva o pedido recém-criado para a tela.
  useEffect(() => {
    if (carregando || !destaqueId) return;
    document
      .getElementById(`pedido-${destaqueId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [carregando, destaqueId]);

  const atualizar = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  return (
    <div className="auth meus-pedidos">
      <div className="auth__header">
        <div className="auth__logo">
          BURGUER<span className="brand__accent">TEC</span>
        </div>
        <span className="auth__tagline">MEUS PEDIDOS</span>
      </div>

      <div className="meus-pedidos__conteudo">
        <div className="meus-pedidos__topo">
          <button type="button" className="auth__back" onClick={onBack}>
            <ArrowLeft size={14} /> Voltar ao cardápio
          </button>
          <button
            type="button"
            className="btn btn--outline meus-pedidos__atualizar"
            onClick={atualizar}
            disabled={carregando || atualizando}
          >
            <RefreshCw size={14} className={atualizando ? "is-girando" : ""} />
            {atualizando ? "ATUALIZANDO..." : "ATUALIZAR"}
          </button>
        </div>

        {realtimeFalhou && (
          <p className="checkout__info" role="status">
            Atualização automática indisponível. Use o botão Atualizar para ver o status.
          </p>
        )}

        {carregando ? (
          <p className="cardapio__status" role="status">
            Carregando pedidos...
          </p>
        ) : erro && pedidos.length === 0 ? (
          <div className="meus-pedidos__estado">
            <p className="auth__msg auth__msg--erro" role="alert">
              {erro}
            </p>
            <button type="button" className="btn btn--primary" onClick={atualizar}>
              TENTAR NOVAMENTE
            </button>
          </div>
        ) : pedidos.length === 0 ? (
          <div className="meus-pedidos__estado">
            <p className="drawer__vazio">Você ainda não fez pedidos.</p>
            <button type="button" className="btn btn--primary" onClick={onBack}>
              VER CARDÁPIO
            </button>
          </div>
        ) : (
          <div className="meus-pedidos__lista">
            {erro && (
              <p className="auth__msg auth__msg--erro" role="alert">
                {erro}
              </p>
            )}
            {pedidos.map((p) => (
              <PedidoCard key={p.id} pedido={p} destaque={Number(p.id) === Number(destaqueId)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
