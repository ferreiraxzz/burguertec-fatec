# BURGUERTEC — Landing Page

Projeto React (Vite) da landing page da hamburgueria BURGUERTEC.

## Como rodar

Pré-requisito: Node.js instalado (versão 18 ou superior).

```bash
npm install
npm run dev
```

Depois abra o endereço que aparecer no terminal (normalmente `http://localhost:5173`).

## Como gerar a versão de produção (build + servidor único)

```bash
npm install
npm run build
npm start
```

Isso builda o frontend (Vite) e sobe um servidor Express servindo tudo em
`http://localhost:3000` numa porta única — igual ao padrão `deploy.bat`
usado nos outros projetos.

No Windows, também dá pra rodar tudo de uma vez com:

```bash
deploy.bat
```

## Estrutura

```
burguertec-app/
├── index.html
├── package.json
├── vite.config.js
├── server.js       -> servidor Express (porta única, serve o build)
├── deploy.bat      -> build + start automatizados (Windows)
└── src/
    ├── main.jsx    -> ponto de entrada do React
    ├── App.jsx     -> componente principal da página
    └── App.css     -> estilos da página
```
