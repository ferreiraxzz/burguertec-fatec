import React from "react";
import "./App.css";

export default function App() {
  return (
    <div className="bt-root">
      <header className="navbar">
        <div className="navbar__inner">
          <div className="brand">
            BURGUER<span className="brand__accent">TEC</span>
          </div>

          <nav className="navlinks">
            <button className="navlink">CARDÁPIO</button>
            <button className="navlink">SOBRE</button>
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
          <button className="btn btn--primary">VER CARDÁPIO</button>
          <div className="scroll-indicator">
            <span>SCROLL</span>
            <div className="scroll-indicator__line" />
          </div>
        </div>
      </section>
    </div>
  );
}
