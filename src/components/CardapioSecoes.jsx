import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Photo from "./Photo.jsx";
import { agruparPorSecao } from "../hooks/useCardapio.js";
import { formatarPreco } from "../lib/pedido.js";
import "../styles/cardapio.css";

/** Duração da virada de página (ms). Repassada ao CSS via `--cardapio-duracao`. */
const DURACAO_VIRADA = 450;
/** Deslocamento horizontal mínimo (px) para o swipe trocar de página. */
const LIMIAR_SWIPE = 60;
/** Movimento (px) a partir do qual decidimos se o gesto é horizontal ou vertical. */
const LIMIAR_DIRECAO = 10;

/** "Acompanhamentos" -> "acompanhamentos"; "Porções & Petiscos" -> "porcoes-petiscos". */
function slug(nome) {
  return (
    String(nome ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "secao"
  );
}

function lerHash() {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "";
  }
}

/** Grava o hash sem criar entrada no histórico e sem rolar a página. */
function gravarHash(chave) {
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", `${pathname}${search}#${chave}`);
}

function usePrefereMenosMovimento() {
  const consulta = "(prefers-reduced-motion: reduce)";
  const [reduzir, setReduzir] = useState(
    () => typeof window !== "undefined" && Boolean(window.matchMedia?.(consulta).matches)
  );
  useEffect(() => {
    const mq = window.matchMedia?.(consulta);
    if (!mq) return undefined;
    const aoMudar = () => setReduzir(mq.matches);
    mq.addEventListener?.("change", aoMudar);
    return () => mq.removeEventListener?.("change", aoMudar);
  }, []);
  return reduzir;
}

/** Card de produto. `item.esgotado` (opcional) mostra o selo e bloqueia o "adicionar". */
function CardProduto({ item, onDetail, onQuick }) {
  const esgotado = Boolean(item.esgotado);
  return (
    <article className={`card${esgotado ? " card--esgotado" : ""}`}>
      <div className="card__midia">
        <button
          type="button"
          className="card__photo-btn"
          onClick={() => onDetail(item)}
          aria-label={`Ver detalhes de ${item.nome}${esgotado ? " (esgotado)" : ""}`}
        >
          <Photo src={item.img} className="card__img" pos={item.pos} />
        </button>
        {esgotado && (
          <span className="card__selo-esgotado" aria-hidden="true">
            Esgotado
          </span>
        )}
      </div>
      <h3>{item.nome}</h3>
      <p>{item.desc}</p>
      <div className="card__footer">
        <span className="card__preco">
          {item.opcoes?.some((o) => o.precoAdicional > 0) && <small className="card__a-partir">a partir de </small>}
          {formatarPreco(item.preco)}
        </span>
        {esgotado ? (
          <button type="button" className="btn btn--small" disabled aria-label={`${item.nome} esgotado`}>
            ESGOTADO
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--small"
            onClick={() => onQuick(item)}
            aria-label={`Adicionar ${item.nome}`}
          >
            <Plus size={14} aria-hidden="true" /> ADICIONAR
          </button>
        )}
      </div>
    </article>
  );
}

function GradeProdutos({ produtos, onDetail, onQuick }) {
  return (
    <div className="cardapio__grid">
      {produtos.map((item) => (
        <CardProduto key={item.id} item={item} onDetail={onDetail} onQuick={onQuick} />
      ))}
    </div>
  );
}

/**
 * Cardápio "folheável": uma seção (categoria) por vez.
 *
 * - Abas WAI-ARIA (setas, Home, End) com ativação automática.
 * - Botões anterior/próxima com o nome da seção vizinha e indicador de página.
 * - Swipe horizontal em telas de toque (pointer events; arrasto vertical é ignorado).
 * - Seção ativa refletida no hash (`#cardapio-lanches`) via `replaceState`.
 * - Altura do palco acompanha a página ativa (ResizeObserver).
 * - Com uma única seção (cardápio de fallback), mostra só a grade.
 */
export default function CardapioSecoes({ menu, onDetail, onQuick }) {
  const secoes = useMemo(() => {
    const usadas = new Set();
    return agruparPorSecao(menu).map((s) => {
      let chave = `cardapio-${slug(s.nome)}`;
      if (usadas.has(chave)) chave = `${chave}-${slug(String(s.id))}`;
      usadas.add(chave);
      return { ...s, chave };
    });
  }, [menu]);

  const multiplas = secoes.length > 1;
  const reduzirMovimento = usePrefereMenosMovimento();

  const [ativaId, setAtivaId] = useState(null);
  // Página que está saindo durante a animação: { id, dir } (dir 1 = avançou, -1 = voltou).
  const [saida, setSaida] = useState(null);
  const [altura, setAltura] = useState(null);

  const encontrado = secoes.findIndex((s) => s.id === ativaId);
  const indice = encontrado >= 0 ? encontrado : 0;
  const ativa = secoes[indice];
  const anterior = secoes[indice - 1];
  const proxima = secoes[indice + 1];

  const palcoRef = useRef(null);
  const abasRef = useRef(null);
  const abaRefs = useRef(new Map());
  const painelRefs = useRef(new Map());
  const btnAnteriorRef = useRef(null);
  const btnProximaRef = useRef(null);
  const timerSaida = useRef(null);
  const focoPendente = useRef(null);
  const hashAplicado = useRef(false);
  const gesto = useRef(null);
  const bloquearClique = useRef(false);

  useEffect(() => () => window.clearTimeout(timerSaida.current), []);

  /** Leva o topo do cardápio (abas) para a tela se ele ficou acima da janela. */
  const trazerAbasParaTela = useCallback(() => {
    const el = abasRef.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < 80) {
      el.scrollIntoView({ block: "start", behavior: reduzirMovimento ? "auto" : "smooth" });
    }
  }, [reduzirMovimento]);

  /**
   * Troca a página ativa.
   * origem: "aba" | "teclado" | "rodape" | "swipe" | "hash"
   */
  const mudarPara = (novo, origem) => {
    if (novo < 0 || novo >= secoes.length || novo === indice) return;
    const destino = secoes[novo];
    const dir = novo > indice ? 1 : -1;

    window.clearTimeout(timerSaida.current);
    if (reduzirMovimento) {
      setSaida(null);
    } else {
      setSaida({ id: ativa.id, dir });
      timerSaida.current = window.setTimeout(() => setSaida(null), DURACAO_VIRADA);
    }
    setAtivaId(destino.id);

    if (origem !== "hash") gravarHash(destino.chave);
    if (origem === "rodape" || origem === "swipe") trazerAbasParaTela();
    if (origem === "rodape") {
      // O botão clicado some na primeira/última página: o foco vai para o outro.
      if (dir > 0 && novo === secoes.length - 1) focoPendente.current = "anterior";
      if (dir < 0 && novo === 0) focoPendente.current = "proxima";
    }
  };
  const mudarRef = useRef(mudarPara);
  mudarRef.current = mudarPara;

  useEffect(() => {
    const alvo = focoPendente.current;
    if (!alvo) return;
    focoPendente.current = null;
    (alvo === "anterior" ? btnAnteriorRef : btnProximaRef).current?.focus();
  }, [indice]);

  // Hash inicial (link compartilhado). Reaplicado quando o cardápio do banco chega,
  // pois o fallback só tem "Lanches".
  useEffect(() => {
    const i = secoes.findIndex((s) => s.chave === lerHash());
    if (i < 0) return;
    setAtivaId(secoes[i].id);
    if (!hashAplicado.current) {
      hashAplicado.current = true;
      // Só rola se o usuário ainda não tiver rolado a página por conta própria.
      if (window.scrollY < 10) {
        window.requestAnimationFrame(() => abasRef.current?.scrollIntoView({ block: "start" }));
      }
    }
  }, [secoes]);

  // Hash editado à mão / navegação do histórico.
  useEffect(() => {
    const aoMudarHash = () => {
      const i = secoes.findIndex((s) => s.chave === lerHash());
      if (i >= 0) mudarRef.current(i, "hash");
    };
    window.addEventListener("hashchange", aoMudarHash);
    return () => window.removeEventListener("hashchange", aoMudarHash);
  }, [secoes]);

  // Mantém a aba ativa visível quando a lista de abas rola na horizontal (celular).
  useEffect(() => {
    const lista = abasRef.current;
    const aba = ativa && abaRefs.current.get(ativa.id);
    if (!lista || !aba) return;
    const inicio = aba.offsetLeft;
    const fim = inicio + aba.offsetWidth;
    if (inicio < lista.scrollLeft || fim > lista.scrollLeft + lista.clientWidth) {
      lista.scrollTo({ left: inicio - 16, behavior: reduzirMovimento ? "auto" : "smooth" });
    }
  }, [ativa, reduzirMovimento]);

  // Altura do palco = altura da página ativa (anima a transição de altura no CSS).
  useLayoutEffect(() => {
    if (!multiplas || !ativa) return undefined;
    const el = painelRefs.current.get(ativa.id);
    if (!el) return undefined;
    const medir = () => setAltura(el.offsetHeight);
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ativa, multiplas]);

  /* ---------------- teclado nas abas ---------------- */
  const aoTeclarAbas = (e) => {
    const n = secoes.length;
    let novo;
    if (e.key === "ArrowRight") novo = (indice + 1) % n;
    else if (e.key === "ArrowLeft") novo = (indice - 1 + n) % n;
    else if (e.key === "Home") novo = 0;
    else if (e.key === "End") novo = n - 1;
    else return;
    e.preventDefault();
    mudarPara(novo, "teclado");
    abaRefs.current.get(secoes[novo].id)?.focus();
  };

  /* ---------------- swipe (pointer events) ---------------- */
  const definirArrasto = (px) => {
    const palco = palcoRef.current;
    if (!palco) return;
    palco.style.setProperty("--arrasto", `${px}px`);
    if (px === 0) delete palco.dataset.arrastando;
    else palco.dataset.arrastando = "";
  };

  const aoPressionar = (e) => {
    bloquearClique.current = false;
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    gesto.current = { id: e.pointerId, x: e.clientX, y: e.clientY, eixo: null, dx: 0 };
  };

  const aoMover = (e) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.eixo) {
      if (Math.abs(dx) < LIMIAR_DIRECAO && Math.abs(dy) < LIMIAR_DIRECAO) return;
      g.eixo = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (g.eixo === "y") {
        gesto.current = null; // rolagem vertical: deixa o navegador cuidar
        return;
      }
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    g.dx = dx;
    if (reduzirMovimento) return;
    // Resistência nas bordas (sem página anterior/próxima).
    const semVizinha = (dx > 0 && !anterior) || (dx < 0 && !proxima);
    definirArrasto(semVizinha ? dx * 0.25 : dx);
  };

  const aoSoltar = (e) => {
    const g = gesto.current;
    gesto.current = null;
    if (!g || g.id !== e.pointerId || g.eixo !== "x") return;
    bloquearClique.current = Math.abs(g.dx) > LIMIAR_DIRECAO;
    const palco = palcoRef.current;
    const alvo = g.dx < 0 ? indice + 1 : indice - 1;
    const largura = palco?.clientWidth ?? 0;
    const limiar = Math.min(LIMIAR_SWIPE, largura * 0.2 || LIMIAR_SWIPE);
    if (Math.abs(g.dx) >= limiar && alvo >= 0 && alvo < secoes.length) {
      // A página que sai parte de onde o dedo a deixou.
      palco?.style.setProperty("--arrasto-saida", `${reduzirMovimento ? 0 : g.dx}px`);
      definirArrasto(0);
      mudarPara(alvo, "swipe");
    } else {
      definirArrasto(0);
    }
  };

  const aoCancelar = () => {
    gesto.current = null;
    definirArrasto(0);
  };

  // Um swipe que termina sobre um card não deve abrir o detalhe/adicionar.
  const aoClicarCaptura = (e) => {
    if (!bloquearClique.current) return;
    bloquearClique.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  /* ---------------- renderização ---------------- */
  if (!secoes.length) return null;

  // Uma seção só (fallback): grade simples, sem abas nem navegação.
  if (!multiplas) {
    const s = secoes[0];
    return (
      <div className="cardapio-paginas reveal">
        <section className="cardapio-paginas__unica" aria-labelledby={`${s.chave}-titulo`}>
          <h3 id={`${s.chave}-titulo`} className="cardapio-paginas__titulo">
            {s.nome}
          </h3>
          <GradeProdutos produtos={s.produtos} onDetail={onDetail} onQuick={onQuick} />
        </section>
      </div>
    );
  }

  const idAba = (s) => `${s.chave}-aba`;
  const idPainel = (s) => `${s.chave}-painel`;
  const nomeDir = saida?.dir > 0 ? "avanca" : "volta";

  return (
    // className constante: o `useReveal` do App adiciona `is-visible` direto no DOM.
    <div className="cardapio-paginas reveal">
      <div
        ref={abasRef}
        className="cardapio-paginas__abas"
        role="tablist"
        aria-label="Seções do cardápio"
        onKeyDown={aoTeclarAbas}
      >
        {secoes.map((s, i) => {
          const selecionada = i === indice;
          return (
            <button
              key={s.id}
              ref={(el) => {
                if (el) abaRefs.current.set(s.id, el);
                else abaRefs.current.delete(s.id);
              }}
              type="button"
              role="tab"
              id={idAba(s)}
              aria-selected={selecionada}
              aria-controls={idPainel(s)}
              tabIndex={selecionada ? 0 : -1}
              className={`cardapio-paginas__aba${selecionada ? " cardapio-paginas__aba--ativa" : ""}`}
              onClick={() => mudarPara(i, "aba")}
            >
              {s.nome}
            </button>
          );
        })}
      </div>

      <div
        ref={palcoRef}
        className="cardapio-paginas__palco"
        style={{
          height: altura != null ? `${altura}px` : undefined,
          "--cardapio-duracao": `${DURACAO_VIRADA}ms`,
        }}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoCancelar}
        onClickCapture={aoClicarCaptura}
      >
        {secoes.map((s, i) => {
          const ativo = i === indice;
          const saindo = !ativo && saida?.id === s.id;
          let classe = "cardapio-paginas__painel";
          if (ativo && saida) classe += ` cardapio-paginas__painel--entra-${nomeDir}`;
          if (saindo) classe += ` cardapio-paginas__painel--sai-${nomeDir}`;
          return (
            <section
              key={s.id}
              ref={(el) => {
                if (el) painelRefs.current.set(s.id, el);
                else painelRefs.current.delete(s.id);
              }}
              id={idPainel(s)}
              role="tabpanel"
              aria-labelledby={idAba(s)}
              className={classe}
              hidden={!ativo && !saindo}
              aria-hidden={saindo || undefined}
              // React 18 repassa atributos desconhecidos como string.
              inert={saindo ? "" : undefined}
            >
              <h3 className="cardapio-paginas__sr">{s.nome}</h3>
              <GradeProdutos produtos={s.produtos} onDetail={onDetail} onQuick={onQuick} />
            </section>
          );
        })}
      </div>

      <nav className="cardapio-paginas__rodape" aria-label="Páginas do cardápio">
        {anterior ? (
          <button
            ref={btnAnteriorRef}
            type="button"
            className="cardapio-paginas__nav cardapio-paginas__nav--anterior"
            onClick={() => mudarPara(indice - 1, "rodape")}
            aria-controls={idPainel(anterior)}
          >
            <ChevronLeft size={20} aria-hidden="true" />
            <span className="cardapio-paginas__nav-texto">
              <small>Anterior</small>
              <strong>{anterior.nome}</strong>
            </span>
          </button>
        ) : (
          <span aria-hidden="true" />
        )}

        <div className="cardapio-paginas__indicador">
          <span className="cardapio-paginas__bolinhas" aria-hidden="true">
            {secoes.map((s, i) => (
              <span
                key={s.id}
                className={`cardapio-paginas__bolinha${i === indice ? " cardapio-paginas__bolinha--ativa" : ""}`}
              />
            ))}
          </span>
          <span className="cardapio-paginas__contagem" aria-live="polite" aria-atomic="true">
            <span aria-hidden="true">
              {indice + 1} / {secoes.length}
            </span>
            <span className="cardapio-paginas__sr">
              {ativa.nome}, página {indice + 1} de {secoes.length}
            </span>
          </span>
        </div>

        {proxima ? (
          <button
            ref={btnProximaRef}
            type="button"
            className="cardapio-paginas__nav cardapio-paginas__nav--proxima"
            onClick={() => mudarPara(indice + 1, "rodape")}
            aria-controls={idPainel(proxima)}
          >
            <span className="cardapio-paginas__nav-texto">
              <small>Próxima</small>
              <strong>{proxima.nome}</strong>
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </nav>
    </div>
  );
}
