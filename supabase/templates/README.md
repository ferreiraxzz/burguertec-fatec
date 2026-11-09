# Templates de e-mail da BURGUERTEC (Supabase Auth)

Templates HTML com a identidade do site (fundo escuro, vermelho `#e2352b`, títulos em Bitter e texto em Inter) para os e-mails de autenticação do Supabase.

| Arquivo | Template no Supabase | Assunto sugerido |
|---|---|---|
| `confirmacao.html` | **Confirm signup** | `🍔 Confirme seu e-mail e a chapa já tá quente!` |
| `recuperar-senha.html` | **Reset password** | `🍔 Esqueceu a senha? Bora criar uma nova` |
| `alterar-email.html` | **Change email address** | `🍔 Confirme seu novo e-mail na BURGUERTEC` |

> Projeto acadêmico, restaurante fictício.

---

## 1. Configurar as URLs (faça isso antes)

Os links dos e-mails (`{{ .ConfirmationURL }}`) redirecionam para o site depois da verificação. Se a URL não estiver liberada, o Supabase manda o usuário para a Site URL ou recusa o redirecionamento.

1. No painel do Supabase, abra o projeto e vá em **Authentication → URL Configuration**.
2. **Site URL**: a URL principal do app.
   - Em desenvolvimento: `http://localhost:5173`
   - Em produção: a URL publicada (ex.: `https://burguertec.exemplo.com`)
3. **Redirect URLs**: adicione todas as origens que podem receber o retorno do login:
   - `http://localhost:5173/**`
   - `https://SUA-URL-DE-PRODUCAO/**`
4. Clique em **Save**.

A Site URL também aparece no rodapé dos e-mails (`{{ .SiteURL }}`), então vale manter a de produção quando o site estiver no ar.

## 2. Colar os templates no painel

Repita para cada linha da tabela acima:

1. Vá em **Authentication → Emails** (em versões antigas do painel: **Authentication → Email Templates**).
2. Escolha a aba do template (**Confirm signup**, **Reset password** ou **Change email address**).
3. Em **Subject**, cole o assunto sugerido.
4. Em **Message body** (modo *Source*), apague o conteúdo padrão e cole **o arquivo inteiro**, do `<!DOCTYPE html>` até o `</html>`.
5. Confira a prévia ao lado e clique em **Save changes**.
6. Teste: crie uma conta nova no site (ou peça a recuperação de senha) e abra o e-mail recebido.

Observações:

- O plano gratuito usa o SMTP padrão do Supabase, que tem limite baixo de envios por hora e é feito só para testes. Para algo além de testes, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**.
- **Reset password**: o link leva o usuário de volta ao site já autenticado (evento `PASSWORD_RECOVERY` no `supabase.auth.onAuthStateChange`). O app precisa de uma tela que chame `supabase.auth.updateUser({ password })`. Hoje essa tela ainda não existe em `src/`.
- **Change email address**: com *Secure email change* ligado (padrão), o Supabase manda o template para os **dois** endereços e a troca só acontece depois das duas confirmações. O texto foi escrito para funcionar nos dois casos.

## 3. Variáveis usadas

| Variável | Onde | O que é |
|---|---|---|
| `{{ .ConfirmationURL }}` | todos | link de confirmação/redefinição (botão e link em texto puro) |
| `{{ .Email }}` | todos | e-mail atual do usuário |
| `{{ .NewEmail }}` | `alterar-email.html` | novo e-mail solicitado |
| `{{ .SiteURL }}` | todos (rodapé) | Site URL configurada no passo 1 |
| `{{ .Data.nome }}` | todos (saudação) | nome salvo no cadastro (`options.data.nome`), sempre dentro de `{{ if .Data.nome }}...{{ end }}`. Sem nome, a saudação fica só "Olá!" |

## 4. Opcional: usar com a Supabase CLI (`supabase/config.toml`)

Se o projeto rodar localmente com `supabase start`, aponte os templates no `supabase/config.toml` (os caminhos são relativos à raiz do projeto):

```toml
[auth.email.template.confirmation]
subject = "🍔 Confirme seu e-mail e a chapa já tá quente!"
content_path = "./supabase/templates/confirmacao.html"

[auth.email.template.recovery]
subject = "🍔 Esqueceu a senha? Bora criar uma nova"
content_path = "./supabase/templates/recuperar-senha.html"

[auth.email.template.email_change]
subject = "🍔 Confirme seu novo e-mail na BURGUERTEC"
content_path = "./supabase/templates/alterar-email.html"
```

E as URLs equivalentes ao passo 1:

```toml
[auth]
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173/**", "https://SUA-URL-DE-PRODUCAO/**"]
```

- Depois de editar, reinicie com `supabase stop && supabase start`. Os e-mails locais aparecem no Inbucket/Mailpit (por padrão em `http://localhost:54324`).
- O `config.toml` vale para o ambiente local. No projeto hospedado, cole pelo painel (passo 2). Versões recentes da CLI também enviam essas configurações com `supabase config push`.

## 5. Decisões de layout (compatibilidade)

- **Estrutura**: tabelas com `role="presentation"`, CSS inline e largura máxima de 600px. No Outlook para Windows, uma tabela "fantasma" (`<!--[if mso]>`) fixa os 600px.
- **Fontes**: Bitter (títulos) e Inter (texto) via Google Fonts, com fallback `Georgia, 'Times New Roman', serif` e `'Helvetica Neue', Helvetica, Arial, sans-serif`. O Gmail ignora fontes web e usa o fallback. O Outlook para Windows recebe Georgia/Arial forçados para não cair em Times New Roman.
- **Marca**: o cabeçalho "BURGUER**TEC**" é texto, não imagem, e aparece mesmo com as imagens bloqueadas. Só `confirmacao.html` tem uma foto (Unsplash, com `alt`). Se ela for bloqueada, o layout continua de pé.
- **Botão**: botão "bulletproof", com VML (`v:roundrect`) no Outlook e `<a>` estilizado nos outros clientes. Logo abaixo vem o link em texto puro. O fundo do botão é `#c22a21` (o vermelho de hover do site) para o texto branco ter contraste AA (5,8:1). Com `#e2352b` seriam 4,4:1.
- **Preheader**: texto de prévia oculto logo no início do `<body>`.
- **Modo escuro**: o layout já nasce escuro e declara `color-scheme: dark`, então Apple Mail, iOS e Outlook (via `[data-ogsc]`/`[data-ogsb]`) mantêm as cores. Alguns apps (ex.: Gmail no iOS) podem inverter as cores por conta própria. Mesmo assim, texto e botão continuam legíveis.
- **Tamanho**: cada arquivo tem 11 a 14 KB, bem abaixo do corte de ~102 KB do Gmail.
