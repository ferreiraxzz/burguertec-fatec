import React, { useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

export default function Login({ onBack, onSwitch }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Apenas front-end: aqui entraria a chamada real de autenticação
    console.log("login", { email, senha });
  };

  return (
    <div className="auth">
      <div className="auth__header">
        <div className="auth__logo">
          BURGUER<span className="brand__accent">TEC</span>
        </div>
        <span className="auth__tagline">ÁREA DO CLIENTE</span>
      </div>

      <div className="auth__card">
        <button type="button" className="auth__back" onClick={onBack}>
          <ArrowLeft size={14} /> Voltar
        </button>

        <h2 className="auth__title">Entrar</h2>
        <p className="auth__subtitle">Bem-vindo de volta!</p>

        <form className="auth__form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">E-MAIL</label>
            <input
              id="login-email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="login-senha">SENHA</label>
            <div className="field__input-wrap">
              <input
                id="login-senha"
                type={showSenha ? "text" : "password"}
                placeholder="********"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
              <button
                type="button"
                className="field__toggle"
                onClick={() => setShowSenha((v) => !v)}
                aria-label="Mostrar senha"
              >
                {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <a
            href="#"
            className="auth__forgot"
            onClick={(e) => e.preventDefault()}
          >
            Esqueci minha senha
          </a>

          <button type="submit" className="btn btn--primary btn--full">
            ENTRAR
          </button>
        </form>

        <p className="auth__switch">
          Não tem uma conta?{" "}
          <button type="button" onClick={onSwitch}>
            Criar conta
          </button>
        </p>
      </div>
    </div>
  );
}
