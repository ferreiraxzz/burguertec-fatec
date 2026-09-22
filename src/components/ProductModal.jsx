import React, { useState } from "react";
import { X, Minus, Plus } from "lucide-react";

const PONTOS = [
  { id: "mal", label: "Mal passado" },
  { id: "ponto", label: "Ao ponto" },
  { id: "bem", label: "Bem passado" },
];

const PRECO_BATATA = 6;

export default function ProductModal({ item, mode = "quick", onClose, onAdd }) {
  const [ponto, setPonto] = useState("ponto");
  const [batata, setBatata] = useState(false);
  const [obs, setObs] = useState("");
  const [qty, setQty] = useState(1);

  if (!item) return null;

  const unitPrice = item.preco + (batata ? PRECO_BATATA : 0);
  const totalPrice = unitPrice * qty;

  const handleAdd = () => {
    onAdd({
      menuId: item.id,
      nome: item.nome,
      img: item.img,
      precoBase: item.preco,
      qty,
      ponto,
      batata,
      obs: obs.trim(),
    });
    onClose();
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
                <div className="modal__price">R$ {item.preco}</div>
                <Options
                  ponto={ponto}
                  setPonto={setPonto}
                  batata={batata}
                  setBatata={setBatata}
                  obs={obs}
                  setObs={setObs}
                  qty={qty}
                  setQty={setQty}
                />
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
                  <span className="modal__quick-preco">R$ {item.preco}</span>
                </div>
              </div>
              <Options
                ponto={ponto}
                setPonto={setPonto}
                batata={batata}
                setBatata={setBatata}
                obs={obs}
                setObs={setObs}
                qty={qty}
                setQty={setQty}
              />
            </div>
          )}
        </div>

        <div className="modal__footer">
          <span className="modal__total">Total: R$ {totalPrice}</span>
          <button className="btn btn--primary" onClick={handleAdd}>
            <Plus size={14} /> ADICIONAR
          </button>
        </div>
      </div>
    </div>
  );
}

function Options({ ponto, setPonto, batata, setBatata, obs, setObs, qty, setQty }) {
  return (
    <div className="options">
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

      <div className="option-group">
        <label className="option-title">BATATA? (+ R$ {PRECO_BATATA})</label>
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

      <div className="option-group">
        <label className="option-title">REMOVER ALGUM INGREDIENTE?</label>
        <textarea
          className="option-textarea"
          placeholder="Ex: sem cebola, sem picles..."
          value={obs}
          onChange={(e) => setObs(e.target.value)}
        />
      </div>

      <div className="option-group">
        <label className="option-title">QUANTIDADE</label>
        <div className="qty-control">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Diminuir quantidade"
          >
            <Minus size={14} />
          </button>
          <span>{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            aria-label="Aumentar quantidade"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
