import React from "react";
import { Minus, Plus } from "lucide-react";

/** Controle −/+ da quantidade de uma linha do carrinho (mínimo 1, máximo `max`). */
export default function QtdLinha({ qty, max, nome, onChange }) {
  const podeAumentar = qty < max;
  return (
    <div className="qtd-linha" role="group" aria-label={`Quantidade de ${nome}`}>
      <button
        type="button"
        className="qtd-linha__botao"
        onClick={() => onChange(qty - 1)}
        disabled={qty <= 1}
        aria-label={`Diminuir ${nome}`}
      >
        <Minus size={12} />
      </button>
      <span className="qtd-linha__valor" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="qtd-linha__botao"
        onClick={() => onChange(qty + 1)}
        disabled={!podeAumentar}
        aria-label={`Aumentar ${nome}`}
        title={podeAumentar ? undefined : "Limite de estoque ou de 99 unidades"}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
