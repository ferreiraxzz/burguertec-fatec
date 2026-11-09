import React, { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { gerarSlug } from "./adminUtils.js";

function OpcaoLinha({ opcao, onSalvo }) {
  const [form, setForm] = useState({
    nome: opcao.nome,
    preco: String(opcao.preco_adicional ?? 0),
    ordem: String(opcao.ordem ?? 0),
  });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const alterado =
    form.nome !== opcao.nome ||
    Number(form.preco) !== Number(opcao.preco_adicional) ||
    Number(form.ordem) !== Number(opcao.ordem);

  const salvar = async (dados) => {
    setOcupado(true);
    setErro("");
    const { error } = await supabase.from("produto_opcoes").update(dados).eq("id", opcao.id);
    setOcupado(false);
    if (error) {
      console.error("Erro ao salvar opção:", error.message);
      setErro("Não foi possível salvar.");
      return;
    }
    onSalvo();
  };

  const salvarCampos = (e) => {
    e.preventDefault();
    const preco = Number(form.preco.replace(",", "."));
    if (!form.nome.trim() || !(preco >= 0)) {
      setErro("Nome e preço (≥ 0) são obrigatórios.");
      return;
    }
    salvar({ nome: form.nome.trim(), preco_adicional: preco, ordem: parseInt(form.ordem, 10) || 0 });
  };

  return (
    <li className={`admin-opcao ${opcao.ativo ? "" : "admin-opcao--inativa"}`}>
      <form className="admin-opcao__form" onSubmit={salvarCampos}>
        <input
          aria-label={`Nome da opção ${opcao.id}`}
          value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
        />
        <input
          aria-label="Preço adicional"
          inputMode="decimal"
          className="admin-opcao__numero"
          value={form.preco}
          onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))}
        />
        <input
          aria-label="Ordem"
          type="number"
          className="admin-opcao__numero"
          value={form.ordem}
          onChange={(e) => setForm((f) => ({ ...f, ordem: e.target.value }))}
        />
        <button type="submit" className="item-salvo__acao" disabled={!alterado || ocupado}>
          Salvar
        </button>
        <button
          type="button"
          className={`item-salvo__acao ${opcao.ativo ? "item-salvo__acao--perigo" : ""}`}
          disabled={ocupado}
          onClick={() => salvar({ ativo: !opcao.ativo })}
        >
          {opcao.ativo ? "Inativar" : "Ativar"}
        </button>
      </form>
      <span className="admin-opcao__id">
        {opcao.id}
        {!opcao.ativo && " · inativa"}
      </span>
      {erro && (
        <span className="admin__erro-campo" role="alert">
          {erro}
        </span>
      )}
    </li>
  );
}

/** Editor de `produto_opcoes` de um produto (inclui inativas). */
export default function OpcoesEditor({ produtoId }) {
  const [opcoes, setOpcoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [nova, setNova] = useState({ nome: "", preco: "0" });
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("produto_opcoes")
      .select("id, nome, preco_adicional, ativo, ordem")
      .eq("produto_id", produtoId)
      .order("ordem", { ascending: true });
    if (error) {
      console.error("Erro ao carregar opções:", error.message);
      setErro("Não foi possível carregar as opções.");
    } else {
      setErro("");
      setOpcoes(data ?? []);
    }
    setCarregando(false);
  }, [produtoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const idNova = `${produtoId}-${gerarSlug(nova.nome)}`;

  const adicionar = async (e) => {
    e.preventDefault();
    const preco = Number(nova.preco.replace(",", "."));
    if (!nova.nome.trim() || !(preco >= 0)) {
      setErro("Informe o nome e um preço adicional maior ou igual a zero.");
      return;
    }
    setCriando(true);
    setErro("");
    const ordem = opcoes.reduce((m, o) => Math.max(m, o.ordem ?? 0), 0) + 1;
    const { error } = await supabase.from("produto_opcoes").insert({
      id: idNova,
      produto_id: produtoId,
      nome: nova.nome.trim(),
      preco_adicional: preco,
      ordem,
      ativo: true,
    });
    setCriando(false);
    if (error) {
      console.error("Erro ao criar opção:", error.message);
      setErro(
        error.code === "23505" ? "Já existe uma opção com esse id." : "Não foi possível criar a opção."
      );
      return;
    }
    setNova({ nome: "", preco: "0" });
    carregar();
  };

  return (
    <div className="admin-opcoes">
      <h4 className="option-title">OPÇÕES (sabor, tipo...)</h4>
      <p className="endereco-form__aviso">
        Se houver ao menos uma opção ativa, o cliente é obrigado a escolher uma. Colunas: nome, preço
        adicional e ordem.
      </p>
      {carregando && <p className="checkout__info">Carregando opções...</p>}
      {erro && (
        <p className="auth__msg auth__msg--erro" role="alert">
          {erro}
        </p>
      )}
      {opcoes.length > 0 && (
        <ul className="admin-opcoes__lista">
          {opcoes.map((o) => (
            // key com valores: re-sincroniza o formulário da linha depois de salvar
            <OpcaoLinha
              key={`${o.id}-${o.nome}-${o.preco_adicional}-${o.ordem}`}
              opcao={o}
              onSalvo={carregar}
            />
          ))}
        </ul>
      )}
      <form className="admin-opcao__form admin-opcao__form--nova" onSubmit={adicionar}>
        <input
          aria-label="Nome da nova opção"
          placeholder="Nova opção (ex.: Maracujá)"
          value={nova.nome}
          onChange={(e) => setNova((n) => ({ ...n, nome: e.target.value }))}
        />
        <input
          aria-label="Preço adicional da nova opção"
          inputMode="decimal"
          className="admin-opcao__numero"
          value={nova.preco}
          onChange={(e) => setNova((n) => ({ ...n, preco: e.target.value }))}
        />
        <button type="submit" className="btn btn--outline admin__botao-pequeno" disabled={criando}>
          <Plus size={14} /> ADICIONAR
        </button>
      </form>
      {nova.nome.trim() && <span className="admin-opcao__id">id: {idNova}</span>}
    </div>
  );
}
