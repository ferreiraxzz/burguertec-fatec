import React from "react";
import { PONTO_LABEL, formatarPreco } from "../../lib/pedido.js";

/** Itens de um pedido gravado (snapshot): quantidade, opção, ponto, adicionais e obs. */
export default function ItensPedidoLista({ itens }) {
  const ordenados = [...(itens ?? [])].sort((a, b) => a.id - b.id);
  return (
    <ul className="pedido__itens">
      {ordenados.map((it) => (
        <li key={it.id} className="pedido__item">
          <div className="pedido__item-info">
            <span className="pedido__item-nome">
              {it.quantidade}x {it.nome_produto}
            </span>
            <div className="drawer__item-detalhes">
              {it.opcao_nome && <span>{it.opcao_nome}</span>}
              {it.ponto_carne && <span>Ponto: {PONTO_LABEL[it.ponto_carne]}</span>}
              {(it.itens_pedido_adicionais ?? []).map((a) => (
                <span key={a.adicional_id}>
                  + {a.adicionais?.nome || a.adicional_id} ({formatarPreco(a.preco)})
                </span>
              ))}
              {it.observacao && <span>Obs: {it.observacao}</span>}
            </div>
          </div>
          <span className="pedido__item-preco">{formatarPreco(it.subtotal)}</span>
        </li>
      ))}
    </ul>
  );
}
