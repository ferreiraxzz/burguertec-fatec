import React, { useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { ehErroDeLimite, traduzirErro, useAuth } from "../context/AuthContext.jsx";
import { MSG_SUPABASE_NAO_CONFIGURADO } from "../lib/supabase.js";

function RecuperarSenha({ emailInicial, onVoltar }) {
  const { recuperarSenha } = useAuth();
  const [email, setEmail] = useState(emailInicial);
  const [msg, setMsg] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setEnviando(true);
    const { error } = await recuperarSenha(email.trim());
    setEnviando(false);
    if (error?.message === MSG_SUPABASE_NAO_CONFIGURADO) {
      setMsg({ tipo: "erro", texto: MSG_SUPABASE_NAO_CONFIGURADO });
      return;
    }
    // Limite de envio não revela se o e-mail existe, então pode ser mostrado.
    if (ehErroDeLimite(error)) {
      setMsg({ tipo: "erro", texto: traduzirErro(error) });
      return;
    }
    // Resposta neutra: não revela se o e-mail existe. Outros erros só vão para o console.
    if (error) console.error("Erro ao pedir recuperação de senha:", error.message);
    setMsg({
      tipo: "sucesso",
      texto: "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.",
    });
  };

  return (
    <form className="auth__form" onSubmit={handleSubmit}>
      <p className="auth__subtitle auth__subtitle--colado">
        Informe seu e-mail e enviaremos um link para redefinir a senha.
      </p>
      <div className="field">
        <label htmlFor="recuperar-email">E-MAIL</label>
        <input
          id="recuperar-email"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {msg && (
        <p
          className={`auth__msg auth__msg--${msg.tipo}`}
          role={msg.tipo === "erro" ? "alert" : "status"}
        >
          {msg.texto}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--full" disabled={enviando}>
        {enviando ? "ENVIANDO..." : "ENVIAR LINK"}
      </button>
      <button type="button" className="auth__forgot auth__forgot--botao" onClick={onVoltar}>
        Voltar para o login
      </button>
    </form>
  );
}

export default function Login({ onBack, onSwitch, onSuccess }) {
  const { signIn } = useAuth();
  const [recuperando, setRecuperando] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const { error } = await signIn({ email: email.trim(), senha });
    setEnviando(false);
    if (error) {
      setErro(traduzirErro(error));
      return;
    }
    onSuccess?.();
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

        <h2 className="auth__title">{recuperando ? "Esqueci minha senha" : "Entrar"}</h2>
        {!recuperando && <p className="auth__subtitle">Bem-vindo de volta!</p>}

        {recuperando ? (
          <RecuperarSenha emailInicial={email} onVoltar={() => setRecuperando(false)} />
        ) : (
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

          <button
            type="button"
            className="auth__forgot auth__forgot--botao"
            onClick={() => setRecuperando(true)}
          >
            Esqueci minha senha
          </button>

          {erro && (
            <p className="auth__msg auth__msg--erro" role="alert">
              {erro}
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--full" disabled={enviando}>
            {enviando ? "ENTRANDO..." : "ENTRAR"}
          </button>
        </form>
        )}

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
