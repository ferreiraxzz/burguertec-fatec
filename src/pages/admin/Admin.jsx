import React, { useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import AdminPedidos from "./AdminPedidos.jsx";
import AdminCardapio from "./AdminCardapio.jsx";
import AdminEstoque from "./AdminEstoque.jsx";
import "../../styles/admin.css";

const ABAS = [
  { id: "pedidos", label: "Pedidos", Componente: AdminPedidos },
  { id: "cardapio", label: "Cardápio", Componente: AdminCardapio },
  { id: "estoque", label: "Estoque", Componente: AdminEstoque },
];

export default function Admin({ onBack }) {
  const { perfil } = useAuth();
  const [aba, setAba] = useState("pedidos");
  const abasRef = useRef([]);

  // Setas esquerda/direita, Home e End entre as abas (padrão WAI-ARIA tabs).
  const teclaAba = (e) => {
    const i = ABAS.findIndex((a) => a.id === aba);
    const mapa = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ABAS.length - 1 };
    if (!(e.key in mapa)) return;
    e.preventDefault();
    const novo = (mapa[e.key] + ABAS.length) % ABAS.length;
    setAba(ABAS[novo].id);
    abasRef.current[novo]?.focus();
  };

  const cabecalho = (
    <div className="admin__topo">
      <button type="button" className="auth__back" onClick={onBack}>
        <ArrowLeft size={14} /> Voltar ao site
      </button>
      <h2 className="admin__titulo">Administração</h2>
    </div>
  );

  // A segurança real é o RLS; isto só evita mostrar a tela para quem não é admin.
  if (!perfil) {
    return (
      <div className="admin">
        {cabecalho}
        <p className="cardapio__status" role="status">
          Carregando perfil...
        </p>
      </div>
    );
  }
  if (!perfil.is_admin) {
    return (
      <div className="admin">
        {cabecalho}
        <div className="admin__restrito" role="alert">
          <h3>Acesso restrito</h3>
          <p>Esta área é só para a equipe da BURGUERTEC.</p>
        </div>
      </div>
    );
  }

  const Ativa = ABAS.find((a) => a.id === aba).Componente;

  return (
    <div className="admin">
      {cabecalho}
      <div className="admin__abas" role="tablist" aria-label="Seções da administração">
        {ABAS.map((a, i) => (
          <button
            key={a.id}
            ref={(el) => (abasRef.current[i] = el)}
            type="button"
            role="tab"
            id={`admin-aba-${a.id}`}
            aria-selected={aba === a.id}
            aria-controls={`admin-painel-${a.id}`}
            tabIndex={aba === a.id ? 0 : -1}
            className={`admin__aba ${aba === a.id ? "admin__aba--ativa" : ""}`}
            onClick={() => setAba(a.id)}
            onKeyDown={teclaAba}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div
        className="admin__painel"
        role="tabpanel"
        id={`admin-painel-${aba}`}
        aria-labelledby={`admin-aba-${aba}`}
      >
        <Ativa />
      </div>
    </div>
  );
}
