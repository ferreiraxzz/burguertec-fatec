import React, { useEffect, useId, useRef } from "react";

/**
 * Diálogo de confirmação acessível (role="alertdialog"). Foco começa em
 * "Cancelar", Tab fica preso nos botões, Esc e clique fora cancelam, e o foco
 * volta para quem abriu.
 */
export default function ConfirmDialog({
  aberto,
  titulo,
  mensagem,
  confirmarLabel = "Confirmar",
  cancelarLabel = "Cancelar",
  perigo = false,
  ocupado = false,
  onConfirmar,
  onCancelar,
}) {
  const cancelarRef = useRef(null);
  const confirmarRef = useRef(null);
  const tituloId = useId();
  const textoId = useId();

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement;
    cancelarRef.current?.focus();
    return () => anterior?.focus?.();
  }, [aberto]);

  if (!aberto) return null;

  const teclas = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (!ocupado) onCancelar();
    } else if (e.key === "Tab") {
      const botoes = [cancelarRef.current, confirmarRef.current];
      const i = botoes.indexOf(document.activeElement);
      e.preventDefault();
      botoes[(i + (e.shiftKey ? -1 : 1) + 2) % 2]?.focus();
    }
  };

  return (
    <div className="dialogo-overlay" onMouseDown={() => !ocupado && onCancelar()}>
      <div
        className="dialogo"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={mensagem ? textoId : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={teclas}
      >
        <h2 id={tituloId} className="dialogo__titulo">
          {titulo}
        </h2>
        {mensagem && (
          <p id={textoId} className="dialogo__texto">
            {mensagem}
          </p>
        )}
        <div className="dialogo__acoes">
          <button
            ref={cancelarRef}
            type="button"
            className="btn btn--outline"
            onClick={onCancelar}
            disabled={ocupado}
          >
            {cancelarLabel}
          </button>
          <button
            ref={confirmarRef}
            type="button"
            className={`btn btn--primary ${perigo ? "btn--perigo" : ""}`}
            onClick={onConfirmar}
            disabled={ocupado}
          >
            {ocupado ? "AGUARDE..." : confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
