import React, { useState } from "react";
import { X, Minus, Plus } from "lucide-react";
import { MAX_QTD_LINHA, formatarPreco } from "../lib/pedido.js";

const PONTOS = [
  { id: "mal", label: "Mal passado" },
  { id: "ponto", label: "Ao ponto" },
  { id: "bem", label: "Bem passado" },
];

export default function ProductModal({
  item,
  mode = "quick",
  precoBatata,
  maxQtd = MAX_QTD_LINHA,
  restam = null,
  onClose,
  onAdd,
}) {
  const [ponto, setPonto] = useState("ponto");
  const [batata, setBatata] = useState(false);
  const [obs, setObs] = useState("");
  const [qty, setQty] = useState(1);
  const [opcaoId, setOpcaoId] = useState(null);

  if (!item) return null;

  const permitePonto = item.permitePonto !== false;
  // Regra da batata: o adicional só aparece em produto que permite ponto (lanches).
  const permiteBatata = permitePonto;
  const opcoes = item.opcoes ?? [];
  const opcao = opcoes.find((o) => o.id === opcaoId) ?? null;
  // Produto com rótulo de opção cujas opções não carregaram: não dá para escolher.
  const opcoesIncompletas = Boolean(item.opcoesIncompletas);
  const faltaOpcao = opcoesIncompletas || (opcoes.length > 0 && !opcao);
  const esgotado = Boolean(item.esgotado);
  // Estoque − o que já está no carrinho (todas as linhas e opções), limitado a 99.
  const semMaisUnidades = !esgotado && maxQtd <= 0;
  const qtdEfetiva = Math.max(1, Math.min(qty, maxQtd));
  const unitPrice =
    item.preco + (opcao?.precoAdicional ?? 0) + (permiteBatata && batata ? precoBatata : 0);
  const totalPrice = unitPrice * qtdEfetiva;

  const handleAdd = () => {
    if (faltaOpcao || esgotado || semMaisUnidades) return;
    onAdd({
      menuId: item.id,
      nome: item.nome,
      img: item.img,
      qty: qtdEfetiva,
      opcaoId: opcao?.id ?? null,
      opcaoNome: opcao?.nome ?? null,
      ponto: permitePonto ? ponto : null,
      batata: permiteBatata && batata,
      obs: obs.trim(),
    });
    onClose();
  };

  const optionsProps = {
    permitePonto,
    permiteBatata,
    precoBatata,
    rotuloOpcao: item.rotuloOpcao,
    opcoes,
    opcaoId,
    setOpcaoId,
    ponto,
    setPonto,
    batata,
    setBatata,
    obs,
    setObs,
    qty: qtdEfetiva,
    setQty,
    maxQtd: Math.max(1, maxQtd),
    restam,
  };

  const isDetail = mode === "detail";

  return (
    <div className="modal-overlay modal-overlay--open" onClick={onClose}>
      <div
        className={`modal ${isDetail ? "modal--detail" : "modal--quick"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} aria-label="Fechar">
          <X size={18} />
        </button>

        <div className="modal__body">
          {isDetail ? (
            <>
              <div className="modal__photo" style={{ backgroundImage: `url(${item.img})` }} />
              <div className="modal__info">
                <h2>{item.nome}</h2>
                <p className="modal__desc">{item.desc}</p>
                <div className="modal__price">{formatarPreco(item.preco)}</div>
                <Options {...optionsProps} />
              </div>
            </>
          ) : (
            <div className="modal__info modal__info--full">
              <div className="modal__quick-head">
                <div
                  className="modal__thumb"
                  style={{ backgroundImage: `url(${item.img})` }}
                />
                <div>
                  <h3>{item.nome}</h3>
                  <span className="modal__quick-preco">{formatarPreco(item.preco)}</span>
                </div>
              </div>
              <Options {...optionsProps} />
            </div>
          )}
        </div>

        <div className="modal__footer">
          <span className="modal__total">Total: {formatarPreco(totalPrice)}</span>
          {esgotado && (
            <span className="modal__aviso modal__aviso--esgotado" role="status">
              Produto esgotado no momento.
            </span>
          )}
          {semMaisUnidades && (
            <span className="modal__aviso modal__aviso--esgotado" role="status">
              Você já tem no carrinho todas as unidades disponíveis.
            </span>
          )}
          {!esgotado && !semMaisUnidades && faltaOpcao && (
            <span className="modal__aviso" role="status">
              {opcoesIncompletas
                ? "Não foi possível carregar as opções deste produto. Tente novamente mais tarde."
                : `Escolha ${
                    item.rotuloOpcao ? `o ${item.rotuloOpcao.toLowerCase()}` : "uma opção"
                  } para adicionar.`}
            </span>
          )}
          <button className="btn btn--primary" onClick={handleAdd} disabled={faltaOpcao || esgotado || semMaisUnidades}>
            <Plus size={14} /> {esgotado ? "ESGOTADO" : "ADICIONAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Options({
  permitePonto,
  permiteBatata,
  precoBatata,
  rotuloOpcao,
  opcoes,
  opcaoId,
  setOpcaoId,
  ponto,
  setPonto,
  batata,
  setBatata,
  obs,
  setObs,
  qty,
  setQty,
  maxQtd,
  restam,
}) {
  return (
    <div className="options">
      {opcoes.length > 0 && (
        <div className="option-group">
          <span className="option-title" id="opcao-titulo">
            {(rotuloOpcao || "Opção").toUpperCase()} (obrigatório)
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="opcao-titulo">
            {opcoes.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={opcaoId === o.id}
                className={opcaoId === o.id ? "is-active" : ""}
                onClick={() => setOpcaoId(o.id)}
              >
                {o.nome}
                {o.precoAdicional > 0 && (
                  <span className="segmented__extra"> +{formatarPreco(o.precoAdicional)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {permitePonto && (
        <div className="option-group">
          <label className="option-title">PONTO DA CARNE</label>
          <div className="segmented">
            {PONTOS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={ponto === p.id ? "is-active" : ""}
                onClick={() => setPonto(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {permiteBatata && (
      <div className="option-group">
        <label className="option-title">BATATA? (+ {formatarPreco(precoBatata)})</label>
        <div className="segmented">
          <button
            type="button"
            className={batata ? "is-active" : ""}
            onClick={() => setBatata(true)}
          >
            Sim
          </button>
          <button
            type="button"
            className={!batata ? "is-active" : ""}
            onClick={() => setBatata(false)}
          >
            Não
          </button>
        </div>
      </div>
      )}

      <div className="option-group">
        <label className="option-title">
          {permitePonto ? "REMOVER ALGUM INGREDIENTE?" : "OBSERVAÇÃO"}
        </label>
        <textarea
          className="option-textarea"
          placeholder={permitePonto ? "Ex: sem cebola, sem picles..." : "Ex: sem gelo..."}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
        />
      </div>

      <div className="option-group">
        <label className="option-title">
          QUANTIDADE
          {restam !== null && restam > 0 && <span className="modal__restam"> · Restam {restam}</span>}
        </label>
        <div className="qty-control">
          <button
            type="button"
            onClick={() => setQty(Math.max(1, qty - 1))}
            aria-label="Diminuir quantidade"
          >
            <Minus size={14} />
          </button>
          <span>{qty}</span>
          <button
            type="button"
            onClick={() => setQty(Math.min(maxQtd, qty + 1))}
            disabled={qty >= maxQtd}
            aria-label="Aumentar quantidade"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
