import React, { useState } from "react";
import { Phone } from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import StatusTimeline from "../../components/pedido/StatusTimeline.jsx";
import ItensPedidoLista from "../../components/pedido/ItensPedidoLista.jsx";
import {
  FORMA_PAGAMENTO_LABEL,
  PROXIMO_STATUS,
  ehRetirada,
  formatarDataHora,
  formatarPreco,
  rotuloStatus,
  statusFinalizado,
  textoEnderecoEntrega,
} from "../../lib/pedido.js";
import { formatarTelefone } from "../../lib/formatos.js";

export default function AdminPedidoCard({ pedido, novo, onMudarStatus, onVisto }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const retirada = ehRetirada(pedido);
  const proximo = PROXIMO_STATUS[pedido.status];
  const finalizado = statusFinalizado(pedido.status);
  const cliente = pedido.perfis;

  const mudar = async (status) => {
    setOcupado(true);
    setErro("");
    // Mensagens do trigger (ex.: "Pedido já finalizado.") aparecem como vierem.
    const mensagem = await onMudarStatus(pedido.id, status);
    setOcupado(false);
    setConfirmandoCancelamento(false);
    if (mensagem) setErro(mensagem);
  };

  return (
    <article
      className={`admin-pedido admin-pedido--${pedido.status} ${novo ? "admin-pedido--novo" : ""}`}
      onFocusCapture={novo ? onVisto : undefined}
      onPointerDown={novo ? onVisto : undefined}
    >
      <header className="admin-pedido__topo">
        <div>
          <h3 className="admin-pedido__numero">
            Nº {pedido.id}
            {novo && <span className="admin-pedido__novo">NOVO</span>}
          </h3>
          <time className="pedido__data" dateTime={pedido.created_at}>
            {formatarDataHora(pedido.created_at)}
          </time>
        </div>
        <span className={`status-badge status-badge--${pedido.status}`}>
          {rotuloStatus(pedido.status, retirada)}
        </span>
      </header>

      <div className="admin-pedido__cliente">
        <strong>{cliente?.nome || "Cliente"}</strong>
        {cliente?.telefone && (
          <a href={`tel:${cliente.telefone}`} className="admin-pedido__telefone">
            <Phone size={12} aria-hidden="true" /> {formatarTelefone(cliente.telefone)}
          </a>
        )}
      </div>

      <StatusTimeline
        status={pedido.status}
        retirada={retirada}
        historico={pedido.pedidos_status_historico}
      />

      <dl className="pedido__meta">
        <div>
          <dt>{retirada ? "Retirada" : "Entrega"}</dt>
          <dd>{retirada ? "Retirada no balcão" : textoEnderecoEntrega(pedido.endereco_entrega)}</dd>
        </div>
        <div>
          <dt>Pagamento</dt>
          <dd>{FORMA_PAGAMENTO_LABEL[pedido.forma_pagamento] || pedido.forma_pagamento}</dd>
        </div>
      </dl>

      <ItensPedidoLista itens={pedido.itens_pedido} />

      {pedido.observacao && <p className="admin-pedido__obs">Obs. do pedido: {pedido.observacao}</p>}

      <div className="pedido__totais">
        <strong>Total {formatarPreco(pedido.total)}</strong>
      </div>

      {erro && (
        <p className="auth__msg auth__msg--erro" role="alert">
          {erro}
        </p>
      )}

      {!finalizado && (
        <div className="admin-pedido__acoes">
          {proximo && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={ocupado}
              onClick={() => mudar(proximo)}
            >
              {ocupado ? "SALVANDO..." : `Avançar para ${rotuloStatus(proximo, retirada)}`}
            </button>
          )}
          <button
            type="button"
            className="btn btn--outline admin-pedido__cancelar"
            disabled={ocupado}
            onClick={() => setConfirmandoCancelamento(true)}
          >
            Cancelar
          </button>
        </div>
      )}

      <ConfirmDialog
        aberto={confirmandoCancelamento}
        titulo={`Cancelar o pedido nº ${pedido.id}?`}
        mensagem="Os itens com controle de estoque voltam para o estoque. Não dá para desfazer."
        confirmarLabel="CANCELAR PEDIDO"
        cancelarLabel="VOLTAR"
        perigo
        ocupado={ocupado}
        onConfirmar={() => mudar("cancelado")}
        onCancelar={() => setConfirmandoCancelamento(false)}
      />
    </article>
  );
}
