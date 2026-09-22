# 🍔 BURGUERTEC

Landing page e loja virtual de uma hamburgueria fictícia, desenvolvida como projeto avaliativo da disciplina de **Programação para Dispositivos Móveis II**.

## 📚 Informações acadêmicas

| | |
|---|---|
| **Disciplina** | Programação para Dispositivos Móveis II |
| **Professor** | Bruno Zolotareff dos Santos |
| **Metodologia** | Ágil (Kanban) |
| **Aluno** | Miguel Martins |
| **Equipe** | Hamburgueria |

## 📖 Sobre o projeto

O **BURGUERTEC** é uma aplicação de pedidos para uma hamburgueria, pensada como um projeto **multiplataforma**: a versão **Web** é construída em **React**, e uma versão **Mobile** está planejada em **React Native**, compartilhando a mesma identidade visual, cardápio e lógica de negócio entre as duas plataformas.

O desenvolvimento segue a metodologia ágil com **Kanban**: o board do Trello foi montado antes do início da implementação, e cada card corresponde a um commit no histórico deste repositório, refletindo a evolução real do projeto por funcionalidade.

## ✨ Funcionalidades

- **Landing page** com identidade visual própria, seções de apresentação, cardápio, história da marca e rodapé institucional
- **Cardápio interativo** com fotos, descrição e preço de cada lanche
- **Personalização de pedido**: ponto da carne, adicional de batata, remoção de ingredientes e controle de quantidade
- **Carrinho de compras** com suporte a múltiplos itens personalizados, cálculo automático de total e remoção individual
- **Autenticação**: telas de login e criação de conta
- **Responsividade**: layout adaptado para desktop e mobile

## 🛠️ Tecnologias

**Web (este repositório)**
- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- CSS puro
- [Lucide React](https://lucide.dev/) para ícones
- [Express](https://expressjs.com/) para servir o build em produção

**Mobile (planejado)**
- [React Native](https://reactnative.dev/)

## 🚀 Como rodar o projeto

Pré-requisito: [Node.js](https://nodejs.org/) 18 ou superior.

```bash
# instalar dependências
npm install

# rodar em modo desenvolvimento
npm run dev

# gerar build de produção e subir o servidor
npm run build
npm start
```

No Windows, o `deploy.bat` executa os três passos acima automaticamente.

## 📁 Estrutura do projeto

```
burguertec-app/
├── index.html
├── package.json
├── vite.config.js
├── server.js              # servidor Express (porta única)
├── deploy.bat              # build + start automatizados (Windows)
└── src/
    ├── main.jsx
    ├── App.jsx             # componente principal
    ├── App.css             # estilos
    ├── pages/
    │   ├── Login.jsx
    │   └── Cadastro.jsx
    └── components/
        └── ProductModal.jsx  # modal de personalização do pedido
```

## 📌 Histórico de desenvolvimento

O histórico de commits deste repositório reflete a ordem dos cards planejados no Kanban do projeto, um commit por funcionalidade entregue — da navegação principal até o gerenciamento completo do carrinho.
