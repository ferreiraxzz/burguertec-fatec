import React from "react";
import { formatarPreco } from "../lib/pedido.js";

/**
 * Preço de uma linha do carrinho a partir de `avaliarLinha`.
 * modo "unitario" (drawer): "2x R$ 10,00"; modo "total" (checkout): "R$ 20,00".
 */
export default function PrecoLinha({ avaliacao, qty, modo = "unitario", className }) {
  if (avaliacao.estado !== "ok") {
    return (
      <span className={`item-status item-status--${avaliacao.estado}`}>{avaliacao.texto}</span>
    );
  }
  return (
    <span className={className}>
      {modo === "total"
        ? formatarPreco(avaliacao.preco * qty)
        : `${qty}x ${formatarPreco(avaliacao.preco)}`}
    </span>
  );
}
