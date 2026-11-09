import React, { useState } from "react";
import { Plus } from "lucide-react";
import FormaPagamentoForm from "./FormaPagamentoForm.jsx";
import ItemSalvo from "./ItemSalvo.jsx";
import { supabase } from "../../lib/supabase.js";
import { marcarPrincipal, useListaUsuario } from "../../hooks/useListaUsuario.js";
import { COLUNAS_FORMA_SALVA, FORMA_PAGAMENTO_LABEL, descreverFormaSalva } from "../../lib/pedido.js";

export default function PerfilPagamentos({ userId }) {
  const { itens, carregando, erro, recarregar } = useListaUsuario(
    "formas_pagamento_salvas",
    COLUNAS_FORMA_SALVA,
    userId,
    "Não foi possível carregar suas formas de pagamento."
  );
  const [adicionando, setAdicionando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erroAcao, setErroAcao] = useState("");

  const executar = async (acao, mensagemErro) => {
    setOcupado(true);
    setErroAcao("");
    const { error } = await acao();
    if (error) {
      console.error(mensagemErro, error.message);
      setErroAcao(mensagemErro);
    }
    await recarregar();
    setOcupado(false);
  };

  return (
    <section className="perfil__secao" aria-labelledby="perfil-pagamentos">
      <h3 id="perfil-pagamentos" className="perfil__titulo">Formas de pagamento</h3>
      <p className="checkout__info perfil__nota">
        Atalho para o checkout. O pagamento continua sendo feito na entrega ou na retirada.
      </p>

      {carregando && <p className="checkout__info" role="status">Carregando...</p>}
      {(erro || erroAcao) && (
        <p className="auth__msg auth__msg--erro" role="alert">
          {erroAcao || erro}
        </p>
      )}
      {!carregando && !erro && itens.length === 0 && !adicionando && (
        <p className="checkout__info">Nenhuma forma de pagamento salva.</p>
      )}

      {itens.length > 0 && (
        <ul className="perfil__lista">
          {itens.map((f) => (
            <ItemSalvo
              key={f.id}
              titulo={f.apelido || FORMA_PAGAMENTO_LABEL[f.tipo]}
              descricao={descreverFormaSalva(f)}
              principal={f.principal}
              ocupado={ocupado}
              onPrincipal={() =>
                executar(
                  () => marcarPrincipal("formas_pagamento_salvas", userId, f.id),
                  "Não foi possível marcar como principal."
                )
              }
              onExcluir={() =>
                executar(
                  () =>
                    supabase
                      .from("formas_pagamento_salvas")
                      .delete()
                      .eq("id", f.id)
                      .eq("usuario_id", userId),
                  "Não foi possível excluir a forma de pagamento."
                )
              }
            />
          ))}
        </ul>
      )}

      {adicionando ? (
        <FormaPagamentoForm
          onSaved={async () => {
            setAdicionando(false);
            await recarregar();
          }}
          onCancel={() => setAdicionando(false)}
        />
      ) : (
        !carregando && (
          <button type="button" className="checkout__link" onClick={() => setAdicionando(true)}>
            <Plus size={14} /> Adicionar forma de pagamento
          </button>
        )
      )}
    </section>
  );
}
