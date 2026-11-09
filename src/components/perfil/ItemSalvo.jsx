import React, { useState } from "react";

/** Linha de endereço/forma de pagamento com ações: principal, editar e excluir (com confirmação). */
export default function ItemSalvo({ titulo, descricao, principal, ocupado, onPrincipal, onEditar, onExcluir }) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <li className={`item-salvo ${principal ? "item-salvo--principal" : ""}`}>
      <div className="item-salvo__texto">
        <strong>
          {titulo}
          {principal && <span className="item-salvo__selo">Principal</span>}
        </strong>
        {descricao && <span>{descricao}</span>}
      </div>

      {confirmando ? (
        <div className="item-salvo__acoes" role="group" aria-label="Confirmar exclusão">
          <span className="item-salvo__pergunta">Excluir?</span>
          <button
            type="button"
            className="item-salvo__acao item-salvo__acao--perigo"
            disabled={ocupado}
            onClick={async () => {
              await onExcluir();
              setConfirmando(false);
            }}
          >
            Sim, excluir
          </button>
          <button type="button" className="item-salvo__acao" onClick={() => setConfirmando(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="item-salvo__acoes">
          {!principal && (
            <button type="button" className="item-salvo__acao" disabled={ocupado} onClick={onPrincipal}>
              Tornar principal
            </button>
          )}
          {onEditar && (
            <button type="button" className="item-salvo__acao" disabled={ocupado} onClick={onEditar}>
              Editar
            </button>
          )}
          <button
            type="button"
            className="item-salvo__acao item-salvo__acao--perigo"
            disabled={ocupado}
            onClick={() => setConfirmando(true)}
          >
            Excluir
          </button>
        </div>
      )}
    </li>
  );
}
