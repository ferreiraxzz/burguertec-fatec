-- =====================================================================
-- BurguerTec - v3: administração (pedidos, estoque e cardápio)
-- Contrato: docs/ARQUITETURA_DADOS.md, seção "v3".
--
-- COMO RODAR
--   Supabase Dashboard > SQL Editor > New query, cole ESTE arquivo
--   inteiro e clique em "Run". Ordem completa:
--     1. 20261109000000_schema_inicial.sql
--     2. 20261109010000_realtime_pedidos.sql
--     3. 20261109020000_cardapio_opcoes_pagamentos.sql
--     4. 20261109030000_admin_estoque.sql            (este)
--     5. supabase/seed.sql
--   Idempotente: pode ser executado de novo.
--   ATENÇÃO: rodar de novo uma migração ANTERIOR (1 ou 3) volta a
--   criar_pedido para a versão dela; nesse caso rode esta outra vez.
--
-- COMO PROMOVER UM USUÁRIO A ADMIN
--     update public.perfis set is_admin = true where id = '<uuid-do-usuario>';
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------------
do $$
begin
  create type public.motivo_estoque as enum
    ('entrada', 'ajuste', 'perda', 'venda', 'cancelamento');
exception when duplicate_object then null;
end
$$;


-- ---------------------------------------------------------------------
-- 2. Estoque em produtos
--    Só produtos com controla_estoque = true são verificados/baixados.
-- ---------------------------------------------------------------------
alter table public.produtos
  add column if not exists controla_estoque boolean not null default false;
alter table public.produtos
  add column if not exists estoque int not null default 0
    constraint produtos_estoque_check check (estoque >= 0);
alter table public.produtos
  add column if not exists estoque_minimo int not null default 0
    constraint produtos_estoque_minimo_check check (estoque_minimo >= 0);


-- ---------------------------------------------------------------------
-- 3. Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.movimentacoes_estoque (
  id         bigint generated always as identity primary key,
  produto_id text not null references public.produtos (id) on delete cascade,
  quantidade int  not null check (quantidade <> 0),
  motivo     public.motivo_estoque not null,
  pedido_id  bigint references public.pedidos (id) on delete set null,
  observacao text,
  usuario_id uuid references public.perfis (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists movimentacoes_estoque_produto_id_idx on public.movimentacoes_estoque (produto_id);
create index if not exists movimentacoes_estoque_pedido_id_idx  on public.movimentacoes_estoque (pedido_id);
create index if not exists movimentacoes_estoque_usuario_id_idx on public.movimentacoes_estoque (usuario_id);

create table if not exists public.pedidos_status_historico (
  id           bigint generated always as identity primary key,
  pedido_id    bigint not null references public.pedidos (id) on delete cascade,
  status       public.status_pedido not null,
  alterado_por uuid references public.perfis (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists pedidos_status_historico_pedido_id_idx    on public.pedidos_status_historico (pedido_id);
create index if not exists pedidos_status_historico_alterado_por_idx on public.pedidos_status_historico (alterado_por);

-- Histórico inicial dos pedidos que já existiam (só para pedidos sem
-- nenhuma linha): "recebido" na criação e, se o status atual for outro,
-- o status atual no updated_at. Os horários intermediários não existem.
insert into public.pedidos_status_historico (pedido_id, status, alterado_por, created_at)
select x.pedido_id, x.status, null, x.quando
from (
  select p.id as pedido_id, 'recebido'::public.status_pedido as status, p.created_at as quando, 1 as seq
  from public.pedidos p
  union all
  select p.id, p.status, p.updated_at, 2
  from public.pedidos p
  where p.status <> 'recebido'
) as x
where not exists (select 1 from public.pedidos_status_historico h where h.pedido_id = x.pedido_id)
order by x.pedido_id, x.seq;


-- ---------------------------------------------------------------------
-- 4. Triggers de pedidos
-- ---------------------------------------------------------------------

-- 4.1 Bloqueia mudança de status de pedido finalizado.
create or replace function public.pedidos_bloqueia_status_final()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('entregue', 'cancelado')
     and new.status is distinct from old.status then
    raise exception 'Pedido já finalizado.' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- 4.2 Histórico de status (insert e cada mudança) + devolução de estoque
--     no cancelamento. SECURITY DEFINER: o admin altera "status" pelo
--     grant de coluna e não tem permissão de escrita em
--     pedidos_status_historico, movimentacoes_estoque nem em
--     produtos.estoque.
create or replace function public.pedidos_registra_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  insert into public.pedidos_status_historico (pedido_id, status, alterado_por)
  values (new.id, new.status, auth.uid());

  -- Cancelamento: devolve exatamente o que foi baixado como 'venda'.
  if tg_op = 'UPDATE' and new.status = 'cancelado' then
    for r in
      select m.produto_id, -sum(m.quantidade)::int as qtd
      from public.movimentacoes_estoque m
      where m.pedido_id = new.id and m.motivo = 'venda'
      group by m.produto_id
      having sum(m.quantidade) < 0
      order by m.produto_id
    loop
      update public.produtos
         set estoque = estoque + r.qtd
       where id = r.produto_id;

      insert into public.movimentacoes_estoque
        (produto_id, quantidade, motivo, pedido_id, observacao, usuario_id)
      values
        (r.produto_id, r.qtd, 'cancelamento', new.id,
         'Devolução por cancelamento do pedido', auth.uid());
    end loop;
  end if;

  return null;
end;
$$;

drop trigger if exists pedidos_bloqueia_status_final on public.pedidos;
create trigger pedidos_bloqueia_status_final
  before update of status on public.pedidos
  for each row execute function public.pedidos_bloqueia_status_final();

drop trigger if exists pedidos_historico_insert on public.pedidos;
create trigger pedidos_historico_insert
  after insert on public.pedidos
  for each row execute function public.pedidos_registra_status();

drop trigger if exists pedidos_historico_update on public.pedidos;
create trigger pedidos_historico_update
  after update of status on public.pedidos
  for each row
  when (old.status is distinct from new.status)
  execute function public.pedidos_registra_status();

revoke all on function public.pedidos_bloqueia_status_final() from public, anon, authenticated;
revoke all on function public.pedidos_registra_status()       from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. criar_pedido (mesma assinatura): regras v2 + estoque
--    TRAVAS (evita deadlock 40P01): logo no início, antes de inserir os
--      itens, trava com FOR NO KEY UPDATE, em ordem de id, todos os
--      produtos controlados citados em p_itens. Pedidos concorrentes do
--      mesmo produto ficam em fila nesse ponto. FOR NO KEY UPDATE (e não
--      FOR UPDATE) é compatível com o FOR KEY SHARE que a checagem de FK
--      de itens_pedido faz em produtos, então nunca há troca de esperas.
--    REGRA DO ESTOQUE: depois de validar e gravar os itens, soma as
--      quantidades por produto com controla_estoque, relê cada produto
--      (já travado) e, se faltar, aborta com
--      "Estoque insuficiente para <nome> (disponível: N)." (22023) — nada
--      do pedido fica gravado. Se houver, baixa o estoque e grava
--      movimentacoes_estoque (motivo 'venda', pedido_id, usuario_id null).
--    Demais regras (v2): opção obrigatória se o produto tem opção ativa;
--      preco_unitario = produto + opção + adicionais; endereço NULL =
--      retirada (taxa 0,00, endereco_entrega NULL); endereço do usuário =
--      taxa 5,00 + snapshot em endereco_entrega.
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
  v_baixa         record;
  v_estoque       int;
  v_controla      boolean;
  v_nome          text;
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

  -- Trava os produtos controlados do pedido, em ordem de id ------------
  perform 1
  from public.produtos pr
  where pr.controla_estoque
    and pr.id in (
      select e ->> 'produto_id'
      from jsonb_array_elements(p_itens) as t(e)
      where jsonb_typeof(e) = 'object'
    )
  order by pr.id
  for no key update;

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

  -- Estoque: soma por produto, trava em ordem de id e baixa -------------
  for v_baixa in
    select i.produto_id, sum(i.quantidade)::int as qtd
    from public.itens_pedido i
    where i.pedido_id = v_pedido_id
    group by i.produto_id
    order by i.produto_id
  loop
    select pr.estoque, pr.controla_estoque, pr.nome
      into v_estoque, v_controla, v_nome
    from public.produtos pr
    where pr.id = v_baixa.produto_id
    for no key update;

    continue when not v_controla;

    if v_estoque < v_baixa.qtd then
      raise exception 'Estoque insuficiente para % (disponível: %).', v_nome, v_estoque
        using errcode = '22023';
    end if;

    update public.produtos
       set estoque = estoque - v_baixa.qtd
     where id = v_baixa.produto_id;

    insert into public.movimentacoes_estoque (produto_id, quantidade, motivo, pedido_id)
    values (v_baixa.produto_id, -v_baixa.qtd, 'venda', v_pedido_id);
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
  'Checkout: cria pedido + itens (com opção) + adicionais com preços do banco e baixa estoque dos produtos controlados. Endereço NULL = retirada (taxa 0,00); com endereço do usuário = taxa 5,00.';

revoke all on function public.criar_pedido(jsonb, uuid, public.forma_pagamento, text) from public, anon;
grant execute on function public.criar_pedido(jsonb, uuid, public.forma_pagamento, text) to authenticated;


-- ---------------------------------------------------------------------
-- 6. RPC ajustar_estoque (só admin)
--    REGRA DO SINAL: entrada soma |p_quantidade|; perda subtrai
--      |p_quantidade|; ajuste usa o sinal enviado (positivo entra,
--      negativo sai). Assim o front pode mandar "perda 3" ou "perda -3".
-- ---------------------------------------------------------------------
create or replace function public.ajustar_estoque(
  p_produto_id text,
  p_quantidade int,
  p_motivo     public.motivo_estoque,
  p_observacao text default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_delta      int;
  v_estoque    int;
  v_nome       text;
begin
  if v_usuario_id is null or not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  if p_motivo is null or p_motivo not in ('entrada', 'ajuste', 'perda') then
    raise exception 'Motivo inválido: use entrada, ajuste ou perda.' using errcode = '22023';
  end if;

  if p_quantidade is null or p_quantidade = 0 then
    raise exception 'Quantidade deve ser diferente de zero.' using errcode = '22023';
  end if;

  v_delta := case p_motivo
               when 'entrada' then abs(p_quantidade)
               when 'perda'   then -abs(p_quantidade)
               else p_quantidade
             end;

  select pr.estoque, pr.nome into v_estoque, v_nome
  from public.produtos pr
  where pr.id = p_produto_id
  for no key update;

  if not found then
    raise exception 'Produto não encontrado: %', coalesce(p_produto_id, '(vazio)') using errcode = '22023';
  end if;

  if v_estoque + v_delta < 0 then
    raise exception 'Estoque de % não pode ficar negativo (disponível: %).', v_nome, v_estoque
      using errcode = '22023';
  end if;

  update public.produtos
     set estoque = estoque + v_delta
   where id = p_produto_id
  returning estoque into v_estoque;

  insert into public.movimentacoes_estoque (produto_id, quantidade, motivo, observacao, usuario_id)
  values (p_produto_id, v_delta, p_motivo, nullif(btrim(left(p_observacao, 500)), ''), v_usuario_id);

  return v_estoque;
end;
$$;

revoke all on function public.ajustar_estoque(text, int, public.motivo_estoque, text) from public, anon;
grant execute on function public.ajustar_estoque(text, int, public.motivo_estoque, text) to authenticated;


-- ---------------------------------------------------------------------
-- 7. Privilégios de tabela
-- ---------------------------------------------------------------------
-- produtos: ninguém altera "estoque" direto (só ajustar_estoque /
-- criar_pedido / cancelamento). Revoga o UPDATE de tabela e devolve
-- UPDATE por coluna para todas as outras. Colunas novas criadas no
-- futuro precisam entrar nesta lista.
revoke update on public.produtos from anon, authenticated;
grant update (id, categoria_id, nome, descricao, preco, imagem_url, imagem_posicao,
              permite_ponto, ativo, ordem, created_at, rotulo_opcao,
              controla_estoque, estoque_minimo)
  on public.produtos to authenticated;

revoke all on public.movimentacoes_estoque from anon;
revoke insert, update, delete on public.movimentacoes_estoque from authenticated;
grant select on public.movimentacoes_estoque to authenticated;

revoke all on public.pedidos_status_historico from anon;
revoke insert, update, delete on public.pedidos_status_historico from authenticated;
grant select on public.pedidos_status_historico to authenticated;


-- ---------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------
alter table public.movimentacoes_estoque    enable row level security;
alter table public.pedidos_status_historico enable row level security;

drop policy if exists "movimentacoes_estoque: admin le" on public.movimentacoes_estoque;
create policy "movimentacoes_estoque: admin le" on public.movimentacoes_estoque
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "pedidos_status_historico: dono ou admin le" on public.pedidos_status_historico;
create policy "pedidos_status_historico: dono ou admin le" on public.pedidos_status_historico
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.pedidos p
      where p.id = pedidos_status_historico.pedido_id
        and p.usuario_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------
-- 9. Storage: bucket público "produtos" (imagens do cardápio)
--    Leitura pública; upload/alteração/exclusão só admin. Limite 2 MB.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "produtos (bucket): leitura publica" on storage.objects;
create policy "produtos (bucket): leitura publica" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'produtos');

drop policy if exists "produtos (bucket): admin envia" on storage.objects;
create policy "produtos (bucket): admin envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produtos' and (select public.is_admin()));

drop policy if exists "produtos (bucket): admin altera" on storage.objects;
create policy "produtos (bucket): admin altera" on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos' and (select public.is_admin()))
  with check (bucket_id = 'produtos' and (select public.is_admin()));

drop policy if exists "produtos (bucket): admin exclui" on storage.objects;
create policy "produtos (bucket): admin exclui" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos' and (select public.is_admin()));
