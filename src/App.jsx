import React, { useCallback, useEffect, useRef, useState } from "react";
import { ShoppingBag, Plus, X } from "lucide-react";
import "./App.css";

/* ------------------------------------------------------------------ */
/* Dados                                                                */
/* ------------------------------------------------------------------ */
const MENU = [
  {
    id: "smash-classico",
    nome: "Smash Clássico",
    desc: "Blend 180g, queijo cheddar derretido, alface americana, tomate, cebola caramelizada e molho da casa.",
    preco: 32,
    img: "https://images.unsplash.com/photo-1623945359666-8f855090ee81?auto=format&fit=crop&w=600&q=80",
    pos: "bottom",
  },
  {
    id: "duplo-fogo",
    nome: "Duplo Fogo",
    desc: "Dois blends 150g, bacon crocante, pimenta jalapeño, queijo pepper jack e aioli defumado.",
    preco: 42,
    img: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "black-angus",
    nome: "Black Angus",
    desc: "Blend premium 220g Black Angus, gorgonzola, rúcula, tomate seco e maionese trufada.",
    preco: 52,
    img: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "crispy-chicken",
    nome: "Crispy Chicken",
    desc: "Frango empanado crocante, coleslaw artesanal, picles, queijo suíço e mostarda mel.",
    preco: 36,
    img: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=600&q=80",
    pos: "center",
  },
  {
    id: "inferno",
    nome: "Inferno",
    desc: "Blend 200g, habanero, queijo pepper, cebola roxa, sriracha e molho ghost pepper.",
    preco: 44,
    img: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "combo-duplo",
    nome: "Combo Duplo",
    desc: "Dois Smash Clássicos + batata rústica + dois refrigerantes. O combo perfeito para dividir.",
    preco: 68,
    img: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",
    pos: "center",
  },
];

function Photo({ src, className, pos }) {
  return (
    <div
      className={className}
      style={{ backgroundImage: `url(${src})`, backgroundPosition: pos || "bottom" }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Scroll reveal                                                        */
/* ------------------------------------------------------------------ */
function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll(".reveal");
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
  }, [rootRef]);
}

export default function App() {
  const [cart, setCart] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bump, setBump] = useState(false);

  const rootRef = useRef(null);
  const cardapioRef = useRef(null);
  const sobreRef = useRef(null);

  useReveal(rootRef);

  const scrollTo = useCallback((ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const addToCart = useCallback((id) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    setBump(true);
    window.clearTimeout(addToCart._t);
    addToCart._t = window.setTimeout(() => setBump(false), 400);
  }, []);

  const removeFromCart = useCallback((id) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const itemCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ ...MENU.find((m) => m.id === id), qty }))
    .filter(Boolean);
  const total = cartItems.reduce((sum, it) => sum + it.preco * it.qty, 0);

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

          <button
            className={`cart-btn ${bump ? "cart-btn--bump" : ""}`}
            onClick={() => setDrawerOpen(true)}
          >
            <ShoppingBag size={16} />
            Carrinho
            {itemCount > 0 && <span className="cart-btn__badge">{itemCount}</span>}
          </button>
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

        <div className="cardapio__grid">
          {MENU.map((item) => (
            <article className="card reveal" key={item.id}>
              <Photo src={item.img} className="card__img" pos={item.pos} />
              <h3>{item.nome}</h3>
              <p>{item.desc}</p>
              <div className="card__footer">
                <span className="card__preco">R$ {item.preco}</span>
                <button className="btn btn--small" onClick={() => addToCart(item.id)}>
                  <Plus size={14} /> ADICIONAR
                </button>
              </div>
            </article>
          ))}
        </div>
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
          {cartItems.length === 0 ? (
            <p className="drawer__vazio">Seu carrinho está vazio.</p>
          ) : (
            cartItems.map((it) => (
              <div className="drawer__item" key={it.id}>
                <Photo src={it.img} className="drawer__item-img" />
                <div className="drawer__item-info">
                  <span className="drawer__item-nome">{it.nome}</span>
                  <span className="drawer__item-preco">
                    {it.qty}x R$ {it.preco}
                  </span>
                </div>
                <button className="drawer__item-del" onClick={() => removeFromCart(it.id)}>
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="drawer__footer">
          <div className="drawer__total">
            <span>Total</span>
            <strong>R$ {total}</strong>
          </div>
          <button className="btn btn--primary btn--full" disabled={cartItems.length === 0}>
            FINALIZAR PEDIDO
          </button>
        </div>
      </aside>
    </div>
  );
}
