import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Receipt, User } from "lucide-react";

/**
 * Dropdown do usuário logado no header. Fecha com clique fora, Esc, Tab e ao
 * escolher uma opção. Setas, Home e End navegam entre os itens.
 */
export default function UserMenu({ nome, onPerfil, onPedidos, onAdmin, onSair }) {
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef(null);
  const botaoRef = useRef(null);
  const itensRef = useRef([]);
  const focoInicial = useRef(0);
  const menuId = useId();

  const opcoes = [
    { id: "perfil", label: "Perfil", Icone: User, acao: onPerfil },
    { id: "pedidos", label: "Meus pedidos", Icone: Receipt, acao: onPedidos },
    // Só aparece para admin (o App passa onAdmin apenas quando perfil.is_admin).
    onAdmin && { id: "admin", label: "Administração", Icone: LayoutDashboard, acao: onAdmin },
    { id: "sair", label: "Sair", Icone: LogOut, acao: onSair },
  ].filter(Boolean);

  const abrir = (indice = 0) => {
    focoInicial.current = indice;
    setAberto(true);
  };

  const fechar = (devolverFoco = true) => {
    setAberto(false);
    if (devolverFoco) botaoRef.current?.focus();
  };

  useEffect(() => {
    if (!aberto) return;
    itensRef.current[focoInicial.current]?.focus();
    const cliqueFora = (e) => {
      if (!raizRef.current?.contains(e.target)) setAberto(false);
    };
    document.addEventListener("pointerdown", cliqueFora);
    return () => document.removeEventListener("pointerdown", cliqueFora);
  }, [aberto]);

  const teclaBotao = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      abrir(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      abrir(opcoes.length - 1);
    }
  };

  const teclaMenu = (e) => {
    const atual = itensRef.current.indexOf(document.activeElement);
    const total = opcoes.length;
    const focar = (i) => itensRef.current[(i + total) % total]?.focus();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focar(atual + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focar(atual - 1);
        break;
      case "Home":
        e.preventDefault();
        focar(0);
        break;
      case "End":
        e.preventDefault();
        focar(total - 1);
        break;
      case "Escape":
        e.preventDefault();
        fechar();
        break;
      case "Tab":
        fechar(false);
        break;
      default:
    }
  };

  const escolher = (acao) => {
    fechar(false);
    acao?.();
  };

  return (
    <div className="user-menu" ref={raizRef}>
      <button
        ref={botaoRef}
        type="button"
        className="user-menu__botao"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={menuId}
        aria-label={`Menu da conta de ${nome}`}
        onClick={() => (aberto ? fechar() : abrir(0))}
        onKeyDown={teclaBotao}
      >
        <User size={16} aria-hidden="true" />
        <span className="user-menu__nome">Olá, {nome}</span>
        <ChevronDown size={14} aria-hidden="true" className="user-menu__seta" />
      </button>

      {aberto && (
        <ul className="user-menu__lista" id={menuId} role="menu" onKeyDown={teclaMenu}>
          {opcoes.map(({ id, label, Icone, acao }, i) => (
            <li key={id} role="none">
              <button
                ref={(el) => (itensRef.current[i] = el)}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`user-menu__item ${id === "sair" ? "user-menu__item--sair" : ""}`}
                onClick={() => escolher(acao)}
              >
                <Icone size={15} aria-hidden="true" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
