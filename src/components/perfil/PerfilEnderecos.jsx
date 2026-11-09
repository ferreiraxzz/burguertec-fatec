import React, { useState } from "react";
import { Plus } from "lucide-react";
import EnderecoForm, { COLUNAS_ENDERECO, textoEndereco } from "../EnderecoForm.jsx";
import ItemSalvo from "./ItemSalvo.jsx";
import { supabase } from "../../lib/supabase.js";
import { marcarPrincipal, useListaUsuario } from "../../hooks/useListaUsuario.js";

export default function PerfilEnderecos({ userId }) {
  const { itens, carregando, erro, recarregar } = useListaUsuario(
    "enderecos",
    COLUNAS_ENDERECO,
    userId,
    "Não foi possível carregar seus endereços."
  );
  // null | "novo" | id do endereço em edição (um formulário por vez)
  const [editando, setEditando] = useState(null);
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

  const tornarPrincipal = (id) =>
    executar(() => marcarPrincipal("enderecos", userId, id), "Não foi possível marcar como principal.");

  const excluir = (id) =>
    executar(
      () => supabase.from("enderecos").delete().eq("id", id).eq("usuario_id", userId),
      "Não foi possível excluir o endereço."
    );

  const salvo = async () => {
    setEditando(null);
    await recarregar();
  };

  return (
    <section className="perfil__secao" aria-labelledby="perfil-enderecos">
      <h3 id="perfil-enderecos" className="perfil__titulo">Endereços</h3>

      {carregando && <p className="checkout__info" role="status">Carregando endereços...</p>}
      {(erro || erroAcao) && (
        <p className="auth__msg auth__msg--erro" role="alert">
          {erroAcao || erro}
        </p>
      )}
      {!carregando && !erro && itens.length === 0 && editando !== "novo" && (
        <p className="checkout__info">Nenhum endereço cadastrado.</p>
      )}

      {itens.length > 0 && (
        <ul className="perfil__lista">
          {itens.map((e) =>
            editando === e.id ? (
              <li key={e.id} className="perfil__lista-form">
                <EnderecoForm endereco={e} onSaved={salvo} onCancel={() => setEditando(null)} />
              </li>
            ) : (
              <ItemSalvo
                key={e.id}
                titulo={e.apelido || "Endereço"}
                descricao={textoEndereco(e)}
                principal={e.principal}
                ocupado={ocupado}
                onPrincipal={() => tornarPrincipal(e.id)}
                onEditar={() => setEditando(e.id)}
                onExcluir={() => excluir(e.id)}
              />
            )
          )}
        </ul>
      )}

      {editando === "novo" ? (
        <EnderecoForm onSaved={salvo} onCancel={() => setEditando(null)} />
      ) : (
        !carregando && (
          <button type="button" className="checkout__link" onClick={() => setEditando("novo")}>
            <Plus size={14} /> Adicionar endereço
          </button>
        )
      )}
    </section>
  );
}
