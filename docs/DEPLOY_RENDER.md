# Publicar o BurguerTec no Render

O site é uma SPA estática (React + Vite) que fala direto com o Supabase. O jeito mais simples e gratuito é um **Static Site** no Render. Repositório: https://github.com/ferreiraxzz/burguertec-fatec

> A chave `sb_publishable_...` do Supabase é pública por natureza (vai dentro do JavaScript do site). Quem protege os dados é o RLS das tabelas, já configurado nas migrações. **Nunca** use a chave `service_role`/`sb_secret_...` no front nem no Render deste projeto.

## 0. Antes de subir

1. O banco precisa estar pronto: rode as migrações em `supabase/migrations/` (em ordem), depois `supabase/seed.sql` e `supabase/contas_iniciais.sql` no SQL Editor do Supabase.
2. Confirme que o build funciona local:
   ```bash
   npm install
   npm run build
   ```
3. Envie o código para o GitHub (o `.env` já está no `.gitignore`, então a chave não vai junto):
   ```bash
   git add .
   git commit -m "feat: integração com Supabase, admin, perfil e cardápio"
   git push origin main
   ```

## 1. Criar o Static Site

1. Entre em https://dashboard.render.com e faça login com o GitHub.
2. **New +** → **Static Site** → conecte o repositório `burguertec-fatec` (autorize o acesso se pedir).
3. Preencha:

| Campo | Valor |
|---|---|
| Name | `burguertec` (vira `burguertec.onrender.com`) |
| Branch | `main` |
| Root Directory | (vazio) |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

## 2. Variáveis de ambiente (obrigatório)

Em **Environment** → **Add Environment Variable**:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://rdtzxhppbxkmfatebpgb.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | a chave `sb_publishable_...` do projeto |

O Vite grava essas variáveis **no momento do build**. Se você criar ou alterar uma depois, é preciso um novo deploy (**Manual Deploy → Clear build cache & deploy**). Sem elas o site abre com o cardápio padrão e o aviso "Supabase não configurado".

Opcional: `NODE_VERSION` = `20`.

## 3. Rotas (SPA)

O site não usa rotas por URL, então não é obrigatório, mas deixe por segurança. Em **Redirects/Rewrites** → **Add Rule**:

| Source | Destination | Action |
|---|---|---|
| `/*` | `/index.html` | Rewrite |

Clique em **Create Static Site**. O primeiro deploy leva 1 a 3 minutos; a URL final aparece no topo (`https://burguertec.onrender.com`).

## 4. Avisar o Supabase da nova URL

No Supabase: **Authentication → URL Configuration**

- **Site URL:** `https://burguertec.onrender.com` (use o nome real do seu serviço)
- **Redirect URLs:** adicione `https://burguertec.onrender.com/**` e mantenha `http://localhost:5173/**` para desenvolvimento

Sem isso, os links dos e-mails (confirmação e recuperação de senha) voltam para o endereço errado.

## 5. Testar no ar

1. Abra a URL e confira o cardápio por seções (com as fotos).
2. Entre com a conta de cliente e faça um pedido de teste (Checkout → Meus pedidos).
3. Entre com a conta admin: o menu do perfil mostra **Administração**. Avance o status do pedido e veja o cliente receber a mudança.
4. Se algo falhar, abra o console do navegador (F12) e o painel **Logs** do Render.

## Atualizações

Cada `git push` na branch `main` dispara um novo deploy automático.

## Alternativa: Web Service (usa o `server.js`)

Só se o professor exigir Node. **New + → Web Service**, mesmo repositório:

| Campo | Valor |
|---|---|
| Runtime | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Instance Type | Free |

As mesmas variáveis `VITE_*` são necessárias. No plano gratuito o serviço dorme após ~15 min sem acesso e o primeiro acesso depois disso leva cerca de 50 s. O Static Site não tem essa espera.

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| Página em branco ou "Supabase não configurado" | Variáveis `VITE_*` ausentes ou com nome errado. Corrija e faça novo deploy com *Clear build cache*. |
| Cardápio padrão, sem sabores e sem estoque | O SQL v2/v3 não foi rodado, ou a URL/chave apontam para outro projeto. |
| Link do e-mail abre `localhost` | Site URL do Supabase não foi trocada (passo 4). |
| `npm run build` falha no Render | Rode o build local e leia o erro; confira se `package-lock.json` está commitado. |
