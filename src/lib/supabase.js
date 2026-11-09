import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const MSG_SUPABASE_NAO_CONFIGURADO = "Supabase não configurado (.env)";

if (!url || !key) {
  console.error(
    "Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env"
  );
}

// null quando o .env não está configurado; quem usa precisa checar antes.
export const supabase = url && key ? createClient(url, key) : null;

/** Erro no mesmo formato do supabase-js, para as telas exibirem a mensagem. */
export const erroNaoConfigurado = () => ({
  data: null,
  error: { message: MSG_SUPABASE_NAO_CONFIGURADO },
});
