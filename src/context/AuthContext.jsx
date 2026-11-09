import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { erroNaoConfigurado, supabase } from "../lib/supabase.js";

const AuthContext = createContext(null);

const ERROS = {
  "Invalid login credentials": "E-mail ou senha inválidos.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar.",
  "User already registered": "Este e-mail já está cadastrado.",
  // O trigger handle_new_user falha de propósito quando o CPF já existe (unique).
  "Database error saving new user": "Este CPF já está cadastrado.",
  "New password should be different from the old password.":
    "A nova senha precisa ser diferente da atual.",
  "Password should be at least 6 characters.": "A senha precisa ter pelo menos 6 caracteres.",
  "A user with this email address has already been registered": "Este e-mail já está cadastrado.",
  "Email address already registered by another user": "Este e-mail já está cadastrado.",
};

const MSG_LIMITE_EMAIL =
  "Muitos e-mails enviados em pouco tempo. Aguarde alguns minutos e tente de novo.";
const MSG_LIMITE_REQUISICOES = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";

/**
 * Traduz os erros de limite do Supabase Auth. Usa `error.code` quando vier
 * (supabase-js recente) e cai para o texto da mensagem.
 */
function traduzirLimite(error) {
  const code = error?.code ?? "";
  const msg = error?.message ?? "";
  if (code === "over_email_send_rate_limit" || /email rate limit/i.test(msg)) {
    return MSG_LIMITE_EMAIL;
  }
  if (code === "over_request_rate_limit" || /request rate limit/i.test(msg)) {
    return MSG_LIMITE_REQUISICOES;
  }
  // Ex.: "For security purposes, you can only request this after 42 seconds."
  const espera = msg.match(/only request this after (\d+) seconds?/i);
  if (espera) return `Por segurança, aguarde ${espera[1]} segundos antes de tentar de novo.`;
  // Qualquer outro "rate limit" sem código conhecido.
  if (/rate limit/i.test(msg)) return MSG_LIMITE_REQUISICOES;
  return null;
}

/** true para os erros de limite de envio/requisição do Supabase Auth. */
export const ehErroDeLimite = (error) => Boolean(error && traduzirLimite(error));

export function traduzirErro(error) {
  if (!error) return "";
  const msg = error.message ?? "";
  if (ERROS[msg]) return ERROS[msg];
  return traduzirLimite(error) || msg || "Algo deu errado. Tente novamente.";
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  // true depois que o usuário volta pelo link de "Esqueci minha senha".
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setCarregando(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });

    // Não chamar o supabase dentro do callback (evita deadlock); aqui só
    // atualizamos estado. O perfil é buscado no efeito abaixo.
    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSession(novaSessao);
      setCarregando(false);
      if (evento === "PASSWORD_RECOVERY") setRecuperandoSenha(true);
      if (evento === "SIGNED_OUT") setRecuperandoSenha(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const userId = user?.id;

  const [versaoPerfil, setVersaoPerfil] = useState(0);
  // Chamado pela tela Perfil depois de salvar nome/telefone/CPF.
  const recarregarPerfil = useCallback(() => setVersaoPerfil((v) => v + 1), []);

  useEffect(() => {
    if (!userId || !supabase) {
      setPerfil(null);
      return;
    }
    let ativo = true;
    supabase
      .from("perfis")
      .select("id, nome, telefone, cpf, is_admin, created_at")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) console.error("Erro ao carregar perfil:", error.message);
        setPerfil(data ?? null);
      });
    return () => {
      ativo = false;
    };
  }, [userId, versaoPerfil]);

  const signUp = useCallback(
    async ({ email, senha, nome, telefone, cpf }) => {
      if (!supabase) return erroNaoConfigurado();
      return supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: { nome, telefone, cpf },
          // O link de confirmação do e-mail volta para o site.
          emailRedirectTo: window.location.origin,
        },
      });
    },
    []
  );

  const signIn = useCallback(
    async ({ email, senha }) => {
      if (!supabase) return erroNaoConfigurado();
      return supabase.auth.signInWithPassword({ email, password: senha });
    },
    []
  );

  const concluirRecuperacao = useCallback(() => setRecuperandoSenha(false), []);

  const recuperarSenha = useCallback(async (email) => {
    if (!supabase) return erroNaoConfigurado();
    return supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return { error: null };
    return supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      perfil,
      carregando,
      signUp,
      signIn,
      signOut,
      recarregarPerfil,
      recuperandoSenha,
      concluirRecuperacao,
      recuperarSenha,
    }),
    [
      session,
      user,
      perfil,
      carregando,
      signUp,
      signIn,
      signOut,
      recarregarPerfil,
      recuperandoSenha,
      concluirRecuperacao,
      recuperarSenha,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
