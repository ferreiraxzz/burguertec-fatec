-- =====================================================================
-- BurguerTec - contas iniciais (admin + cliente de teste)
--
-- Cria 2 contas direto em auth.users / auth.identities, sem passar pelo
-- signUp (o envio de e-mail do Supabase é limitado). O perfil é criado
-- pelo trigger handle_new_user (migração 20261109000000_schema_inicial)
-- a partir de raw_user_meta_data.
--
-- COMO USAR
--   1. Rode antes as migrações (precisa de public.perfis e do trigger).
--   2. Supabase Dashboard > SQL Editor > New query > cole este arquivo.
--   3. Edite as senhas NO PRÓPRIO SQL EDITOR (variáveis v_senha_admin e
--      v_senha_cliente, no começo do bloco abaixo), mínimo 8 caracteres.
--      Enquanto os placeholders 'TROQUE_ESTA_SENHA_...' continuarem, o
--      script aborta sem criar nada.
--   4. Clique em Run (papel postgres).
--   5. NÃO salve este arquivo com as senhas e NÃO faça commit delas:
--      depois de rodar, descarte a query (ou desfaça a edição).
--   6. Depois do primeiro login, troque a senha pelo Perfil do site.
--
-- IDEMPOTENTE: se o e-mail já existir, a conta e a senha NÃO são
-- alteradas (nada é duplicado). O admin sempre termina com
-- is_admin = true em public.perfis.
--
-- O resultado (e-mail, nome, is_admin, e-mail confirmado) aparece no
-- select final; senha e hash nunca são exibidos. O aviso (raise notice)
-- fica na aba "Messages"/"Notices" do SQL Editor.
--
-- Observações técnicas
--   * pgcrypto fica no schema "extensions" no Supabase.
--   * Os campos de token são '' e não NULL: NULL faz o login do GoTrue
--     falhar com "Database error querying schema".
--   * auth.identities.email é coluna gerada (não é preenchida);
--     email_verified vai dentro de identity_data.
-- =====================================================================

do $$
declare
  -- >>> EDITE AQUI (só no SQL Editor; nunca salve/commite com senhas) <<<
  v_senha_admin   text := 'TROQUE_ESTA_SENHA_ADMIN';
  v_senha_cliente text := 'TROQUE_ESTA_SENHA_CLIENTE';
  -- >>> FIM DA EDIÇÃO <<<

  c_instance constant uuid := '00000000-0000-0000-0000-000000000000';
  v_conta    record;
  v_id       uuid;
begin
  -- Validação das senhas (antes de gravar qualquer coisa) -------------
  if v_senha_admin is null or v_senha_admin = 'TROQUE_ESTA_SENHA_ADMIN' then
    raise exception 'Defina v_senha_admin: o placeholder TROQUE_ESTA_SENHA_ADMIN continua no script.';
  end if;
  if v_senha_cliente is null or v_senha_cliente = 'TROQUE_ESTA_SENHA_CLIENTE' then
    raise exception 'Defina v_senha_cliente: o placeholder TROQUE_ESTA_SENHA_CLIENTE continua no script.';
  end if;
  if char_length(v_senha_admin) < 8 then
    raise exception 'v_senha_admin precisa ter pelo menos 8 caracteres.';
  end if;
  if char_length(v_senha_cliente) < 8 then
    raise exception 'v_senha_cliente precisa ter pelo menos 8 caracteres.';
  end if;

  for v_conta in
    select * from (values
      ('miguel.ferreira8@aluno.cps.sp.gov.br', v_senha_admin,
       'Administrador', '11144477735', '11999990001', true),
      ('cliente@burguertec.test', v_senha_cliente,
       'Cliente Teste', '52998224725', '11999990002', false)
    ) as t (email, senha, nome, cpf, telefone, is_admin)
  loop
    select u.id into v_id
    from auth.users u
    where lower(u.email) = lower(v_conta.email);

    if v_id is null then
      v_id := gen_random_uuid();

      -- O trigger on_auth_user_created cria public.perfis a partir de
      -- raw_user_meta_data (nome, telefone, cpf).
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at,
        confirmation_token, recovery_token, email_change,
        email_change_token_new, email_change_token_current,
        reauthentication_token, phone_change, phone_change_token,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        c_instance, v_id, 'authenticated', 'authenticated', v_conta.email,
        extensions.crypt(v_conta.senha, extensions.gen_salt('bf')),
        now(),
        '', '', '',
        '', '',
        '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nome', v_conta.nome,
                           'telefone', v_conta.telefone,
                           'cpf', v_conta.cpf),
        now(), now()
      );
    end if;

    -- Identity de e-mail (também repara usuário existente sem identity).
    if not exists (
      select 1 from auth.identities i
      where i.user_id = v_id and i.provider = 'email'
    ) then
      insert into auth.identities (
        id, provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_id::text, v_id,
        jsonb_build_object('sub', v_id::text,
                           'email', v_conta.email,
                           'email_verified', true,
                           'phone_verified', false),
        'email',
        now(), now(), now()
      );
    end if;

    -- Reserva ao trigger: garante a linha de perfil.
    insert into public.perfis (id, nome, telefone, cpf)
    values (v_id, v_conta.nome, v_conta.telefone, v_conta.cpf)
    on conflict (id) do nothing;

    if v_conta.is_admin then
      update public.perfis set is_admin = true where id = v_id;
    end if;
  end loop;

  raise notice 'Contas prontas. Troque as senhas depois do primeiro login, pelo Perfil do site, e não salve nem commite este script com as senhas.';
end
$$;

-- Conferência (sem senha nem hash)
select u.email,
       p.nome,
       coalesce(p.is_admin, false)         as is_admin,
       u.email_confirmed_at is not null    as email_confirmado
from auth.users u
left join public.perfis p on p.id = u.id
where u.email in ('miguel.ferreira8@aluno.cps.sp.gov.br',
                  'cliente@burguertec.test')
order by p.is_admin desc nulls last, u.email;
