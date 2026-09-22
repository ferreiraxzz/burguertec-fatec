import React, { useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

export default function Cadastro({ onBack, onSwitch }) {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    cpf: "",
    senha: "",
    confirmarSenha: "",
  });
  const [showSenha, setShowSenha] = useState(false);

  const update = (campo) => (e) =>
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    // Apenas front-end: aqui entraria a chamada real de cadastro
    console.log("cadastro", form);
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
          <ArrowLeft size={14} /> Voltar ao login
        </button>

        <h2 className="auth__title">Criar conta</h2>
        <p className="auth__subtitle">Preencha seus dados para se cadastrar.</p>

        <form className="auth__form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="cad-nome">NOME COMPLETO</label>
            <input
              id="cad-nome"
              type="text"
              placeholder="João da Silva"
              value={form.nome}
              onChange={update("nome")}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="cad-email">E-MAIL</label>
            <input
              id="cad-email"
              type="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={update("email")}
              required
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="cad-telefone">TELEFONE</label>
              <input
                id="cad-telefone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={form.telefone}
                onChange={update("telefone")}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="cad-cpf">CPF</label>
              <input
                id="cad-cpf"
                type="text"
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={update("cpf")}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="cad-senha">SENHA</label>
            <div className="field__input-wrap">
              <input
                id="cad-senha"
                type={showSenha ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={form.senha}
                onChange={update("senha")}
                minLength={8}
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

          <div className="field">
            <label htmlFor="cad-confirmar">CONFIRMAR SENHA</label>
            <input
              id="cad-confirmar"
              type={showSenha ? "text" : "password"}
              placeholder="Repita a senha"
              value={form.confirmarSenha}
              onChange={update("confirmarSenha")}
              required
            />
          </div>

          <button type="submit" className="btn btn--primary btn--full">
            CRIAR CONTA
          </button>
        </form>

        <p className="auth__switch">
          Já tem uma conta?{" "}
          <button type="button" onClick={onSwitch}>
            Entrar
          </button>
        </p>
      </div>
    </div>
  );
}
