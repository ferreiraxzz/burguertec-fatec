import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Volume2, VolumeX } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { SELECT_HISTORICO, statusFinalizado } from "../../lib/pedido.js";
import AdminPedidoCard from "./AdminPedidoCard.jsx";
import { lerPreferencia, salvarPreferencia, tocarBip } from "./adminUtils.js";

// FK explícita: pedidos -> perfis pelo usuario_id (evita ambiguidade no embed).
const SELECT_PEDIDO_ADMIN = `
  id, usuario_id, status, forma_pagamento, subtotal, taxa_entrega, total, observacao,
  endereco_entrega, created_at, updated_at,
  perfis!pedidos_usuario_id_fkey(nome, telefone),
  itens_pedido(*, itens_pedido_adicionais(*, adicionais(nome))),
  ${SELECT_HISTORICO}
`;

const ATIVOS = ["recebido", "em_preparo", "saiu_para_entrega"];
const LIMITE_FINALIZADOS = 50;
const CHAVE_SOM = "burguertec:admin-som";

const FILTROS = [
  { id: "recebido", label: "Recebidos", testa: (p) => p.status === "recebido" },
  { id: "em_preparo", label: "Em preparo", testa: (p) => p.status === "em_preparo" },
  {
    id: "saiu_para_entrega",
    label: "Saiu para entrega / Pronto para retirada",
    testa: (p) => p.status === "saiu_para_entrega",
  },
  { id: "finalizados", label: "Finalizados", testa: (p) => statusFinalizado(p.status) },
];

function ordenar(lista) {
  // Ativos: mais antigo primeiro (fila da cozinha). Finalizados: mais recente primeiro.
  return [...lista].sort((a, b) => {
    const fa = statusFinalizado(a.status);
    const fb = statusFinalizado(b.status);
    if (fa !== fb) return fa ? 1 : -1;
    return fa ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at);
  });
}

export default function AdminPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("recebido");
  const [novos, setNovos] = useState(() => new Set());
  const [som, setSom] = useState(() => lerPreferencia(CHAVE_SOM, false));
  const [realtimeFalhou, setRealtimeFalhou] = useState(false);
  const somRef = useRef(som);
  somRef.current = som;

  const carregar = useCallback(async () => {
    const [ativos, finalizados] = await Promise.all([
      supabase.from("pedidos").select(SELECT_PEDIDO_ADMIN).in("status", ATIVOS),
      supabase
        .from("pedidos")
        .select(SELECT_PEDIDO_ADMIN)
        .in("status", ["entregue", "cancelado"])
        .order("updated_at", { ascending: false })
        .limit(LIMITE_FINALIZADOS),
    ]);
    const error = ativos.error || finalizados.error;
    if (error) {
      console.error("Erro ao carregar pedidos (admin):", error.message);
      setErro("Não foi possível carregar os pedidos.");
      return;
    }
    setErro("");
    setPedidos(ordenar([...(ativos.data ?? []), ...(finalizados.data ?? [])]));
  }, []);

  const buscarUm = useCallback(async (id) => {
    const { data, error } = await supabase
      .from("pedidos")
      .select(SELECT_PEDIDO_ADMIN)
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    setPedidos((lista) => ordenar([data, ...lista.filter((p) => p.id !== data.id)]));
    return data;
  }, []);

  useEffect(() => {
    carregar().finally(() => setCarregando(false));
  }, [carregar]);

  // Tempo real: pedido novo aparece sozinho; mudança de status atualiza o card.
  useEffect(() => {
    const canal = supabase
      .channel("admin-pedidos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos" }, async ({ new: p }) => {
        const pedido = await buscarUm(p.id);
        if (!pedido) return;
        setNovos((s) => new Set(s).add(pedido.id));
        if (somRef.current) tocarBip();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos" }, ({ new: p }) => {
        buscarUm(p.id);
      })
      .subscribe((status) => {
        setRealtimeFalhou(status === "CHANNEL_ERROR" || status === "TIMED_OUT");
      });
    return () => {
      supabase.removeChannel(canal);
    };
  }, [buscarUm]);

  const mudarStatus = async (id, status) => {
    const { error } = await supabase.from("pedidos").update({ status }).eq("id", id);
    if (error) return error.message || "Não foi possível alterar o status.";
    await buscarUm(id);
    return null;
  };

  const marcarVisto = (id) =>
    setNovos((s) => {
      if (!s.has(id)) return s;
      const n = new Set(s);
      n.delete(id);
      return n;
    });

  const alternarSom = () => {
    const novo = !som;
    setSom(novo);
    salvarPreferencia(CHAVE_SOM, novo);
    if (novo) tocarBip(); // o clique libera o áudio no navegador e serve de teste
  };

  const atualizar = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const filtroAtual = FILTROS.find((f) => f.id === filtro);
  const visiveis = pedidos.filter(filtroAtual.testa);

  return (
    <section aria-label="Pedidos">
      <div className="admin__barra">
        <div className="admin-filtros" role="group" aria-label="Filtrar por status">
          {FILTROS.map((f) => {
            const total = pedidos.filter(f.testa).length;
            const novosNoFiltro = pedidos.filter((p) => f.testa(p) && novos.has(p.id)).length;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtro === f.id}
                className={`admin-filtros__item ${filtro === f.id ? "admin-filtros__item--ativo" : ""}`}
                onClick={() => setFiltro(f.id)}
              >
                {f.label} <span className="admin-filtros__total">{total}</span>
                {novosNoFiltro > 0 && (
                  <span className="admin-filtros__novos" aria-label={`${novosNoFiltro} novos`}>
                    +{novosNoFiltro}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="admin__barra-acoes">
          <button
            type="button"
            className="btn btn--outline admin__botao-pequeno"
            onClick={alternarSom}
            aria-pressed={som}
            title="Som ao chegar pedido novo"
          >
            {som ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {som ? "SOM LIGADO" : "SOM DESLIGADO"}
          </button>
          <button
            type="button"
            className="btn btn--outline admin__botao-pequeno"
            onClick={atualizar}
            disabled={atualizando}
          >
            <RefreshCw size={14} className={atualizando ? "is-girando" : ""} /> ATUALIZAR
          </button>
        </div>
      </div>

      {realtimeFalhou && (
        <p className="checkout__info" role="status">
          Atualização automática indisponível. Use o botão Atualizar.
        </p>
      )}
      {erro && (
        <p className="auth__msg auth__msg--erro" role="alert">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="cardapio__status" role="status">
          Carregando pedidos...
        </p>
      ) : visiveis.length === 0 ? (
        <p className="admin__vazio">Nenhum pedido em “{filtroAtual.label}”.</p>
      ) : (
        <div className="admin-pedidos__grade">
          {visiveis.map((p) => (
            <AdminPedidoCard
              key={p.id}
              pedido={p}
              novo={novos.has(p.id)}
              onVisto={() => marcarVisto(p.id)}
              onMudarStatus={async (id, status) => {
                marcarVisto(id);
                return mudarStatus(id, status);
              }}
            />
          ))}
        </div>
      )}
      {filtro === "finalizados" && !carregando && (
        <p className="checkout__info">Mostrando os {LIMITE_FINALIZADOS} últimos pedidos finalizados.</p>
      )}
    </section>
  );
}
