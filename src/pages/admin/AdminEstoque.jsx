import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { formatarDataHora } from "../../lib/pedido.js";
import { MOTIVOS_AJUSTE, MOTIVO_LABEL } from "./adminUtils.js";

const LIMITE_MOVIMENTACOES = 50;

function badgeEstoque(p) {
  if (!p.controla_estoque) return null;
  if (p.estoque <= 0) return { classe: "esgotado", texto: "Esgotado" };
  if (p.estoque <= p.estoque_minimo) return { classe: "baixo", texto: "Baixo" };
  return null;
}

/**
 * Ajuste via RPC `ajustar_estoque`. Regra do banco: entrada sempre soma e perda
 * sempre subtrai (pedimos quantidade positiva); só "ajuste" usa o sinal (+/−).
 */
function AjusteForm({ produto, onFeito, onCancelar }) {
  const [motivo, setMotivo] = useState("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const permiteNegativo = motivo === "ajuste";

  const enviar = async (e) => {
    e.preventDefault();
    setErro("");
    const qtd = Number(quantidade);
    if (!Number.isInteger(qtd) || qtd === 0) return setErro("Informe um número inteiro diferente de zero.");
    if (!permiteNegativo && qtd < 0) return setErro("Para entrada e perda, use quantidade positiva.");
    setEnviando(true);
    const { data, error } = await supabase.rpc("ajustar_estoque", {
      p_produto_id: produto.id,
      p_quantidade: qtd,
      p_motivo: motivo,
      p_observacao: observacao.trim() || null,
    });
    setEnviando(false);
    if (error) {
      setErro(error.message || "Não foi possível ajustar o estoque.");
      return;
    }
    onFeito(data);
  };

  return (
    <form className="admin-ajuste" onSubmit={enviar}>
      <div className="field">
        <label htmlFor={`aj-motivo-${produto.id}`}>MOTIVO</label>
        <select
          id={`aj-motivo-${produto.id}`}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        >
          {MOTIVOS_AJUSTE.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`aj-qtd-${produto.id}`}>
          {motivo === "entrada" ? "QUANTIDADE (+)" : motivo === "perda" ? "QUANTIDADE (−)" : "QUANTIDADE (+/−)"}
        </label>
        <input
          id={`aj-qtd-${produto.id}`}
          type="number"
          step="1"
          min={permiteNegativo ? undefined : 1}
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          required
        />
      </div>
      <div className="field admin-ajuste__obs">
        <label htmlFor={`aj-obs-${produto.id}`}>OBSERVAÇÃO</label>
        <input
          id={`aj-obs-${produto.id}`}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Opcional"
        />
      </div>
      <div className="admin-ajuste__acoes">
        <button type="button" className="btn btn--outline admin__botao-pequeno" onClick={onCancelar}>
          CANCELAR
        </button>
        <button type="submit" className="btn btn--primary admin__botao-pequeno" disabled={enviando}>
          {enviando ? "SALVANDO..." : "APLICAR"}
        </button>
      </div>
      {erro && (
        <p className="auth__msg auth__msg--erro admin-ajuste__erro" role="alert">
          {erro}
        </p>
      )}
    </form>
  );
}

function LinhaEstoque({ produto, ajustando, onAjustar, onFecharAjuste, onAtualizado }) {
  const [minimo, setMinimo] = useState(String(produto.estoque_minimo));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const badge = badgeEstoque(produto);

  // Update só de colunas liberadas; `estoque` nunca vai aqui.
  const atualizar = async (dados) => {
    setOcupado(true);
    setErro("");
    const { error } = await supabase.from("produtos").update(dados).eq("id", produto.id);
    setOcupado(false);
    if (error) {
      console.error("Erro ao atualizar estoque:", error.message);
      setErro("Não foi possível salvar.");
      return;
    }
    onAtualizado();
  };

  const salvarMinimo = () => {
    const n = Number(minimo);
    if (!Number.isInteger(n) || n < 0) {
      setErro("Mínimo deve ser um inteiro ≥ 0.");
      return;
    }
    if (n !== produto.estoque_minimo) atualizar({ estoque_minimo: n });
  };

  return (
    <li className={`admin-estoque__linha ${produto.controla_estoque ? "" : "admin-estoque__linha--sem"}`}>
      <div className="admin-estoque__nome">
        <strong>{produto.nome}</strong>
        <span>
          {produto.categorias?.nome ?? "—"}
          {!produto.ativo && " · inativo"}
        </span>
      </div>

      <label className="admin-check admin-estoque__controle">
        <input
          type="checkbox"
          checked={produto.controla_estoque}
          disabled={ocupado}
          onChange={(e) => atualizar({ controla_estoque: e.target.checked })}
        />
        Controlar
      </label>

      <div className="admin-estoque__numero">
        <span className="admin-estoque__rotulo">Atual</span>
        <strong>{produto.controla_estoque ? produto.estoque : "—"}</strong>
        {badge && <span className={`admin-selo admin-selo--${badge.classe}`}>{badge.texto}</span>}
      </div>

      <div className="admin-estoque__numero">
        <label className="admin-estoque__rotulo" htmlFor={`min-${produto.id}`}>
          Mínimo
        </label>
        <input
          id={`min-${produto.id}`}
          type="number"
          min="0"
          className="admin-estoque__minimo"
          value={minimo}
          disabled={ocupado || !produto.controla_estoque}
          onChange={(e) => setMinimo(e.target.value)}
          onBlur={salvarMinimo}
          onKeyDown={(e) => e.key === "Enter" && salvarMinimo()}
        />
      </div>

      <div className="admin-estoque__acao">
        {produto.controla_estoque && !ajustando && (
          <button type="button" className="btn btn--outline admin__botao-pequeno" onClick={onAjustar}>
            AJUSTAR
          </button>
        )}
      </div>

      {erro && (
        <p className="admin__erro-campo admin-estoque__erro" role="alert">
          {erro}
        </p>
      )}
      {ajustando && (
        <AjusteForm
          produto={produto}
          onCancelar={onFecharAjuste}
          onFeito={() => {
            onFecharAjuste();
            onAtualizado();
          }}
        />
      )}
    </li>
  );
}

function Movimentacoes({ produtos, versao }) {
  const [filtro, setFiltro] = useState("");
  const [movs, setMovs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    let consulta = supabase
      .from("movimentacoes_estoque")
      .select("id, produto_id, quantidade, motivo, pedido_id, observacao, created_at, produtos(nome)")
      .order("created_at", { ascending: false })
      .limit(LIMITE_MOVIMENTACOES);
    if (filtro) consulta = consulta.eq("produto_id", filtro);
    consulta.then(({ data, error }) => {
      if (!ativo) return;
      if (error) {
        console.error("Erro ao carregar movimentações:", error.message);
        setErro("Não foi possível carregar as movimentações.");
      } else {
        setErro("");
        setMovs(data ?? []);
      }
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [filtro, versao]);

  return (
    <div className="admin-movs">
      <div className="admin__barra">
        <h3 className="admin-secao__titulo">Últimas movimentações</h3>
        <label className="admin-movs__filtro">
          <span className="sr-only">Filtrar por produto</span>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos os produtos</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      {erro && (
        <p className="auth__msg auth__msg--erro" role="alert">
          {erro}
        </p>
      )}
      {carregando ? (
        <p className="checkout__info">Carregando...</p>
      ) : movs.length === 0 ? (
        <p className="admin__vazio">Nenhuma movimentação.</p>
      ) : (
        <div className="admin-tabela__rolagem">
          <table className="admin-tabela">
            <thead>
              <tr>
                <th scope="col">Quando</th>
                <th scope="col">Produto</th>
                <th scope="col">Qtd.</th>
                <th scope="col">Motivo</th>
                <th scope="col">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id}>
                  <td>{formatarDataHora(m.created_at)}</td>
                  <td>{m.produtos?.nome ?? m.produto_id}</td>
                  <td className={m.quantidade > 0 ? "admin-tabela__positivo" : "admin-tabela__negativo"}>
                    {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                  </td>
                  <td>{MOTIVO_LABEL[m.motivo] ?? m.motivo}</td>
                  <td>
                    {[m.pedido_id && `Pedido nº ${m.pedido_id}`, m.observacao].filter(Boolean).join(" · ") ||
                      "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminEstoque() {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [soControlados, setSoControlados] = useState(true);
  const [ajustandoId, setAjustandoId] = useState(null);
  const [versao, setVersao] = useState(0); // recarrega o histórico após mudanças

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("produtos")
      .select("id, nome, ativo, controla_estoque, estoque, estoque_minimo, categorias(nome, ordem)")
      .order("nome", { ascending: true });
    if (error) {
      console.error("Erro ao carregar estoque:", error.message);
      setErro("Não foi possível carregar o estoque.");
    } else {
      setErro("");
      const ordenados = [...(data ?? [])].sort(
        (a, b) => (a.categorias?.ordem ?? 99) - (b.categorias?.ordem ?? 99) || a.nome.localeCompare(b.nome)
      );
      setProdutos(ordenados);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const atualizado = () => {
    carregar();
    setVersao((v) => v + 1);
  };

  const visiveis = soControlados ? produtos.filter((p) => p.controla_estoque) : produtos;
  const alertas = produtos.filter((p) => badgeEstoque(p)).length;

  return (
    <section aria-label="Estoque">
      <div className="admin__barra">
        <label className="admin-check">
          <input
            type="checkbox"
            checked={soControlados}
            onChange={(e) => setSoControlados(e.target.checked)}
          />
          Mostrar só produtos com controle de estoque
        </label>
        {alertas > 0 && (
          <span className="admin-selo admin-selo--baixo">
            {alertas} {alertas === 1 ? "produto precisa" : "produtos precisam"} de atenção
          </span>
        )}
      </div>
      <p className="checkout__info">
        O estoque só muda pelo botão Ajustar, pelas vendas e pelos cancelamentos. Para ligar o
        controle de um produto, desmarque o filtro acima e marque “Controlar”.
      </p>

      {erro && (
        <p className="auth__msg auth__msg--erro" role="alert">
          {erro}
        </p>
      )}
      {carregando ? (
        <p className="cardapio__status" role="status">
          Carregando estoque...
        </p>
      ) : visiveis.length === 0 ? (
        <p className="admin__vazio">Nenhum produto com controle de estoque.</p>
      ) : (
        <ul className="admin-estoque">
          {visiveis.map((p) => (
            <LinhaEstoque
              key={`${p.id}-${p.estoque_minimo}`}
              produto={p}
              ajustando={ajustandoId === p.id}
              onAjustar={() => setAjustandoId(p.id)}
              onFecharAjuste={() => setAjustandoId(null)}
              onAtualizado={atualizado}
            />
          ))}
        </ul>
      )}

      <Movimentacoes produtos={produtos} versao={versao} />
    </section>
  );
}
