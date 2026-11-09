import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

const ToastContext = createContext(null);
const DURACAO_PADRAO = 4000;

/**
 * Avisos curtos e não bloqueantes. Uso: const { mostrar } = useToast();
 * mostrar("Texto", { tipo: "sucesso" | "info" | "erro", duracao: 4000 }).
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const fechar = useCallback((id) => setToasts((lista) => lista.filter((t) => t.id !== id)), []);

  const mostrar = useCallback((texto, { tipo = "sucesso", duracao = DURACAO_PADRAO } = {}) => {
    seq.current += 1;
    const id = seq.current;
    // Mantém no máximo 3 na tela.
    setToasts((lista) => [...lista.slice(-2), { id, texto, tipo, duracao }]);
    return id;
  }, []);

  const value = useMemo(() => ({ mostrar, fechar }), [mostrar, fechar]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Região sempre montada para leitores de tela anunciarem cada aviso. */}
      <div className="toast-regiao" role="status" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onFechar={fechar} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onFechar }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onFechar(toast.id), toast.duracao);
    return () => window.clearTimeout(timer);
  }, [toast, onFechar]);

  return (
    <div className={`toast toast--${toast.tipo}`}>
      <span className="toast__texto">{toast.texto}</span>
      <button
        type="button"
        className="toast__fechar"
        onClick={() => onFechar(toast.id)}
        aria-label="Fechar aviso"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}
