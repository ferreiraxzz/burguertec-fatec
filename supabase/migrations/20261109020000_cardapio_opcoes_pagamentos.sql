-- =====================================================================
-- BurguerTec - v2: cardápio em seções, opções de sabor e formas de
-- pagamento salvas.  Contrato: docs/ARQUITETURA_DADOS.md, seção "v2".
--
-- COMO RODAR
--   Supabase Dashboard > SQL Editor > New query, cole ESTE arquivo
--   inteiro e clique em "Run". Ordem completa:
--     1. 20261109000000_schema_inicial.sql
--     2. 20261109010000_realtime_pedidos.sql
--     3. 20261109020000_cardapio_opcoes_pagamentos.sql   (este)
--     4. supabase/seed.sql
--   Idempotente: pode ser executado de novo.
--
-- COMO PROMOVER UM USUÁRIO A ADMIN
--     update public.perfis set is_admin = true where id = '<uuid-do-usuario>';
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Seções do cardápio: Lanches (1), Acompanhamentos (2), Bebidas (3)
--    "Hambúrgueres" vira "Lanches"; combo-duplo vai para Lanches;
--    "Combos" (e "Hambúrgueres", se sobrar) é removida quando vazia.
-- ---------------------------------------------------------------------
do $$
declare
  v_lanches smallint;
begin
  if not exists (select 1 from public.categorias where nome = 'Lanches') then
    if exists (select 1 from public.categorias where nome = 'Hambúrgueres') then
      update public.categorias set nome = 'Lanches' where nome = 'Hambúrgueres';
    else
      insert into public.categorias (nome, ordem) values ('Lanches', 1);
    end if;
  end if;

  select id into v_lanches from public.categorias where nome = 'Lanches';

  -- Se "Hambúrgueres" e "Lanches" coexistirem (seed novo rodado antes
  -- desta migração), os produtos de Hambúrgueres migram para Lanches.
  update public.produtos pr
     set categoria_id = v_lanches
   where pr.id = 'combo-duplo'
      or pr.categoria_id in (select c.id from public.categorias c where c.nome = 'Hambúrgueres');

  delete from public.categorias c
   where c.nome in ('Combos', 'Hambúrgueres')
     and not exists (select 1 from public.produtos pr where pr.categoria_id = c.id);
end
$$;

insert into public.categorias (nome, ordem) values
  ('Lanches',         1),
  ('Acompanhamentos', 2),
  ('Bebidas',         3)
on conflict (nome) do update set ordem = excluded.ordem;


-- ---------------------------------------------------------------------
-- 2. produtos.rotulo_opcao e tabela produto_opcoes
-- ---------------------------------------------------------------------
alter table public.produtos add column if not exists rotulo_opcao text;
comment on column public.produtos.rotulo_opcao is
  'Título da escolha no modal (ex.: Sabor, Tipo). Usado quando o produto tem opções.';

create table if not exists public.produto_opcoes (
  id              text primary key,
  produto_id      text not null references public.produtos (id) on delete cascade,
  nome            text not null,
  preco_adicional numeric(10,2) not null default 0 check (preco_adicional >= 0),
  ativo           boolean not null default true,
  ordem           int not null default 0
);

create index if not exists produto_opcoes_produto_id_idx on public.produto_opcoes (produto_id);


-- ---------------------------------------------------------------------
-- 3. itens_pedido: opção escolhida (FK + snapshot do nome)
-- ---------------------------------------------------------------------
alter table public.itens_pedido
  add column if not exists opcao_id text references public.produto_opcoes (id) on delete set null;
alter table public.itens_pedido
  add column if not exists opcao_nome text;

create index if not exists itens_pedido_opcao_id_idx on public.itens_pedido (opcao_id);


-- ---------------------------------------------------------------------
-- 4. formas_pagamento_salvas
--    Atalho de preferência. NUNCA guarda número completo nem CVV.
-- ---------------------------------------------------------------------
create table if not exists public.formas_pagamento_salvas (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  tipo         public.forma_pagamento not null,
  apelido      text,
  bandeira     text,
  final_cartao char(4),
  titular      text,
  validade     text,
  principal    boolean not null default false,
  created_at   timestamptz not null default now(),

  constraint formas_pagamento_salvas_bandeira_check
    check (bandeira is null or bandeira in ('visa', 'mastercard', 'elo', 'amex', 'hipercard')),
  constraint formas_pagamento_salvas_final_cartao_check
    check (final_cartao is null or final_cartao ~ '^[0-9]{4}$'),
  constraint formas_pagamento_salvas_validade_check
    check (validade is null or validade ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'),
  -- pix/dinheiro: sem dados de cartão; cartões: final_cartao obrigatório.
  constraint formas_pagamento_salvas_tipo_check check (
    (tipo in ('pix', 'dinheiro')
       and bandeira is null and final_cartao is null and validade is null)
    or
    (tipo in ('cartao_credito', 'cartao_debito') and final_cartao is not null)
  )
);

create index if not exists formas_pagamento_salvas_usuario_id_idx
  on public.formas_pagamento_salvas (usuario_id);

-- No máximo uma forma principal por usuário. Para trocar a principal,
-- o front desmarca a atual antes de marcar a nova.
create unique index if not exists formas_pagamento_salvas_uma_principal_idx
  on public.formas_pagamento_salvas (usuario_id) where principal;


-- ---------------------------------------------------------------------
-- 5. criar_pedido (mesma assinatura) com opções
--    REGRA DA OPÇÃO: se o produto tem ao menos uma opção ativa, o item
--      precisa de "opcao_id" de uma opção ativa DESSE produto; senão
--      "opcao_id" deve ser null/ausente. preco_unitario = produto +
--      preco_adicional da opção + adicionais. Grava opcao_id e
--      opcao_nome (snapshot) em itens_pedido.
--    Demais regras (iguais à migração inicial): endereço NULL = retirada
--      (taxa 0,00, endereco_entrega NULL); endereço do usuário = taxa
--      5,00 + snapshot em endereco_entrega.
-- ---------------------------------------------------------------------
create or replace function public.criar_pedido(
  p_itens           jsonb,
  p_endereco_id     uuid,
  p_forma_pagamento public.forma_pagamento,
  p_observacao      text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_taxa_entrega  constant numeric(10,2) := 5.00;
  c_max_itens     constant int := 50;
  c_max_qtd       constant int := 99;

  v_usuario_id    uuid := auth.uid();
  v_pedido_id     bigint;
  v_item_id       bigint;
  v_item          jsonb;
  v_produto       public.produtos%rowtype;
  v_qtd_num       numeric;
  v_quantidade    int;
  v_ponto         public.ponto_carne;
  v_adicionais    text[];
  v_qtd_validos   int;
  v_preco_adic    numeric(10,2);
  v_opcao_req     text;
  v_opcao_id      text;
  v_opcao_nome    text;
  v_preco_opcao   numeric(10,2);
  v_preco_unit    numeric(10,2);
  v_subtotal_item numeric(10,2);
  v_subtotal      numeric(10,2) := 0;
  v_taxa          numeric(10,2);
  v_endereco      jsonb;
begin
  -- Autenticação ------------------------------------------------------
  if v_usuario_id is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;

  if not exists (select 1 from public.perfis p where p.id = v_usuario_id) then
    raise exception 'Perfil do usuário não encontrado' using errcode = '42501';
  end if;

  -- Parâmetros --------------------------------------------------------
  if p_itens is null
     or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 then
    raise exception 'O pedido precisa ter ao menos um item' using errcode = '22023';
  end if;

  if jsonb_array_length(p_itens) > c_max_itens then
    raise exception 'O pedido pode ter no máximo % itens', c_max_itens using errcode = '22023';
  end if;

  if p_forma_pagamento is null then
    raise exception 'Forma de pagamento obrigatória' using errcode = '22023';
  end if;

  -- Endereço: NULL = retirada no balcão (sem taxa); senão valida o dono
  -- e guarda o snapshot.
  if p_endereco_id is null then
    v_taxa     := 0;
    v_endereco := null;
  else
    select jsonb_build_object(
             'apelido',     e.apelido,
             'cep',         e.cep,
             'logradouro',  e.logradouro,
             'numero',      e.numero,
             'complemento', e.complemento,
             'bairro',      e.bairro,
             'cidade',      e.cidade,
             'uf',          e.uf
           )
      into v_endereco
    from public.enderecos e
    where e.id = p_endereco_id and e.usuario_id = v_usuario_id;

    if not found then
      raise exception 'Endereço inválido' using errcode = '22023';
    end if;
    v_taxa := c_taxa_entrega;
  end if;

  -- Cabeçalho do pedido (totais são atualizados no fim) ---------------
  insert into public.pedidos
    (usuario_id, endereco_id, endereco_entrega, forma_pagamento,
     subtotal, taxa_entrega, total, observacao)
  values
    (v_usuario_id, p_endereco_id, v_endereco, p_forma_pagamento,
     0, v_taxa, 0, nullif(btrim(left(p_observacao, 500)), ''))
  returning id into v_pedido_id;

  -- Itens -------------------------------------------------------------
  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Item do pedido em formato inválido' using errcode = '22023';
    end if;

    -- produto (só ativos; preço do banco)
    select * into v_produto
    from public.produtos pr
    where pr.id = v_item ->> 'produto_id' and pr.ativo;

    if not found then
      raise exception 'Produto inválido ou indisponível: %', coalesce(v_item ->> 'produto_id', '(vazio)')
        using errcode = '22023';
    end if;

    -- quantidade inteira entre 1 e c_max_qtd
    if jsonb_typeof(v_item -> 'quantidade') is distinct from 'number' then
      raise exception 'Quantidade inválida para %.', v_produto.nome using errcode = '22023';
    end if;
    v_qtd_num := (v_item ->> 'quantidade')::numeric;
    if v_qtd_num <> trunc(v_qtd_num) or v_qtd_num < 1 or v_qtd_num > c_max_qtd then
      raise exception 'Quantidade inválida para %.', v_produto.nome using errcode = '22023';
    end if;
    v_quantidade := v_qtd_num::int;

    -- opção (sabor/tipo): obrigatória se o produto tem opção ativa
    if jsonb_typeof(v_item -> 'opcao_id') = 'string' then
      v_opcao_req := nullif(btrim(v_item ->> 'opcao_id'), '');
    elsif jsonb_typeof(v_item -> 'opcao_id') is null
          or jsonb_typeof(v_item -> 'opcao_id') = 'null' then
      v_opcao_req := null;
    else
      raise exception 'Opção inválida para %.', v_produto.nome using errcode = '22023';
    end if;

    v_opcao_id    := null;
    v_opcao_nome  := null;
    v_preco_opcao := 0;

    if exists (select 1 from public.produto_opcoes o
               where o.produto_id = v_produto.id and o.ativo) then
      if v_opcao_req is null then
        raise exception 'Escolha uma opção para %.', v_produto.nome using errcode = '22023';
      end if;

      select o.id, o.nome, o.preco_adicional
        into v_opcao_id, v_opcao_nome, v_preco_opcao
      from public.produto_opcoes o
      where o.id = v_opcao_req and o.produto_id = v_produto.id and o.ativo;

      if not found then
        raise exception 'Opção inválida para %.', v_produto.nome using errcode = '22023';
      end if;
    elsif v_opcao_req is not null then
      raise exception 'Opção inválida para %.', v_produto.nome using errcode = '22023';
    end if;

    -- ponto da carne (ignorado se o produto não permite)
    v_ponto := null;
    if v_produto.permite_ponto
       and jsonb_typeof(v_item -> 'ponto_carne') = 'string' then
      if not ((v_item ->> 'ponto_carne') = any (enum_range(null::public.ponto_carne)::text[])) then
        raise exception 'Ponto da carne inválido: %', v_item ->> 'ponto_carne' using errcode = '22023';
      end if;
      v_ponto := (v_item ->> 'ponto_carne')::public.ponto_carne;
    end if;

    -- adicionais (só ativos; preço do banco)
    v_adicionais := '{}';
    if jsonb_typeof(v_item -> 'adicionais') = 'array' then
      select coalesce(array_agg(distinct a), '{}')
        into v_adicionais
      from jsonb_array_elements_text(v_item -> 'adicionais') as t(a);
    elsif jsonb_typeof(v_item -> 'adicionais') is not null
          and jsonb_typeof(v_item -> 'adicionais') <> 'null' then
      raise exception 'Adicionais em formato inválido' using errcode = '22023';
    end if;

    select count(*), coalesce(sum(ad.preco), 0)
      into v_qtd_validos, v_preco_adic
    from public.adicionais ad
    where ad.id = any (v_adicionais) and ad.ativo;

    if v_qtd_validos <> cardinality(v_adicionais) then
      raise exception 'Adicional inválido ou indisponível' using errcode = '22023';
    end if;

    v_preco_unit    := v_produto.preco + v_preco_opcao + v_preco_adic;
    v_subtotal_item := v_preco_unit * v_quantidade;

    insert into public.itens_pedido
      (pedido_id, produto_id, nome_produto, opcao_id, opcao_nome, preco_unitario,
       quantidade, ponto_carne, observacao, subtotal)
    values
      (v_pedido_id, v_produto.id, v_produto.nome, v_opcao_id, v_opcao_nome, v_preco_unit,
       v_quantidade, v_ponto, nullif(btrim(left(v_item ->> 'observacao', 500)), ''), v_subtotal_item)
    returning id into v_item_id;

    insert into public.itens_pedido_adicionais (item_id, adicional_id, preco)
    select v_item_id, ad.id, ad.preco
    from public.adicionais ad
    where ad.id = any (v_adicionais) and ad.ativo;

    v_subtotal := v_subtotal + v_subtotal_item;
  end loop;

  -- Totais ------------------------------------------------------------
  update public.pedidos
     set subtotal = v_subtotal,
         total    = v_subtotal + v_taxa
   where id = v_pedido_id;

  return v_pedido_id;
end;
$$;

comment on function public.criar_pedido(jsonb, uuid, public.forma_pagamento, text) is
  'Checkout: cria pedido + itens (com opção) + adicionais com preços do banco. Endereço NULL = retirada (taxa 0,00); com endereço do usuário = taxa 5,00.';

-- create or replace preserva os grants, mas reaplicamos por garantia.
revoke all on function public.criar_pedido(jsonb, uuid, public.forma_pagamento, text) from public, anon;
grant execute on function public.criar_pedido(jsonb, uuid, public.forma_pagamento, text) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Privilégios de tabela
-- ---------------------------------------------------------------------
-- produto_opcoes: leitura pública; escrita filtrada pelo RLS (só admin).
grant select on public.produto_opcoes to anon, authenticated;
grant insert, update, delete on public.produto_opcoes to authenticated;

-- formas_pagamento_salvas: só o dono (authenticated), nada para anon.
revoke all on public.formas_pagamento_salvas from anon;
grant select, insert, update, delete on public.formas_pagamento_salvas to authenticated;


-- ---------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------
alter table public.produto_opcoes          enable row level security;
alter table public.formas_pagamento_salvas enable row level security;

-- 7.1 produto_opcoes (igual a produtos)
drop policy if exists "produto_opcoes: leitura publica das ativas" on public.produto_opcoes;
create policy "produto_opcoes: leitura publica das ativas" on public.produto_opcoes
  for select to anon, authenticated
  using (ativo = true);

drop policy if exists "produto_opcoes: admin gerencia" on public.produto_opcoes;
create policy "produto_opcoes: admin gerencia" on public.produto_opcoes
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 7.2 formas_pagamento_salvas (CRUD do dono; admin não lê)
drop policy if exists "formas_pagamento_salvas: dono le" on public.formas_pagamento_salvas;
create policy "formas_pagamento_salvas: dono le" on public.formas_pagamento_salvas
  for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists "formas_pagamento_salvas: dono insere" on public.formas_pagamento_salvas;
create policy "formas_pagamento_salvas: dono insere" on public.formas_pagamento_salvas
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists "formas_pagamento_salvas: dono altera" on public.formas_pagamento_salvas;
create policy "formas_pagamento_salvas: dono altera" on public.formas_pagamento_salvas
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

drop policy if exists "formas_pagamento_salvas: dono exclui" on public.formas_pagamento_salvas;
create policy "formas_pagamento_salvas: dono exclui" on public.formas_pagamento_salvas
  for delete to authenticated
  using (usuario_id = (select auth.uid()));
