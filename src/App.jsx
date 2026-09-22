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
    </div>
  );
}
