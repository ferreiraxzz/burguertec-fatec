import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import ImagemCampo from "./ImagemCampo.jsx";
import OpcoesEditor from "./OpcoesEditor.jsx";
import { POSICOES_IMAGEM, gerarSlug } from "./adminUtils.js";

const COLUNAS = [
  "id",
  "nome",
  "descricao",
  "categoria_id",
  "preco",
  "imagem_url",
  "imagem_posicao",
  "permite_ponto",
  "rotulo_opcao",
  "ordem",
  "ativo",
];

function formInicial(produto, categorias) {
  if (!produto) {
    return {
      id: "",
      nome: "",
      descricao: "",
      categoria_id: categorias[0]?.id ?? "",
      preco: "",
      imagem_url: "",
      imagem_posicao: "bottom",
      permite_ponto: true,
      rotulo_opcao: "",
      ordem: "0",
      ativo: true,
    };
  }
  return {
    ...Object.fromEntries(COLUNAS.map((c) => [c, produto[c] ?? ""])),
    preco: String(produto.preco ?? ""),
    ordem: String(produto.ordem ?? 0),
    permite_ponto: Boolean(produto.permite_ponto),
    ativo: Boolean(produto.ativo),
  };
}

/** Quantos itens de pedido usam o produto (decide se pode excluir). */
function useUsoEmPedidos(produtoId) {
  const [uso, setUso] = useState(null);
  useEffect(() => {
    if (!produtoId) return;
    let ativo = true;
    supabase
      .from("itens_pedido")
      .select("id", { count: "exact", head: true })
      .eq("produto_id", produtoId)
      .then(({ count, error }) => {
        if (ativo) setUso(error ? null : count ?? 0);
      });
    return () => {
      ativo = false;
    };
  }, [produtoId]);
  return uso;
}

export default function ProdutoForm({ produto, categorias, onSalvo, onExcluido, onVoltar }) {
  const criando = !produto;
  const [form, setForm] = useState(() => formInicial(produto, categorias));
  const [idManual, setIdManual] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const usoEmPedidos = useUsoEmPedidos(produto?.id);

  const set = (campo) => (e) => {
    const valor = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => {
      const novo = { ...f, [campo]: valor };
      // Na criação, o id acompanha o nome até ser editado à mão.
      if (criando && campo === "nome" && !idManual) novo.id = gerarSlug(valor);
      return novo;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    setOk("");
    const preco = Number(String(form.preco).replace(",", "."));
    if (!form.nome.trim()) return setErro("Informe o nome.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.id))
      return setErro("O id deve ter só letras minúsculas, números e hífens (ex.: smash-classico).");
    if (!(preco >= 0)) return setErro("Preço inválido.");
    if (!form.categoria_id) return setErro("Escolha a categoria.");

    // Nunca envia `estoque`: só a RPC ajustar_estoque altera essa coluna.
    const dados = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      categoria_id: Number(form.categoria_id),
      preco,
      imagem_url: form.imagem_url.trim() || null,
      imagem_posicao: form.imagem_posicao || "bottom",
      permite_ponto: form.permite_ponto,
      rotulo_opcao: form.rotulo_opcao.trim() || null,
      ordem: parseInt(form.ordem, 10) || 0,
      ativo: form.ativo,
    };

    setSalvando(true);
    const consulta = criando
      ? supabase.from("produtos").insert({ id: form.id, ...dados })
      : supabase.from("produtos").update(dados).eq("id", produto.id);
    const { data, error } = await consulta.select("*").single();
    setSalvando(false);
    if (error) {
      console.error("Erro ao salvar produto:", error.message);
      setErro(
        error.code === "23505"
          ? "Já existe um produto com esse id."
          : "Não foi possível salvar o produto. Confira os dados."
      );
      return;
    }
    setOk(criando ? "Produto criado. Agora você pode cadastrar as opções." : "Produto salvo.");
    onSalvo(data);
  };

  const excluir = async () => {
    setSalvando(true);
    const { error } = await supabase.from("produtos").delete().eq("id", produto.id);
    setSalvando(false);
    setConfirmandoExclusao(false);
    if (error) {
      console.error("Erro ao excluir produto:", error.message);
      setErro(
        error.code === "23503"
          ? "Este produto já aparece em pedidos e não pode ser excluído. Inative-o."
          : "Não foi possível excluir o produto."
      );
      return;
    }
    onExcluido(produto.id);
  };

  return (
    <div className="admin-produto">
      <button type="button" className="auth__back" onClick={onVoltar}>
        <ArrowLeft size={14} /> Voltar para a lista
      </button>
      <h3 className="perfil__titulo">{criando ? "Novo produto" : `Editar: ${produto.nome}`}</h3>

      <form className="auth__form admin-produto__form" onSubmit={handleSubmit}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="ap-nome">NOME</label>
            <input id="ap-nome" value={form.nome} onChange={set("nome")} required />
          </div>
          <div className="field">
            <label htmlFor="ap-id">ID (slug)</label>
            <input
              id="ap-id"
              value={form.id}
              onChange={(e) => {
                setIdManual(true);
                setForm((f) => ({ ...f, id: e.target.value.toLowerCase() }));
              }}
              readOnly={!criando}
              aria-describedby="ap-id-ajuda"
              required
            />
            <span id="ap-id-ajuda" className="endereco-form__aviso">
              {criando ? "Gerado do nome; só pode ser mudado agora." : "O id não muda depois de criado."}
            </span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="ap-desc">DESCRIÇÃO</label>
          <textarea
            id="ap-desc"
            className="option-textarea"
            value={form.descricao}
            onChange={set("descricao")}
          />
        </div>

        <div className="field-row admin-produto__trio">
          <div className="field">
            <label htmlFor="ap-cat">CATEGORIA</label>
            <select id="ap-cat" value={form.categoria_id} onChange={set("categoria_id")} required>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ap-preco">PREÇO (R$)</label>
            <input
              id="ap-preco"
              inputMode="decimal"
              placeholder="0,00"
              value={form.preco}
              onChange={set("preco")}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="ap-ordem">ORDEM</label>
            <input id="ap-ordem" type="number" value={form.ordem} onChange={set("ordem")} />
          </div>
        </div>

        <ImagemCampo
          valor={form.imagem_url}
          posicao={form.imagem_posicao}
          nomeBase={form.id || form.nome}
          onChange={(url) => setForm((f) => ({ ...f, imagem_url: url }))}
        />

        <div className="field-row">
          <div className="field">
            <label htmlFor="ap-pos">POSIÇÃO DA IMAGEM</label>
            <select id="ap-pos" value={form.imagem_posicao} onChange={set("imagem_posicao")}>
              {POSICOES_IMAGEM.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ap-rotulo">RÓTULO DA OPÇÃO</label>
            <input
              id="ap-rotulo"
              placeholder="Ex.: Sabor (vazio se não tiver opções)"
              value={form.rotulo_opcao}
              onChange={set("rotulo_opcao")}
            />
          </div>
        </div>

        <div className="admin-produto__checks">
          <label className="admin-check">
            <input type="checkbox" checked={form.permite_ponto} onChange={set("permite_ponto")} />
            Permite ponto da carne (e o adicional de batata)
          </label>
          <label className="admin-check">
            <input type="checkbox" checked={form.ativo} onChange={set("ativo")} />
            Ativo (aparece no cardápio)
          </label>
        </div>

        {erro && (
          <p className="auth__msg auth__msg--erro" role="alert">
            {erro}
          </p>
        )}
        {ok && (
          <p className="auth__msg auth__msg--sucesso" role="status">
            {ok}
          </p>
        )}

        <div className="endereco-form__acoes">
          <button type="submit" className="btn btn--primary" disabled={salvando}>
            {salvando ? "SALVANDO..." : criando ? "CRIAR PRODUTO" : "SALVAR"}
          </button>
        </div>
      </form>

      {!criando && <OpcoesEditor produtoId={produto.id} />}

      {!criando && (
        <div className="admin-produto__perigo">
          {usoEmPedidos === 0 ? (
            <button
              type="button"
              className="item-salvo__acao item-salvo__acao--perigo"
              onClick={() => setConfirmandoExclusao(true)}
            >
              Excluir produto
            </button>
          ) : usoEmPedidos > 0 ? (
            <p className="checkout__info">
              Este produto já aparece em {usoEmPedidos}{" "}
              {usoEmPedidos === 1 ? "item de pedido" : "itens de pedidos"}, por isso não pode ser
              excluído (o histórico dos pedidos depende dele). Para tirá-lo do cardápio, desmarque
              “Ativo” ou use Inativar na lista.
            </p>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        aberto={confirmandoExclusao}
        titulo={`Excluir “${produto?.nome}”?`}
        mensagem="O produto e as opções dele serão apagados. Não dá para desfazer."
        confirmarLabel="EXCLUIR"
        perigo
        ocupado={salvando}
        onConfirmar={excluir}
        onCancelar={() => setConfirmandoExclusao(false)}
      />
    </div>
  );
}
