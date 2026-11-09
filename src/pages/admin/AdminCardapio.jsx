import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { formatarPreco } from "../../lib/pedido.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import ProdutoForm from "./ProdutoForm.jsx";
import { gerarSlug } from "./adminUtils.js";

const COLUNAS_PRODUTO =
  "id, nome, descricao, categoria_id, preco, imagem_url, imagem_posicao, permite_ponto, rotulo_opcao, ordem, ativo";

export default function AdminCardapio() {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState(null); // null | "novo" | id do produto
  const [alternando, setAlternando] = useState(null); // produto aguardando confirmação
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const [prod, cat] = await Promise.all([
      // Admin lê também os inativos (policy de admin).
      supabase.from("produtos").select(COLUNAS_PRODUTO).order("ordem", { ascending: true }),
      supabase.from("categorias").select("id, nome, ordem").order("ordem", { ascending: true }),
    ]);
    if (prod.error || cat.error) {
      console.error("Erro ao carregar cardápio (admin):", (prod.error || cat.error).message);
      setErro("Não foi possível carregar o cardápio.");
    } else {
      setErro("");
      setProdutos(prod.data ?? []);
      setCategorias(cat.data ?? []);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const secoes = useMemo(() => {
    const termo = gerarSlug(busca);
    const filtrados = termo
      ? produtos.filter((p) => gerarSlug(p.nome).includes(termo) || p.id.includes(termo))
      : produtos;
    const grupos = categorias.map((c) => ({
      ...c,
      produtos: filtrados.filter((p) => p.categoria_id === c.id),
    }));
    const semCategoria = filtrados.filter((p) => !categorias.some((c) => c.id === p.categoria_id));
    if (semCategoria.length) grupos.push({ id: "sem", nome: "Sem categoria", produtos: semCategoria });
    return grupos.filter((g) => g.produtos.length > 0);
  }, [produtos, categorias, busca]);

  const alternarAtivo = async () => {
    const p = alternando;
    setOcupado(true);
    const { error } = await supabase.from("produtos").update({ ativo: !p.ativo }).eq("id", p.id);
    setOcupado(false);
    setAlternando(null);
    if (error) {
      console.error("Erro ao alterar produto:", error.message);
      setErro(`Não foi possível ${p.ativo ? "inativar" : "ativar"} “${p.nome}”.`);
      return;
    }
    carregar();
  };

  if (editando) {
    const produto = editando === "novo" ? null : produtos.find((p) => p.id === editando);
    return (
      <ProdutoForm
        // key: troca de "novo" para o produto criado remonta o formulário em modo edição
        key={editando}
        produto={produto}
        categorias={categorias}
        onVoltar={() => setEditando(null)}
        onSalvo={async (salvo) => {
          await carregar();
          setEditando(salvo.id);
        }}
        onExcluido={async () => {
          setEditando(null);
          await carregar();
        }}
      />
    );
  }

  return (
    <section aria-label="Cardápio">
      <div className="admin__barra">
        <label className="admin-busca">
          <Search size={14} aria-hidden="true" />
          <span className="sr-only">Buscar produto</span>
          <input
            type="search"
            placeholder="Buscar por nome ou id"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn--primary admin__botao-pequeno"
          onClick={() => setEditando("novo")}
          disabled={carregando || categorias.length === 0}
        >
          <Plus size={14} /> NOVO PRODUTO
        </button>
      </div>

      {erro && (
        <p className="auth__msg auth__msg--erro" role="alert">
          {erro}
        </p>
      )}
      {carregando && (
        <p className="cardapio__status" role="status">
          Carregando cardápio...
        </p>
      )}
      {!carregando && secoes.length === 0 && (
        <p className="admin__vazio">Nenhum produto encontrado.</p>
      )}

      {secoes.map((s) => (
        <div key={s.id} className="admin-secao">
          <h3 className="admin-secao__titulo">{s.nome}</h3>
          <ul className="admin-produtos">
            {s.produtos.map((p) => (
              <li key={p.id} className={`admin-produtos__item ${p.ativo ? "" : "admin-produtos__item--inativo"}`}>
                <div
                  className="admin-produtos__img"
                  style={
                    p.imagem_url
                      ? { backgroundImage: `url(${p.imagem_url})`, backgroundPosition: p.imagem_posicao || "bottom" }
                      : undefined
                  }
                  aria-hidden="true"
                />
                <div className="admin-produtos__info">
                  <strong>
                    {p.nome}
                    {!p.ativo && <span className="admin-selo admin-selo--inativo">Inativo</span>}
                  </strong>
                  <span>
                    {p.id} · {formatarPreco(p.preco)}
                    {p.rotulo_opcao ? ` · opções: ${p.rotulo_opcao}` : ""}
                  </span>
                </div>
                <div className="admin-produtos__acoes">
                  <button type="button" className="item-salvo__acao" onClick={() => setEditando(p.id)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className={`item-salvo__acao ${p.ativo ? "item-salvo__acao--perigo" : ""}`}
                    onClick={() => setAlternando(p)}
                  >
                    {p.ativo ? "Inativar" : "Ativar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <ConfirmDialog
        aberto={Boolean(alternando)}
        titulo={alternando?.ativo ? `Inativar “${alternando?.nome}”?` : `Ativar “${alternando?.nome}”?`}
        mensagem={
          alternando?.ativo
            ? "O produto sai do cardápio, mas continua nos pedidos antigos. Dá para reativar depois."
            : "O produto volta a aparecer no cardápio."
        }
        confirmarLabel={alternando?.ativo ? "INATIVAR" : "ATIVAR"}
        perigo={alternando?.ativo}
        ocupado={ocupado}
        onConfirmar={alternarAtivo}
        onCancelar={() => setAlternando(null)}
      />
    </section>
  );
}
