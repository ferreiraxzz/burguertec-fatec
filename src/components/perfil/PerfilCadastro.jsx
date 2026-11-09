import React, { useEffect, useRef, useState } from "react";
import { MSG_SUPABASE_NAO_CONFIGURADO, supabase } from "../../lib/supabase.js";
import { traduzirErro, useAuth } from "../../context/AuthContext.jsx";
import { formatarCpf, formatarTelefone, soDigitos } from "../../lib/formatos.js";

function Mensagem({ msg }) {
  if (!msg) return null;
  return (
    <p
      className={`auth__msg auth__msg--${msg.tipo}`}
      role={msg.tipo === "erro" ? "alert" : "status"}
    >
      {msg.texto}
    </p>
  );
}

function DadosForm({ perfil, userId, onSalvo }) {
  const [form, setForm] = useState({
    nome: perfil?.nome ?? "",
    telefone: formatarTelefone(perfil?.telefone ?? ""),
    cpf: formatarCpf(perfil?.cpf ?? ""),
  });
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    const cpf = soDigitos(form.cpf);
    if (cpf && cpf.length !== 11) {
      setMsg({ tipo: "erro", texto: "O CPF precisa ter 11 dígitos." });
      return;
    }
    if (!supabase) {
      setMsg({ tipo: "erro", texto: MSG_SUPABASE_NAO_CONFIGURADO });
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from("perfis")
      .update({
        nome: form.nome.trim(),
        telefone: soDigitos(form.telefone) || null,
        cpf: cpf || null,
      })
      .eq("id", userId);
    setSalvando(false);
    if (error) {
      console.error("Erro ao salvar perfil:", error.message);
      setMsg({
        tipo: "erro",
        texto:
          error.code === "23505"
            ? "Este CPF já está cadastrado."
            : "Não foi possível salvar os dados. Tente novamente.",
      });
      return;
    }
    setMsg({ tipo: "sucesso", texto: "Dados atualizados." });
    onSalvo?.();
  };

  return (
    <form className="auth__form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="pf-nome">NOME</label>
        <input
          id="pf-nome"
          autoComplete="name"
          value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          required
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="pf-telefone">TELEFONE</label>
          <input
            id="pf-telefone"
            type="tel"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            value={form.telefone}
            onChange={(e) => setForm((f) => ({ ...f, telefone: formatarTelefone(e.target.value) }))}
          />
        </div>
        <div className="field">
          <label htmlFor="pf-cpf">CPF</label>
          <input
            id="pf-cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={form.cpf}
            onChange={(e) => setForm((f) => ({ ...f, cpf: formatarCpf(e.target.value) }))}
          />
        </div>
      </div>
      <Mensagem msg={msg} />
      <button type="submit" className="btn btn--primary perfil__salvar" disabled={salvando}>
        {salvando ? "SALVANDO..." : "SALVAR DADOS"}
      </button>
    </form>
  );
}

function EmailForm({ emailAtual }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    const novo = email.trim();
    if (novo.toLowerCase() === (emailAtual ?? "").toLowerCase()) {
      setMsg({ tipo: "erro", texto: "Esse já é o seu e-mail atual." });
      return;
    }
    if (!supabase) {
      setMsg({ tipo: "erro", texto: MSG_SUPABASE_NAO_CONFIGURADO });
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.updateUser(
      { email: novo },
      { emailRedirectTo: window.location.origin }
    );
    setEnviando(false);
    if (error) {
      setMsg({ tipo: "erro", texto: traduzirErro(error) });
      return;
    }
    setEmail("");
    setMsg({
      tipo: "sucesso",
      texto:
        "Enviamos um link de confirmação. A troca só vale depois que você confirmar pelo e-mail.",
    });
  };

  return (
    <form className="auth__form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="pf-email">NOVO E-MAIL</label>
        <input
          id="pf-email"
          type="email"
          autoComplete="email"
          placeholder={emailAtual}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Mensagem msg={msg} />
      <button type="submit" className="btn btn--outline perfil__salvar" disabled={enviando}>
        {enviando ? "ENVIANDO..." : "ALTERAR E-MAIL"}
      </button>
    </form>
  );
}

function SenhaForm({ recuperandoSenha, onSenhaDefinida }) {
  const senhaRef = useRef(null);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [msg, setMsg] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (senha.length < 6) {
      setMsg({ tipo: "erro", texto: "A senha precisa ter pelo menos 6 caracteres." });
      return;
    }
    if (senha !== confirmar) {
      setMsg({ tipo: "erro", texto: "As senhas não conferem." });
      return;
    }
    if (!supabase) {
      setMsg({ tipo: "erro", texto: MSG_SUPABASE_NAO_CONFIGURADO });
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      setMsg({ tipo: "erro", texto: traduzirErro(error) });
      return;
    }
    setSenha("");
    setConfirmar("");
    setMsg({ tipo: "sucesso", texto: "Senha alterada." });
    onSenhaDefinida?.();
  };

  // Veio do link de recuperação: rola até a seção de senha e foca o campo.
  useEffect(() => {
    if (!recuperandoSenha) return;
    senhaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    senhaRef.current?.focus({ preventScroll: true });
  }, [recuperandoSenha]);

  return (
    <form className="auth__form" onSubmit={handleSubmit}>
      {recuperandoSenha && (
        <p className="auth__msg auth__msg--sucesso" role="status">
          Defina sua nova senha.
        </p>
      )}
      <div className="field-row">
        <div className="field">
          <label htmlFor="pf-senha">NOVA SENHA</label>
          <input
            ref={senhaRef}
            id="pf-senha"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pf-senha2">CONFIRMAR SENHA</label>
          <input
            id="pf-senha2"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
          />
        </div>
      </div>
      <Mensagem msg={msg} />
      <button type="submit" className="btn btn--outline perfil__salvar" disabled={enviando}>
        {enviando ? "SALVANDO..." : "ALTERAR SENHA"}
      </button>
    </form>
  );
}

export default function PerfilCadastro({ recuperandoSenha, onSenhaDefinida }) {
  const { user, perfil, recarregarPerfil } = useAuth();

  return (
    <section className="perfil__secao" aria-labelledby="perfil-cadastro">
      <h3 id="perfil-cadastro" className="perfil__titulo">Editar cadastro</h3>
      {/* key: reinicia o formulário quando o perfil termina de carregar */}
      <DadosForm
        key={perfil?.id ?? "carregando"}
        perfil={perfil}
        userId={user?.id}
        onSalvo={recarregarPerfil}
      />
      <h4 className="option-title perfil__subtitulo">E-MAIL</h4>
      <EmailForm emailAtual={user?.email} />
      <h4 className="option-title perfil__subtitulo">SENHA</h4>
      <SenhaForm recuperandoSenha={recuperandoSenha} onSenhaDefinida={onSenhaDefinida} />
    </section>
  );
}
