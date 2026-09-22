import React, { useCallback, useRef } from "react";
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

export default function App() {
  const cardapioRef = useRef(null);
  const sobreRef = useRef(null);

  const scrollTo = useCallback((ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="bt-root">
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
          <div className="eyebrow">— DESDE 2018 —</div>
          <h1 className="hero__title">
            FEITO
            <br />
            <span className="text-red">COM</span>
            <br />
            FOGO.
          </h1>
          <p className="hero__sub">
            Blends artesanais, ingredientes selecionados e aquele smash que
            você vai lembrar pra sempre.
          </p>
          <button className="btn btn--primary" onClick={() => scrollTo(cardapioRef)}>
            VER CARDÁPIO
          </button>
          <div className="scroll-indicator">
            <span>SCROLL</span>
            <div className="scroll-indicator__line" />
          </div>
        </div>
      </section>

      {/* ---------------- CARDÁPIO ---------------- */}
      <section id="cardapio" ref={cardapioRef} className="cardapio">
        <div className="section-head">
          <span className="eyebrow eyebrow--inline">NOSSO CARDÁPIO</span>
          <h2>
            ESCOLHA O SEU
            <br />
            <span className="text-red">FAVORITO</span>
          </h2>
        </div>

        <div className="cardapio__grid">
          {MENU.map((item) => (
            <article className="card" key={item.id}>
              <Photo src={item.img} className="card__img" pos={item.pos} />
              <h3>{item.nome}</h3>
              <p>{item.desc}</p>
              <div className="card__footer">
                <span className="card__preco">R$ {item.preco}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------- SOBRE ---------------- */}
      <section id="sobre" ref={sobreRef} className="sobre">
        <div className="sobre__grid">
          <div className="sobre__texto">
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

          <div className="sobre__foto-wrap">
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
    </div>
  );
}
