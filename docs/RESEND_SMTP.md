# Resend como SMTP do Supabase Auth

Resolve o erro `email rate limit exceeded` (o SMTP padrão do Supabase envia só ~2 e-mails/hora) e faz os e-mails estilizados de `supabase/templates/` saírem com o remetente do restaurante.

Nada disso vai no código do site nem no `.env`: a chave do Resend fica **somente** no painel do Supabase.

## 1. Resend

1. Crie a conta em https://resend.com (plano gratuito: 100 e-mails/dia, 3.000/mês).
2. **Domínio** (Domains → Add Domain). Sem domínio verificado, o Resend só entrega para o e-mail da própria conta, o que serve para testar sozinho mas não para outros usuários.
   - Adicione os registros DNS que o Resend mostrar (SPF, DKIM, e opcionalmente DMARC) no provedor do domínio e clique em Verify.
   - Use um subdomínio, por exemplo `mail.seudominio.com.br`, se não quiser mexer no domínio principal.
3. **API Key** (API Keys → Create API Key), permissão *Sending access*, restrita ao domínio. Copie a chave (`re_...`); ela só aparece uma vez.

## 2. Supabase

Authentication → Emails → **SMTP Settings** → ativar *Enable Custom SMTP*:

| Campo | Valor |
|---|---|
| Sender email | `contato@mail.seudominio.com.br` (do domínio verificado) |
| Sender name | `BurguerTec` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a API key `re_...` |

Salve. Depois, em Authentication → **Rate Limits**, aumente "Rate limit for sending emails" (o padrão ao ligar SMTP próprio é 30/hora).

## 3. Conferir

1. Authentication → Email Templates: cole os 3 HTMLs de `supabase/templates/` (assuntos no README de lá).
2. Authentication → URL Configuration: Site URL e Redirect URLs (`http://localhost:5173/**` e a URL de produção).
3. Crie uma conta no site e confira se o e-mail chega com o visual do restaurante.
4. Se não chegar: Supabase → Logs → Auth, e Resend → Emails (mostra entregue, recusado ou spam).

## Atenção
- Se a chave do Resend vazar (print, commit, chat), apague-a em Resend → API Keys e crie outra.
- Sem domínio próprio, use temporariamente o remetente `onboarding@resend.dev`, que só envia para o e-mail dono da conta Resend.
