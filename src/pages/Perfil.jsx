import React from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import PerfilResumo from "../components/perfil/PerfilResumo.jsx";
import PerfilCadastro from "../components/perfil/PerfilCadastro.jsx";
import PerfilEnderecos from "../components/perfil/PerfilEnderecos.jsx";
import PerfilPagamentos from "../components/perfil/PerfilPagamentos.jsx";

export default function Perfil({ onBack, onPedidos, recuperandoSenha, onSenhaDefinida }) {
  const { user, perfil } = useAuth();

  return (
    <div className="auth perfil">
      <div className="auth__header">
        <div className="auth__logo">
          BURGUER<span className="brand__accent">TEC</span>
        </div>
        <span className="auth__tagline">MEU PERFIL</span>
      </div>

      <div className="perfil__conteudo">
        <button type="button" className="auth__back" onClick={onBack}>
          <ArrowLeft size={14} /> Voltar ao cardápio
        </button>

        <div className="auth__card perfil__card">
          <PerfilResumo user={user} perfil={perfil} onPedidos={onPedidos} />
        </div>
        <div className="auth__card perfil__card">
          <PerfilCadastro recuperandoSenha={recuperandoSenha} onSenhaDefinida={onSenhaDefinida} />
        </div>
        <div className="auth__card perfil__card">
          <PerfilEnderecos userId={user?.id} />
        </div>
        <div className="auth__card perfil__card">
          <PerfilPagamentos userId={user?.id} />
        </div>
      </div>
    </div>
  );
}
