import React, { useId, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { BUCKET_PRODUTOS, MAX_IMAGEM_BYTES, TIPOS_IMAGEM, gerarSlug } from "./adminUtils.js";

/** Imagem do produto: upload para o Storage (bucket `produtos`) ou URL colada, com preview. */
export default function ImagemCampo({ valor, posicao, nomeBase, onChange }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const inputRef = useRef(null);
  const id = useId();

  const enviar = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    setErro("");
    const extensao = TIPOS_IMAGEM[arquivo.type];
    if (!extensao) {
      setErro("Formato não aceito. Use JPEG, PNG ou WebP.");
      return;
    }
    if (arquivo.size > MAX_IMAGEM_BYTES) {
      setErro("A imagem passa de 2 MB. Reduza o arquivo e tente de novo.");
      return;
    }
    setEnviando(true);
    // Nome único: evita sobrescrever e problemas de cache da CDN.
    const unico =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const caminho = `${gerarSlug(nomeBase) || "produto"}-${unico}.${extensao}`;
    const { error } = await supabase.storage.from(BUCKET_PRODUTOS).upload(caminho, arquivo, {
      contentType: arquivo.type,
      cacheControl: "31536000",
      upsert: false,
    });
    setEnviando(false);
    if (error) {
      console.error("Erro no upload:", error.message);
      setErro("Não foi possível enviar a imagem. Tente de novo.");
      return;
    }
    const { data } = supabase.storage.from(BUCKET_PRODUTOS).getPublicUrl(caminho);
    onChange(data.publicUrl);
  };

  return (
    <div className="field">
      <label htmlFor={`${id}-url`}>IMAGEM</label>
      <div className="admin-imagem">
        <div
          className="admin-imagem__preview"
          role="img"
          aria-label={valor ? "Pré-visualização da imagem" : "Sem imagem"}
          style={
            valor
              ? { backgroundImage: `url(${valor})`, backgroundPosition: posicao || "bottom" }
              : undefined
          }
        >
          {!valor && <span>Sem imagem</span>}
        </div>
        <div className="admin-imagem__campos">
          <input
            id={`${id}-url`}
            type="url"
            placeholder="https://... (ou envie um arquivo)"
            value={valor}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="admin-imagem__arquivo"
            onChange={enviar}
            tabIndex={-1}
            aria-hidden="true"
          />
          <button
            type="button"
            className="btn btn--outline admin__botao-pequeno"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
          >
            <Upload size={14} /> {enviando ? "ENVIANDO..." : "ENVIAR ARQUIVO"}
          </button>
          <span className="endereco-form__aviso">JPEG, PNG ou WebP, até 2 MB.</span>
          {erro && (
            <span className="admin__erro-campo" role="alert">
              {erro}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
