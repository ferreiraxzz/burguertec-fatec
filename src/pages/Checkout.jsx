import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Store, Truck, X } from "lucide-react";
import EnderecoForm, { COLUNAS_ENDERECO, textoEndereco } from "../components/EnderecoForm.jsx";
import { MSG_SUPABASE_NAO_CONFIGURADO, supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useListaUsuario } from "../hooks/useListaUsuario.js";
import PrecoLinha from "../components/PrecoLinha.jsx";
import QtdLinha from "../components/QtdLinha.jsx";
import {
  COLUNAS_FORMA_SALVA,
  FORMAS_PAGAMENTO,
  descreverFormaSalva,
  nomeOpcaoLinha,
  PONTO_LABEL,
  TAXA_ENTREGA_ESTIMADA,
  formatarPreco,
  montarItensPedido,
  mensagemBloqueio,
} from "../lib/pedido.js";

function useEnderecos(userId) {
  const [enderecos, setEnderecos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!userId) return;
    if (!supabase) {
      // A mensagem "Supabase não configurado" aparece junto do botão Confirmar.
      setCarregando(false);
      return;
    }
    let ativo = true;
    supabase
      .from("enderecos")
      .select(COLUNAS_ENDERECO)
      // Filtro explícito: o RLS deixa o admin ler endereços de todos os clientes.
      .eq("usuario_id", userId)
      .order("principal", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) {
          console.error("Erro ao carregar endereços:", error.message);
          setErro("Não foi possível carregar seus endereços.");
        } else {
          setEnderecos(data ?? []);
        }
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [userId]);

  return { enderecos, setEnderecos, carregando, erro };
}

function ResumoItens({ cart, cardapio, resumo, maxLinha, onAlterarQtd, onRemove }) {
  const { produtosPorId } = cardapio;
  return (
    <ul className="checkout__itens">
      {cart.map((l) => {
        const avaliacao = resumo.avaliacoes.get(l.cartId);
        return (
        <li className="checkout__item" key={l.cartId}>
          <div className="checkout__item-info">
            <span className="checkout__item-nome">
              {l.qty}x {l.nome}
            </span>
            <div className="drawer__item-detalhes">
              {nomeOpcaoLinha(l, produtosPorId) && (
                <span>{nomeOpcaoLinha(l, produtosPorId)}</span>
              )}
              {l.ponto && <span>Ponto: {PONTO_LABEL[l.ponto]}</span>}
              {l.batata && <span>+ Batata frita</span>}
              {l.obs && <span>Obs: {l.obs}</span>}
            </div>
            <QtdLinha
              qty={l.qty}
              max={maxLinha(l)}
              nome={l.nome}
              onChange={(q) => onAlterarQtd(l.cartId, q)}
            />
          </div>
          {avaliacao.bloqueia && avaliacao.estado !== "carregando" ? (
            <span className="checkout__item-acao">
              <PrecoLinha avaliacao={avaliacao} qty={l.qty} />
              <button
                type="button"
                className="drawer__item-del"
                onClick={() => onRemove(l.cartId)}
                aria-label={`Remover ${l.nome}`}
              >
                <X size={14} />
              </button>
            </span>
          ) : (
            <PrecoLinha
              avaliacao={avaliacao}
              qty={l.qty}
              modo="total"
              className="checkout__item-preco"
            />
          )}
        </li>
        );
      })}
    </ul>
  );
}

export default function Checkout({
  cart,
  cardapio,
  resumo,
  maxLinha,
  onAlterarQtd,
  onEstoqueDesatualizado,
  onBack,
  onSuccess,
  onRemove,
}) {
  const { user } = useAuth();
  const { enderecos, setEnderecos, carregando, erro: erroEnderecos } = useEnderecos(user?.id);
  const [tipo, setTipo] = useState("entrega"); // "entrega" | "retirada"
  const [enderecoId, setEnderecoId] = useState(null);
  const [novoEndereco, setNovoEndereco] = useState(false);
  const [forma, setForma] = useState("pix");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const enviandoRef = useRef(false);
  const formas = useListaUsuario(
    "formas_pagamento_salvas",
    COLUNAS_FORMA_SALVA,
    user?.id,
    "" // falha aqui não bloqueia o checkout: só não pré-seleciona
  );
  const formaPrincipal = formas.itens.find((f) => f.principal) ?? null;
  const formaEscolhidaPeloUsuario = useRef(false);

  // Pré-seleciona o endereço principal (ou o mais recente) quando a lista chega.
  useEffect(() => {
    if (carregando) return;
    if (enderecos.length === 0) setNovoEndereco(true);
    else
      setEnderecoId(
        (atual) => atual ?? (enderecos.find((e) => e.principal) ?? enderecos[0]).id
      );
  }, [carregando, enderecos]);

  // Pré-seleciona a forma de pagamento principal salva no Perfil.
  useEffect(() => {
    if (formaPrincipal && !formaEscolhidaPeloUsuario.current) setForma(formaPrincipal.tipo);
  }, [formaPrincipal]);

  const { subtotal } = resumo;
  const bloqueio = mensagemBloqueio(resumo, cart.length);
  const taxa = tipo === "entrega" ? TAXA_ENTREGA_ESTIMADA : 0;
  const faltaEndereco = tipo === "entrega" && !enderecoId;
  const podeConfirmar =
    Boolean(supabase) && !resumo.bloqueado && !faltaEndereco && !enviando;

  const handleEnderecoSalvo = (endereco) => {
    setEnderecos((lista) => [endereco, ...lista]);
    setEnderecoId(endereco.id);
    setNovoEndereco(false);
  };

  const confirmar = async () => {
    if (enviandoRef.current || !podeConfirmar) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErro("");

    const { data, error } = await supabase.rpc("criar_pedido", {
      p_itens: montarItensPedido(cart),
      p_endereco_id: tipo === "entrega" ? enderecoId : null,
      p_forma_pagamento: forma,
      p_observacao: observacao.trim() || null,
    });

    if (error) {
      console.error("Erro ao criar pedido:", error.message);
      // As mensagens da RPC já vêm em português.
      setErro(error.message || "Não foi possível finalizar o pedido. Tente novamente.");
      // Estoque mudou desde que o cardápio foi carregado: busca de novo para as linhas refletirem.
      if (/estoque insuficiente/i.test(error.message ?? "")) onEstoqueDesatualizado?.();
      enviandoRef.current = false;
      setEnviando(false);
      return;
    }
    onSuccess?.(data);
  };

  return (
    <div className="auth checkout">
      <div className="auth__header">
        <div className="auth__logo">
          BURGUER<span className="brand__accent">TEC</span>
        </div>
        <span className="auth__tagline">FINALIZAR PEDIDO</span>
      </div>

      <div className="auth__card checkout__card">
        <button type="button" className="auth__back" onClick={onBack} disabled={enviando}>
          <ArrowLeft size={14} /> Voltar
        </button>

        <h2 className="auth__title">Checkout</h2>
        <p className="auth__subtitle">Confira o pedido e escolha como quer receber.</p>

        <section className="checkout__secao" aria-labelledby="ck-resumo">
          <h3 id="ck-resumo" className="option-title">RESUMO DO PEDIDO</h3>
          {cart.length === 0 ? (
            <p className="drawer__vazio">Seu carrinho está vazio.</p>
          ) : (
            <ResumoItens
              cart={cart}
              cardapio={cardapio}
              resumo={resumo}
              maxLinha={maxLinha}
              onAlterarQtd={onAlterarQtd}
              onRemove={onRemove}
            />
          )}
        </section>

        <section className="checkout__secao" aria-labelledby="ck-tipo">
          <h3 id="ck-tipo" className="option-title">COMO VOCÊ QUER RECEBER?</h3>
          <div className="segmented checkout__tipo">
            <button
              type="button"
              className={tipo === "entrega" ? "is-active" : ""}
              aria-pressed={tipo === "entrega"}
              onClick={() => setTipo("entrega")}
            >
              <Truck size={15} /> Entrega
            </button>
            <button
              type="button"
              className={tipo === "retirada" ? "is-active" : ""}
              aria-pressed={tipo === "retirada"}
              onClick={() => setTipo("retirada")}
            >
              <Store size={15} /> Retirada no balcão
            </button>
          </div>
        </section>

        {tipo === "entrega" && (
          <section className="checkout__secao" aria-labelledby="ck-endereco">
            <h3 id="ck-endereco" className="option-title">ENDEREÇO DE ENTREGA</h3>

            {carregando && <p className="checkout__info" role="status">Carregando endereços...</p>}
            {erroEnderecos && (
              <p className="auth__msg auth__msg--erro" role="alert">
                {erroEnderecos}
              </p>
            )}

            {enderecos.length > 0 && (
              <div className="checkout__enderecos" role="radiogroup" aria-labelledby="ck-endereco">
                {enderecos.map((e) => (
                  <label
                    key={e.id}
                    className={`endereco-opcao ${enderecoId === e.id ? "endereco-opcao--ativo" : ""}`}
                  >
                    <input
                      type="radio"
                      name="endereco"
                      value={e.id}
                      checked={enderecoId === e.id}
                      onChange={() => setEnderecoId(e.id)}
                    />
                    <span className="endereco-opcao__texto">
                      <strong>{e.apelido || "Endereço"}</strong>
                      <span>{textoEndereco(e)}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            {!carregando &&
              (novoEndereco ? (
                <EnderecoForm
                  onSaved={handleEnderecoSalvo}
                  onCancel={enderecos.length > 0 ? () => setNovoEndereco(false) : undefined}
                />
              ) : (
                <button
                  type="button"
                  className="checkout__link"
                  onClick={() => setNovoEndereco(true)}
                >
                  <Plus size={14} /> Cadastrar novo endereço
                </button>
              ))}
          </section>
        )}

        <section className="checkout__secao" aria-labelledby="ck-pagamento">
          <h3 id="ck-pagamento" className="option-title">FORMA DE PAGAMENTO</h3>
          <div className="segmented">
            {FORMAS_PAGAMENTO.map((f) => (
              <button
                key={f.id}
                type="button"
                className={forma === f.id ? "is-active" : ""}
                aria-pressed={forma === f.id}
                onClick={() => {
                  formaEscolhidaPeloUsuario.current = true;
                  setForma(f.id);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {formaPrincipal && forma === formaPrincipal.tipo && (
            <p className="checkout__info">
              Sua forma principal: {formaPrincipal.apelido ? `${formaPrincipal.apelido} · ` : ""}
              {descreverFormaSalva(formaPrincipal)}
            </p>
          )}
          <p className="checkout__info">O pagamento é feito na entrega ou na retirada.</p>
        </section>

        <section className="checkout__secao">
          <label htmlFor="ck-obs-input" className="option-title">
            OBSERVAÇÃO DO PEDIDO (opcional)
          </label>
          <textarea
            id="ck-obs-input"
            className="option-textarea"
            placeholder="Ex.: troco para R$ 100, interfone quebrado..."
            maxLength={500}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </section>

        <section className="checkout__totais" aria-label="Totais estimados">
          <div className="checkout__total-linha">
            <span>Subtotal</span>
            <span>{resumo.precoCompleto ? formatarPreco(subtotal) : "a calcular"}</span>
          </div>
          <div className="checkout__total-linha">
            <span>Taxa de entrega</span>
            <span>{formatarPreco(taxa)}</span>
          </div>
          <div className="checkout__total-linha checkout__total-linha--total">
            <span>Total estimado</span>
            <strong>
              {resumo.precoCompleto ? formatarPreco(subtotal + taxa) : "a calcular"}
            </strong>
          </div>
          <p className="checkout__info">
            Valores estimados. O total final é calculado pelo sistema ao confirmar o pedido.
          </p>
        </section>

        {erro && (
          <p className="auth__msg auth__msg--erro checkout__erro" role="alert">
            {erro}
          </p>
        )}
        {!supabase && (
          <p className="auth__msg auth__msg--erro checkout__erro" role="alert">
            {MSG_SUPABASE_NAO_CONFIGURADO}
          </p>
        )}
        {cart.length > 0 && bloqueio && (
          <p
            className={`checkout__erro ${
              resumo.carregando ? "checkout__info" : "auth__msg auth__msg--erro"
            }`}
            role={resumo.carregando ? "status" : "alert"}
          >
            {bloqueio}
          </p>
        )}
        {faltaEndereco && !carregando && supabase && (
          <p className="checkout__info" role="status">
            Selecione ou cadastre um endereço para entrega.
          </p>
        )}

        <button
          type="button"
          className="btn btn--primary btn--full"
          disabled={!podeConfirmar}
          onClick={confirmar}
        >
          {enviando ? "ENVIANDO..." : "CONFIRMAR PEDIDO"}
        </button>
      </div>
    </div>
  );
}
