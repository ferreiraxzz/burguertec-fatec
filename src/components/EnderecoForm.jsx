import React, { useEffect, useRef, useState } from "react";
import { MSG_SUPABASE_NAO_CONFIGURADO, supabase } from "../lib/supabase.js";

export const COLUNAS_ENDERECO =
  "id, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf, principal, created_at";

const VAZIO = {
  apelido: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

const soDigitos = (v) => v.replace(/\D/g, "");

export function formatarCep(v) {
  const d = soDigitos(v || "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function textoEndereco(e) {
  const linha1 = `${e.logradouro}, ${e.numero}${e.complemento ? ` - ${e.complemento}` : ""}`;
  return `${linha1} · ${e.bairro}, ${e.cidade}/${e.uf} · ${formatarCep(e.cep)}`;
}

function formInicial(endereco) {
  if (!endereco) return VAZIO;
  const r = {};
  for (const campo of Object.keys(VAZIO)) r[campo] = endereco[campo] ?? "";
  r.cep = formatarCep(r.cep);
  return r;
}

/**
 * Cadastro/edição de endereço com preenchimento pelo ViaCEP.
 * Sem `endereco`: insere (`usuario_id` vem do default auth.uid()). Com `endereco`: atualiza.
 */
export default function EnderecoForm({ endereco = null, onSaved, onCancel }) {
  const [form, setForm] = useState(() => formInicial(endereco));
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [avisoCep, setAvisoCep] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const buscarCep = async (cep) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBuscandoCep(true);
    setAvisoCep("");
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const d = await resp.json();
      if (d.erro) {
        setAvisoCep("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      setForm((f) => ({
        ...f,
        logradouro: d.logradouro || f.logradouro,
        bairro: d.bairro || f.bairro,
        cidade: d.localidade || f.cidade,
        uf: d.uf || f.uf,
        complemento: f.complemento || d.complemento || "",
      }));
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Erro ao consultar ViaCEP:", e?.message || e);
      setAvisoCep("Não foi possível consultar o CEP agora. Preencha o endereço manualmente.");
    } finally {
      if (abortRef.current === controller) setBuscandoCep(false);
    }
  };

  const handleCep = (e) => {
    const cep = formatarCep(e.target.value);
    setForm((f) => ({ ...f, cep }));
    const digitos = soDigitos(cep);
    if (digitos.length === 8) buscarCep(digitos);
    else setAvisoCep("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (salvando) return;
    setErro("");
    if (!supabase) {
      setErro(MSG_SUPABASE_NAO_CONFIGURADO);
      return;
    }
    const cep = soDigitos(form.cep);
    if (cep.length !== 8) {
      setErro("Informe um CEP com 8 dígitos.");
      return;
    }
    setSalvando(true);
    const limpo = (v) => v.trim() || null;
    const dados = {
      apelido: limpo(form.apelido),
      cep,
      logradouro: form.logradouro.trim(),
      numero: form.numero.trim(),
      complemento: limpo(form.complemento),
      bairro: form.bairro.trim(),
      cidade: form.cidade.trim(),
      uf: form.uf.trim().toUpperCase(),
    };
    const consulta = endereco
      ? supabase.from("enderecos").update(dados).eq("id", endereco.id)
      : supabase.from("enderecos").insert(dados);
    const { data, error } = await consulta.select(COLUNAS_ENDERECO).single();
    setSalvando(false);
    if (error) {
      console.error("Erro ao salvar endereço:", error.message);
      setErro("Não foi possível salvar o endereço. Confira os dados e tente novamente.");
      return;
    }
    onSaved?.(data);
  };

  return (
    <form className="endereco-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="end-apelido">APELIDO (opcional)</label>
        <input
          id="end-apelido"
          placeholder="Casa, Trabalho..."
          value={form.apelido}
          onChange={set("apelido")}
          maxLength={40}
        />
      </div>

      <div className="field">
        <label htmlFor="end-cep">CEP</label>
        <input
          id="end-cep"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          value={form.cep}
          onChange={handleCep}
          aria-describedby="end-cep-aviso"
          required
        />
        <span id="end-cep-aviso" className="endereco-form__aviso" role="status">
          {buscandoCep ? "Buscando endereço..." : avisoCep}
        </span>
      </div>

      <div className="field">
        <label htmlFor="end-logradouro">LOGRADOURO</label>
        <input
          id="end-logradouro"
          autoComplete="address-line1"
          value={form.logradouro}
          onChange={set("logradouro")}
          required
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="end-numero">NÚMERO</label>
          <input id="end-numero" value={form.numero} onChange={set("numero")} required />
        </div>
        <div className="field">
          <label htmlFor="end-complemento">COMPLEMENTO</label>
          <input
            id="end-complemento"
            autoComplete="address-line2"
            value={form.complemento}
            onChange={set("complemento")}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="end-bairro">BAIRRO</label>
        <input id="end-bairro" value={form.bairro} onChange={set("bairro")} required />
      </div>

      <div className="field-row endereco-form__cidade-uf">
        <div className="field">
          <label htmlFor="end-cidade">CIDADE</label>
          <input
            id="end-cidade"
            autoComplete="address-level2"
            value={form.cidade}
            onChange={set("cidade")}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="end-uf">UF</label>
          <input
            id="end-uf"
            autoComplete="address-level1"
            value={form.uf}
            onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value.toUpperCase() }))}
            maxLength={2}
            pattern="[A-Za-z]{2}"
            title="Sigla do estado com 2 letras"
            required
          />
        </div>
      </div>

      {erro && (
        <p className="auth__msg auth__msg--erro" role="alert">
          {erro}
        </p>
      )}

      <div className="endereco-form__acoes">
        {onCancel && (
          <button type="button" className="btn btn--outline" onClick={onCancel}>
            CANCELAR
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={salvando}>
          {salvando ? "SALVANDO..." : "SALVAR ENDEREÇO"}
        </button>
      </div>
    </form>
  );
}
