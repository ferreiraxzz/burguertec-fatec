import React, { useState } from "react";
import { MSG_SUPABASE_NAO_CONFIGURADO, supabase } from "../../lib/supabase.js";
import { BANDEIRAS, FORMAS_PAGAMENTO, ehCartao } from "../../lib/pedido.js";
import { formatarValidade, soDigitos, validadeValida } from "../../lib/formatos.js";

// Segurança: este formulário NUNCA pede o número completo do cartão nem o CVV.
// Só guarda os 4 últimos dígitos como referência para o cliente.
export default function FormaPagamentoForm({ onSaved, onCancel }) {
  const [tipo, setTipo] = useState("pix");
  const [form, setForm] = useState({ apelido: "", bandeira: "", final: "", titular: "", validade: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const cartao = ehCartao(tipo);

  const set = (campo, formatar = (v) => v) => (e) =>
    setForm((f) => ({ ...f, [campo]: formatar(e.target.value) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    if (cartao) {
      if (!form.bandeira) return setErro("Escolha a bandeira do cartão.");
      if (!/^\d{4}$/.test(form.final)) return setErro("Informe só os 4 últimos dígitos do cartão.");
      if (!validadeValida(form.validade)) return setErro("Validade inválida. Use MM/AA.");
    }
    if (!supabase) return setErro(MSG_SUPABASE_NAO_CONFIGURADO);

    setSalvando(true);
    const { error } = await supabase.from("formas_pagamento_salvas").insert({
      tipo,
      apelido: form.apelido.trim() || null,
      // Para pix/dinheiro o banco exige estes campos nulos.
      bandeira: cartao ? form.bandeira : null,
      final_cartao: cartao ? form.final : null,
      titular: cartao ? form.titular.trim() || null : null,
      validade: cartao ? form.validade : null,
    });
    setSalvando(false);
    if (error) {
      console.error("Erro ao salvar forma de pagamento:", error.message);
      setErro("Não foi possível salvar a forma de pagamento. Confira os dados.");
      return;
    }
    onSaved?.();
  };

  return (
    <form className="endereco-form" onSubmit={handleSubmit} autoComplete="off">
      <div className="field">
        <span className="option-title" id="fp-tipo">TIPO</span>
        <div className="segmented" role="radiogroup" aria-labelledby="fp-tipo">
          {FORMAS_PAGAMENTO.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={tipo === f.id}
              className={tipo === f.id ? "is-active" : ""}
              onClick={() => setTipo(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="fp-apelido">APELIDO (opcional)</label>
        <input
          id="fp-apelido"
          placeholder={cartao ? "Ex.: Nubank" : "Ex.: Pix do celular"}
          maxLength={40}
          value={form.apelido}
          onChange={set("apelido")}
        />
      </div>

      {cartao && (
        <>
          <div className="field-row">
            <div className="field">
              <label htmlFor="fp-bandeira">BANDEIRA</label>
              <select id="fp-bandeira" value={form.bandeira} onChange={set("bandeira")} required>
                <option value="">Selecione</option>
                {BANDEIRAS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fp-final">ÚLTIMOS 4 DÍGITOS</label>
              <input
                id="fp-final"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0000"
                maxLength={4}
                value={form.final}
                onChange={set("final", (v) => soDigitos(v).slice(0, 4))}
                aria-describedby="fp-final-ajuda"
                required
              />
            </div>
          </div>
          <p id="fp-final-ajuda" className="endereco-form__aviso">
            Só os 4 últimos dígitos, para você reconhecer o cartão. Nunca pedimos o número completo
            nem o código de segurança.
          </p>
          <div className="field-row">
            <div className="field">
              <label htmlFor="fp-titular">TITULAR</label>
              <input
                id="fp-titular"
                autoComplete="off"
                placeholder="Nome impresso no cartão"
                value={form.titular}
                onChange={set("titular")}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="fp-validade">VALIDADE</label>
              <input
                id="fp-validade"
                inputMode="numeric"
                autoComplete="off"
                placeholder="MM/AA"
                value={form.validade}
                onChange={set("validade", formatarValidade)}
                required
              />
            </div>
          </div>
        </>
      )}

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
          {salvando ? "SALVANDO..." : "SALVAR"}
        </button>
      </div>
    </form>
  );
}
