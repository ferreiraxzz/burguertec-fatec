import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShoppingBag, X } from "lucide-react";
import ProductModal from "./components/ProductModal.jsx";
import Photo from "./components/Photo.jsx";
import UserMenu from "./components/UserMenu.jsx";
import CardapioSecoes from "./components/CardapioSecoes.jsx";
import PrecoLinha from "./components/PrecoLinha.jsx";
import QtdLinha from "./components/QtdLinha.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import { useToast } from "./components/Toast.jsx";
import Login from "./pages/Login.jsx";
import Cadastro from "./pages/Cadastro.jsx";
import Checkout from "./pages/Checkout.jsx";
import MeusPedidos from "./pages/MeusPedidos.jsx";
import Perfil from "./pages/Perfil.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useCardapio } from "./hooks/useCardapio.js";
import {
  MAX_LINHAS,
  MAX_QTD_LINHA,
  PONTO_LABEL,
  estoqueBaixo,
  formatarPreco,
  linhasIguais,
  maxAdicionavel,
  mensagemBloqueio,
  qtdProdutoNoCarrinho,
  nomeOpcaoLinha,
  resumirCarrinho,
} from "./lib/pedido.js";
import "./App.css";

// A área administrativa (e o CSS dela) só é baixada quando um admin abre a tela.
const Admin = lazy(() => import("./pages/admin/Admin.jsx"));

const CHAVE_CARRINHO = "burguertec:carrinho";

function lerCarrinho() {
  try {
    const salvo = JSON.parse(window.localStorage.getItem(CHAVE_CARRINHO));
    if (!Array.isArray(salvo)) return [];
    // Descarta linhas corrompidas/antigas que quebrariam o carrinho ou a RPC.
    return salvo.filter(
      (l) =>
        l &&
        typeof l === "object" &&
        typeof l.menuId === "string" &&
        l.menuId &&
        typeof l.cartId === "string" &&
        Number.isInteger(l.qty) &&
        l.qty > 0 &&
        l.qty <= MAX_QTD_LINHA &&
        (l.opcaoId == null || typeof l.opcaoId === "string")
    );
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Scroll reveal                                                        */
/* ------------------------------------------------------------------ */
function useReveal(rootRef, deps = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll(".reveal:not(.is-visible)");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [rootRef, ...deps]);
}

export default function App() {
  const { user, perfil, signOut, recuperandoSenha, concluirRecuperacao } = useAuth();
  const {
    menu,
    precoBatata,
    status: statusCardapio,
    carregando,
    erro: erroCardapio,
    recarregar: recarregarCardapio,
  } = useCardapio();
  const [cart, setCart] = useState(lerCarrinho);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [modalMode, setModalMode] = useState("quick");
  const [authView, setAuthView] = useState(null);
  const [tela, setTela] = useState(null); // null (home) | "checkout" | "pedidos" | "perfil"
  const [pedidoDestaque, setPedidoDestaque] = useState(null);
  const [avisoCarrinho, setAvisoCarrinho] = useState("");
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const { mostrar: mostrarToast } = useToast();

  const rootRef = useRef(null);
  // Valor atual do usuário para callbacks assíncronos (ex.: retorno da RPC).
  const userRef = useRef(user);
  userRef.current = user;
  const cardapioRef = useRef(null);
  const sobreRef = useRef(null);

  useReveal(rootRef, [menu]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(cart));
    } catch {
      /* localStorage indisponível (modo privado, cota cheia): segue só em memória */
    }
  }, [cart]);

  // Link de "Esqueci minha senha": abre o Perfil na seção de senha.
  useEffect(() => {
    if (recuperandoSenha && user) {
      setAuthView(null);
      setDrawerOpen(false);
      setTela("perfil");
    }
  }, [recuperandoSenha, user]);

  // Logout com checkout/pedidos abertos: volta para a home.
  useEffect(() => {
    if (!user) {
      setTela(null);
      setPedidoDestaque(null);
    }
  }, [user]);

  const scrollTo = useCallback((ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const openQuick = useCallback((item) => {
    setModalItem(item);
    setModalMode("quick");
  }, []);

  const openDetail = useCallback((item) => {
    setModalItem(item);
    setModalMode("detail");
  }, []);

  const closeModal = useCallback(() => setModalItem(null), []);

  const bumpTimer = useRef(null);
  // Junta com uma linha idêntica (mesmo produto, opção, ponto, batata e obs) e
  // respeita os limites da RPC: 99 unidades por linha e 50 linhas.
  // e o estoque: o total do produto (todas as linhas e opções) não passa do disponível.
  const handleAdd = (payload) => {
    const produto = produtosPorId.get(payload.menuId);
    const igual = cart.find((l) => linhasIguais(l, payload));
    const disponivel = Math.min(
      maxAdicionavel(produto, cart),
      MAX_QTD_LINHA - (igual?.qty ?? 0)
    );
    if (disponivel <= 0) {
      setAvisoCarrinho(
        produto?.controlaEstoque && qtdProdutoNoCarrinho(cart, payload.menuId) >= produto.estoque
          ? `Você já tem no carrinho todas as unidades disponíveis de ${payload.nome}.`
          : `Limite de ${MAX_QTD_LINHA} unidades por item para ${payload.nome}.`
      );
      setDrawerOpen(true);
      return;
    }
    const adicionar = Math.min(payload.qty, disponivel);
    const aviso =
      adicionar < payload.qty
        ? `Só foi possível adicionar ${adicionar} de ${payload.nome} (limite de estoque ou de ${MAX_QTD_LINHA} por item).`
        : "";
    if (igual) {
      setAvisoCarrinho(aviso);
      setCart((prev) =>
        prev.map((l) => (l.cartId === igual.cartId ? { ...l, qty: l.qty + adicionar } : l))
      );
    } else if (cart.length >= MAX_LINHAS) {
      setAvisoCarrinho(
        `O pedido pode ter no máximo ${MAX_LINHAS} itens diferentes. Finalize ou remova algum item.`
      );
      setDrawerOpen(true);
      return;
    } else {
      setAvisoCarrinho(aviso);
      setCart((prev) => [
        ...prev,
        {
          ...payload,
          qty: adicionar,
          cartId: `${payload.menuId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
      ]);
    }
    setBump(true);
    window.clearTimeout(bumpTimer.current);
    bumpTimer.current = window.setTimeout(() => setBump(false), 400);
  };

  const removeFromCart = useCallback((cartId) => {
    setAvisoCarrinho("");
    setCart((prev) => prev.filter((line) => line.cartId !== cartId));
  }, []);

  // −/+ do drawer e do Checkout. O teto de cada linha vem de `maxLinha`.
  const alterarQtd = useCallback((cartId, qty) => {
    setAvisoCarrinho("");
    setCart((prev) =>
      prev.map((l) =>
        l.cartId === cartId ? { ...l, qty: Math.max(1, Math.min(MAX_QTD_LINHA, qty)) } : l
      )
    );
  }, []);

  const itemCount = cart.reduce((a, l) => a + l.qty, 0);
  const produtosPorId = useMemo(() => new Map(menu.map((p) => [p.id, p])), [menu]);
  const cardapio = useMemo(
    () => ({ produtosPorId, precoBatata, status: statusCardapio }),
    [produtosPorId, precoBatata, statusCardapio]
  );
  const resumo = resumirCarrinho(cart, cardapio);
  const bloqueio = mensagemBloqueio(resumo, cart.length);
  // Máximo de uma linha: 99 e, se houver controle, o estoque menos as outras linhas do produto.
  const maxLinha = (linha) =>
    Math.max(1, maxAdicionavel(produtosPorId.get(linha.menuId), cart, 0, linha.cartId));

  // Estoque fresco ao abrir o carrinho ou o Checkout.
  useEffect(() => {
    if (drawerOpen || tela === "checkout") recarregarCardapio();
  }, [drawerOpen, tela, recarregarCardapio]);

  // Produto atual (o cardápio pode ter sido recarregado depois de abrir o modal).
  const produtoModal = modalItem ? produtosPorId.get(modalItem.id) ?? modalItem : null;

  const finalizarPedido = () => {
    setDrawerOpen(false);
    if (!user) {
      setAuthView("login");
      return;
    }
    setTela("checkout");
  };

  const abrirPedidos = () => {
    setPedidoDestaque(null);
    setTela("pedidos");
  };

  const pedidoCriado = (pedidoId) => {
    setCart([]);
    mostrarToast(`Pedido nº ${pedidoId} recebido! Acompanhe o andamento em Meus pedidos.`);
    // O usuário pode ter saído enquanto a RPC respondia.
    if (!userRef.current) return;
    setPedidoDestaque(pedidoId);
    setTela("pedidos");
  };

  const confirmarSaida = async () => {
    setSaindo(true);
    const { error } = await signOut();
    setSaindo(false);
    setConfirmandoSaida(false);
    if (error) {
      mostrarToast("Não foi possível sair agora. Tente de novo.", { tipo: "erro" });
      return;
    }
    mostrarToast("Você saiu da sua conta. Até a próxima! 🍔");
  };

  const nomeUsuario = perfil?.nome?.split(" ")[0] || user?.email;

  return (
    <div className="bt-root" ref={rootRef}>
      <header className="navbar">
        <div className="navbar__inner">
          <div className="brand">
            BURGUER<span className="brand__accent">TEC</span>
          </div>

          <nav className="navlinks">
            <button className="navlink" onClick={() => scrollTo(cardapioRef)}>
              CARDÁPIO
            </button>
            <button className="navlink" onClick={() => scrollTo(sobreRef)}>
              SOBRE
            </button>
          </nav>

          <div className="navbar__actions">
            {user ? (
              <UserMenu
                nome={nomeUsuario}
                onPerfil={() => setTela("perfil")}
                onPedidos={abrirPedidos}
                onAdmin={perfil?.is_admin ? () => setTela("admin") : undefined}
                onSair={() => setConfirmandoSaida(true)}
              />
            ) : (
              <button className="btn btn--outline" onClick={() => setAuthView("login")}>
                ENTRAR
              </button>
            )}
            <button
              className={`cart-btn ${bump ? "cart-btn--bump" : ""}`}
              onClick={() => setDrawerOpen(true)}
              aria-label={`Carrinho (${itemCount} itens)`}
            >
              <ShoppingBag size={16} aria-hidden="true" />
              <span className="cart-btn__texto">Carrinho</span>
              {itemCount > 0 && <span className="cart-btn__badge">{itemCount}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* ---------------- HERO ---------------- */}
      <section className="hero">
        <div
          className="hero__bg"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1554306297-0c86e837d24b?auto=format&fit=crop&w=1600&q=80)",
            backgroundPosition: "center",
          }}
        />
        <div className="hero__overlay" />
        <div className="hero__content">
          <div className="eyebrow reveal">— DESDE 2018 —</div>
          <h1 className="hero__title reveal">
            FEITO
            <br />
            <span className="text-red">COM</span>
            <br />
            FOGO.
          </h1>
          <p className="hero__sub reveal">
            Blends artesanais, ingredientes selecionados e aquele smash que
            você vai lembrar pra sempre.
          </p>
          <button className="btn btn--primary reveal" onClick={() => scrollTo(cardapioRef)}>
            VER CARDÁPIO
          </button>
          <div className="scroll-indicator reveal">
            <span>SCROLL</span>
            <div className="scroll-indicator__line" />
          </div>
        </div>
      </section>

      {/* ---------------- CARDÁPIO ---------------- */}
      <section id="cardapio" ref={cardapioRef} className="cardapio">
        <div className="section-head reveal">
          <span className="eyebrow eyebrow--inline">NOSSO CARDÁPIO</span>
          <h2>
            ESCOLHA O SEU
            <br />
            <span className="text-red">FAVORITO</span>
          </h2>
        </div>

        {carregando && (
          <p className="cardapio__status" role="status">
            Carregando cardápio...
          </p>
        )}
        {!carregando && erroCardapio && (
          <p className="cardapio__status cardapio__status--erro" role="alert">
            {erroCardapio}
          </p>
        )}

        <CardapioSecoes menu={menu} onDetail={openDetail} onQuick={openQuick} />
      </section>

      {/* ---------------- SOBRE ---------------- */}
      <section id="sobre" ref={sobreRef} className="sobre">
        <div className="sobre__grid">
          <div className="sobre__texto reveal">
            <span className="eyebrow eyebrow--inline">NOSSA HISTÓRIA</span>
            <h2>
              AMOR E
              <br />
              <span className="text-red">BRASA</span>
            </h2>
            <p>
              A BURGUERTEC nasceu de uma obsessão: fazer o hambúrguer
              perfeito. Em 2018, abrimos as portas com uma chapa, um sonho e
              uma receita de blend testada por anos.
            </p>
            <p>
              Hoje somos referência em smash burgers artesanais na cidade.
              Cada ingrediente é escolhido com cuidado, cada blend é formado
              na hora, e cada sanduíche sai da chapa diretamente para a sua
              mesa.
            </p>
            <div className="stats">
              <div className="stats__item">
                <strong>6+</strong>
                <span>ANOS</span>
              </div>
              <div className="stats__item">
                <strong>50k+</strong>
                <span>BURGERS</span>
              </div>
              <div className="stats__item">
                <strong>4.9★</strong>
                <span>AVALIAÇÃO</span>
              </div>
            </div>
          </div>

          <div className="sobre__foto-wrap reveal">
            <div className="sobre__foto-frame" />
            <Photo
              src="https://images.unsplash.com/photo-1571805618149-3a772570ebcd?auto=format&fit=crop&w=900&q=80"
              className="sobre__foto"
            />
          </div>
        </div>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="footer">
        <div className="brand brand--footer">
          BURGUER<span className="brand__accent">TEC</span>
        </div>
        <p>© {new Date().getFullYear()} BURGUERTEC Hamburgueria — Todos os direitos reservados</p>
      </footer>

      {/* ---------------- CARRINHO (drawer) ---------------- */}
      <div
        className={`overlay ${drawerOpen ? "overlay--visible" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`drawer ${drawerOpen ? "drawer--open" : ""}`}>
        <div className="drawer__header">
          <h3>Seu Pedido</h3>
          <button onClick={() => setDrawerOpen(false)} aria-label="Fechar carrinho">
            <X size={20} />
          </button>
        </div>

        <div className="drawer__itens">
          {cart.length === 0 ? (
            <p className="drawer__vazio">Seu carrinho está vazio.</p>
          ) : (
            cart.map((it) => {
              return (
              <div className="drawer__item" key={it.cartId}>
                <Photo src={it.img} className="drawer__item-img" />
                <div className="drawer__item-info">
                  <span className="drawer__item-nome">{it.nome}</span>
                  <PrecoLinha
                    avaliacao={resumo.avaliacoes.get(it.cartId)}
                    qty={it.qty}
                    className="drawer__item-preco"
                  />
                  <QtdLinha
                    qty={it.qty}
                    max={maxLinha(it)}
                    nome={it.nome}
                    onChange={(q) => alterarQtd(it.cartId, q)}
                  />
                  <div className="drawer__item-detalhes">
                    {nomeOpcaoLinha(it, produtosPorId) && (
                      <span>{nomeOpcaoLinha(it, produtosPorId)}</span>
                    )}
                    {it.ponto && <span>Ponto: {PONTO_LABEL[it.ponto]}</span>}
                    {it.batata && <span>+ Batata frita</span>}
                    {it.obs && <span>Obs: {it.obs}</span>}
                  </div>
                </div>
                <button
                  className="drawer__item-del"
                  onClick={() => removeFromCart(it.cartId)}
                  aria-label={`Remover ${it.nome}`}
                >
                  <X size={14} />
                </button>
              </div>
              );
            })
          )}
        </div>

        <div className="drawer__footer">
          <div className="drawer__total">
            <span>Total</span>
            <strong>
              {resumo.precoCompleto ? formatarPreco(resumo.subtotal) : "a calcular"}
            </strong>
          </div>
          {avisoCarrinho && (
            <p className="drawer__msg drawer__msg--erro" role="alert">
              {avisoCarrinho}
            </p>
          )}
          {cart.length > 0 && bloqueio && (
            <p
              className={`drawer__msg ${resumo.carregando ? "drawer__msg--info" : "drawer__msg--erro"}`}
              role={resumo.carregando ? "status" : "alert"}
            >
              {bloqueio}
            </p>
          )}
          {cart.length > 0 && !resumo.carregando && !resumo.precoCompleto && !bloqueio && (
            <p className="drawer__msg drawer__msg--info" role="status">
              Não foi possível carregar os preços agora. O total é calculado ao confirmar.
            </p>
          )}
          <button
            className="btn btn--primary btn--full"
            disabled={resumo.bloqueado}
            onClick={finalizarPedido}
          >
            FINALIZAR PEDIDO
          </button>
        </div>
      </aside>

      {modalItem && (
        <ProductModal
          item={produtoModal}
          maxQtd={maxAdicionavel(produtoModal, cart)}
          restam={
            estoqueBaixo(produtoModal)
              ? Math.max(0, produtoModal.estoque - qtdProdutoNoCarrinho(cart, produtoModal.id))
              : null
          }
          mode={modalMode}
          precoBatata={precoBatata}
          onClose={closeModal}
          onAdd={handleAdd}
        />
      )}

      {user && tela && (
        <div className="auth-overlay">
          {tela === "checkout" && (
            <Checkout
              cart={cart}
              cardapio={cardapio}
              resumo={resumo}
              maxLinha={maxLinha}
              onAlterarQtd={alterarQtd}
              onEstoqueDesatualizado={recarregarCardapio}
              onRemove={removeFromCart}
              onBack={() => setTela(null)}
              onSuccess={pedidoCriado}
            />
          )}
          {tela === "pedidos" && (
            <MeusPedidos destaqueId={pedidoDestaque} onBack={() => setTela(null)} />
          )}
          {tela === "admin" && (
            <Suspense
              fallback={
                <p className="cardapio__status" role="status">
                  Carregando administração...
                </p>
              }
            >
              <Admin onBack={() => setTela(null)} />
            </Suspense>
          )}
          {tela === "perfil" && (
            <Perfil
              recuperandoSenha={recuperandoSenha}
              onSenhaDefinida={concluirRecuperacao}
              onBack={() => {
                concluirRecuperacao();
                setTela(null);
              }}
              onPedidos={abrirPedidos}
            />
          )}
        </div>
      )}

      <ConfirmDialog
        aberto={confirmandoSaida}
        titulo="Deseja sair da sua conta?"
        mensagem="Seu carrinho continua salvo neste navegador."
        confirmarLabel="SAIR"
        cancelarLabel="CANCELAR"
        ocupado={saindo}
        onConfirmar={confirmarSaida}
        onCancelar={() => setConfirmandoSaida(false)}
      />

      {authView && (
        <div className="auth-overlay">
          {authView === "login" && (
            <Login
              onBack={() => setAuthView(null)}
              onSwitch={() => setAuthView("cadastro")}
              onSuccess={() => setAuthView(null)}
            />
          )}
          {authView === "cadastro" && (
            <Cadastro
              onBack={() => setAuthView("login")}
              onSwitch={() => setAuthView("login")}
              onSuccess={() => setAuthView(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
