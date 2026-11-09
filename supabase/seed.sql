-- =====================================================================
-- BurguerTec - seed do cardápio (carga inicial)
--
-- Seed de carga inicial; rodar de novo só adiciona o que estiver
-- faltando, sem sobrescrever alterações feitas pelo admin.
--
-- COMO RODAR
--   Supabase Dashboard > SQL Editor > New query. Rode, UM POR VEZ e
--   NESTA ORDEM, colando cada arquivo inteiro e clicando em "Run":
--     1. supabase/migrations/20261109000000_schema_inicial.sql
--     2. supabase/migrations/20261109010000_realtime_pedidos.sql
--     3. supabase/migrations/20261109020000_cardapio_opcoes_pagamentos.sql
--     4. supabase/migrations/20261109030000_admin_estoque.sql
--     5. supabase/seed.sql   (este)
--
-- O QUE O SEED FAZ (e o que NÃO faz)
--   * Categorias, produtos, opções e adicionais: "on conflict do nothing".
--     Registros existentes não são tocados (preço, nome, imagem,
--     descrição, ativo, ordem, categoria editados pelo admin ficam).
--   * Completa só o que está faltando em quem rodou o seed antigo (v1/v2):
--       - produto do seed que ainda esteja numa categoria antiga
--         (Hambúrgueres, Combos...) vai para Lanches/Acompanhamentos/
--         Bebidas (a migração v2 já faz isso; aqui é só garantia);
--       - rotulo_opcao NULL recebe 'Sabor'/'Tipo' nos produtos com opções.
--   * Estoque: acompanhamentos e bebidas do seed que NUNCA tiveram
--     movimentação em movimentacoes_estoque recebem controla_estoque =
--     true, estoque = 50, estoque_minimo = 10 e uma 'entrada'
--     "Estoque inicial (seed)". Depois disso o seed não mexe mais no
--     estoque. Lanches ficam como estão (padrão: sem controle).
--
-- COMO PROMOVER UM USUÁRIO A ADMIN
--   Depois que o usuário se cadastrar pelo site, no SQL Editor:
--
--     select id, email from auth.users where email = 'fulano@exemplo.com';
--     update public.perfis set is_admin = true where id = '<uuid-do-usuario>';
-- =====================================================================

-- ---------------------------------------------------------------------
-- Categorias (seções do cardápio)
-- ---------------------------------------------------------------------
insert into public.categorias (nome, ordem) values
  ('Lanches',          1),
  ('Acompanhamentos',  2),
  ('Bebidas',          3)
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------
-- Produtos (os 6 primeiros vêm do array MENU de src/App.jsx)
-- ---------------------------------------------------------------------
insert into public.produtos
  (id, categoria_id, nome, descricao, preco, imagem_url, imagem_posicao,
   permite_ponto, rotulo_opcao, ativo, ordem)
select v.id, c.id, v.nome, v.descricao, v.preco, v.imagem_url, v.imagem_posicao,
       v.permite_ponto, v.rotulo_opcao, true, v.ordem
from (values
  -- Lanches ----------------------------------------------------------
  ('smash-classico', 'Lanches', 'Smash Clássico',
   'Blend 180g, queijo cheddar derretido, alface americana, tomate, cebola caramelizada e molho da casa.',
   32.00::numeric(10,2),
   'https://images.unsplash.com/photo-1623945359666-8f855090ee81?auto=format&fit=crop&w=600&q=80',
   'bottom', true, null::text, 1),
  ('duplo-fogo', 'Lanches', 'Duplo Fogo',
   'Dois blends 150g, bacon crocante, pimenta jalapeño, queijo pepper jack e aioli defumado.',
   42.00,
   'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=600&q=80',
   'bottom', true, null, 2),
  ('black-angus', 'Lanches', 'Black Angus',
   'Blend premium 220g Black Angus, gorgonzola, rúcula, tomate seco e maionese trufada.',
   52.00,
   'https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=600&q=80',
   'bottom', true, null, 3),
  ('crispy-chicken', 'Lanches', 'Crispy Chicken',
   'Frango empanado crocante, coleslaw artesanal, picles, queijo suíço e mostarda mel.',
   36.00,
   'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=600&q=80',
   'center', false, null, 4),
  ('inferno', 'Lanches', 'Inferno',
   'Blend 200g, habanero, queijo pepper, cebola roxa, sriracha e molho ghost pepper.',
   44.00,
   'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80',
   'bottom', true, null, 5),
  ('combo-duplo', 'Lanches', 'Combo Duplo',
   'Dois Smash Clássicos + batata rústica + dois refrigerantes. O combo perfeito para dividir.',
   68.00,
   'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
   'center', false, null, 6),

  -- Acompanhamentos ----------------------------------------------------
  ('batata-porcao', 'Acompanhamentos', 'Porção de batatas',
   'Batatas fritas crocantes, sequinhas e salgadas na medida. Serve bem duas pessoas.',
   19.00,
   'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=600&q=80',
   'center', false, null, 1),
  ('onion-rings', 'Acompanhamentos', 'Onion rings',
   'Anéis de cebola empanados e fritos na hora, com molho barbecue da casa.',
   22.00,
   'https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=600&q=80',
   'center', false, null, 2),
  ('nuggets', 'Acompanhamentos', 'Nuggets 10 un.',
   'Dez nuggets de frango crocantes, acompanhados de molho mostarda e mel.',
   21.00,
   'https://images.unsplash.com/photo-1619881590738-a111d176d906?auto=format&fit=crop&w=600&q=80',
   'center', false, null, 3),
  ('fritas-cheddar-bacon', 'Acompanhamentos', 'Fritas com Cheddar e Bacon',
   'Porção de batatas fritas crocantes cobertas com cheddar cremoso e bacon em cubos.',
   24.00,
   'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
   'center', false, null, 4),

  -- Bebidas -------------------------------------------------------------
  ('suco-natural', 'Bebidas', 'Suco natural 400 ml',
   'Suco feito na hora com fruta fresca. Escolha o sabor.',
   12.00,
   'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80',
   'center', false, 'Sabor', 1),
  ('soda-italiana', 'Bebidas', 'Soda italiana',
   'Água com gás, xarope artesanal e muito gelo. Escolha o sabor.',
   14.00,
   'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?auto=format&fit=crop&w=600&q=80',
   'center', false, 'Sabor', 2),
  ('refrigerante-lata', 'Bebidas', 'Refrigerante Lata',
   'Lata 350ml bem gelada. Escolha o sabor.',
   7.00,
   'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=600&q=80',
   'center', false, 'Sabor', 3),
  ('agua-mineral', 'Bebidas', 'Água mineral 500 ml',
   'Garrafa de 500 ml, com ou sem gás.',
   5.00,
   'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=600&q=80',
   'center', false, 'Tipo', 4),
  ('milkshake-baunilha', 'Bebidas', 'Milkshake de Baunilha',
   'Milkshake cremoso de baunilha com chantilly, 400ml.',
   18.00,
   'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80',
   'center', false, null, 5),
  ('milkshake-morango', 'Bebidas', 'Milkshake de morango',
   'Milkshake cremoso de morango com pedaços da fruta, 400ml.',
   19.00,
   'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=600&q=80',
   'center', false, null, 6),
  ('milkshake-nuts', 'Bebidas', 'Milkshake Nuts',
   'Creme de avelã e castanhas, finalizado com chantilly, 400ml.',
   21.00,
   'https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=600&q=80',
   'center', false, null, 7)
) as v (id, categoria, nome, descricao, preco, imagem_url, imagem_posicao,
        permite_ponto, rotulo_opcao, ordem)
join public.categorias c on c.nome = v.categoria
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Completa o que falta para quem rodou o seed antigo (v1/v2)
-- ---------------------------------------------------------------------
-- Produto do seed parado numa categoria antiga vai para a seção certa.
-- Quem o admin moveu entre Lanches/Acompanhamentos/Bebidas não é tocado.
update public.produtos pr
   set categoria_id = nova.id
  from (values
    ('smash-classico', 'Lanches'), ('duplo-fogo', 'Lanches'), ('black-angus', 'Lanches'),
    ('crispy-chicken', 'Lanches'), ('inferno', 'Lanches'), ('combo-duplo', 'Lanches'),
    ('batata-porcao', 'Acompanhamentos'), ('onion-rings', 'Acompanhamentos'),
    ('nuggets', 'Acompanhamentos'), ('fritas-cheddar-bacon', 'Acompanhamentos'),
    ('suco-natural', 'Bebidas'), ('soda-italiana', 'Bebidas'), ('refrigerante-lata', 'Bebidas'),
    ('agua-mineral', 'Bebidas'), ('milkshake-baunilha', 'Bebidas'),
    ('milkshake-morango', 'Bebidas'), ('milkshake-nuts', 'Bebidas')
  ) as v (produto_id, categoria)
  join public.categorias nova on nova.nome = v.categoria
 where pr.id = v.produto_id
   and pr.categoria_id not in (
     select c.id from public.categorias c
     where c.nome in ('Lanches', 'Acompanhamentos', 'Bebidas')
   );

-- Rótulo da escolha só onde ainda está vazio.
update public.produtos pr
   set rotulo_opcao = v.rotulo
  from (values
    ('suco-natural', 'Sabor'), ('soda-italiana', 'Sabor'),
    ('refrigerante-lata', 'Sabor'), ('agua-mineral', 'Tipo')
  ) as v (produto_id, rotulo)
 where pr.id = v.produto_id
   and pr.rotulo_opcao is null;

-- ---------------------------------------------------------------------
-- Estoque inicial: só para acompanhamentos/bebidas do seed que nunca
-- tiveram movimentação. Grava a 'entrada' correspondente.
-- ---------------------------------------------------------------------
with inicializados as (
  update public.produtos pr
     set controla_estoque = true,
         estoque          = 50,
         estoque_minimo   = 10
    from public.categorias c
   where c.id = pr.categoria_id
     and c.nome in ('Acompanhamentos', 'Bebidas')
     and pr.id in (
       'batata-porcao', 'onion-rings', 'nuggets', 'fritas-cheddar-bacon',
       'suco-natural', 'soda-italiana', 'refrigerante-lata', 'agua-mineral',
       'milkshake-baunilha', 'milkshake-morango', 'milkshake-nuts'
     )
     and not exists (
       select 1 from public.movimentacoes_estoque m where m.produto_id = pr.id
     )
  returning pr.id, pr.estoque
)
insert into public.movimentacoes_estoque (produto_id, quantidade, motivo, observacao)
select i.id, i.estoque, 'entrada', 'Estoque inicial (seed)'
from inicializados i;

-- ---------------------------------------------------------------------
-- Opções (sabor / tipo)
-- ---------------------------------------------------------------------
insert into public.produto_opcoes (id, produto_id, nome, preco_adicional, ativo, ordem) values
  -- Suco natural
  ('suco-laranja',          'suco-natural',      'Laranja',             0.00, true, 1),
  ('suco-limao',            'suco-natural',      'Limão',               0.00, true, 2),
  ('suco-maracuja',         'suco-natural',      'Maracujá',            0.00, true, 3),
  ('suco-abacaxi-hortela',  'suco-natural',      'Abacaxi com hortelã', 0.00, true, 4),
  ('suco-morango',          'suco-natural',      'Morango',             2.00, true, 5),
  -- Soda italiana
  ('soda-maca-verde',       'soda-italiana',     'Maçã verde',          0.00, true, 1),
  ('soda-cereja',           'soda-italiana',     'Cereja',              0.00, true, 2),
  ('soda-limao-siciliano',  'soda-italiana',     'Limão siciliano',     0.00, true, 3),
  ('soda-frutas-vermelhas', 'soda-italiana',     'Frutas vermelhas',    0.00, true, 4),
  -- Refrigerante lata
  ('refri-cola',            'refrigerante-lata', 'Cola',                0.00, true, 1),
  ('refri-cola-zero',       'refrigerante-lata', 'Cola zero',           0.00, true, 2),
  ('refri-guarana',         'refrigerante-lata', 'Guaraná',             0.00, true, 3),
  ('refri-laranja',         'refrigerante-lata', 'Laranja',             0.00, true, 4),
  ('refri-limao',           'refrigerante-lata', 'Limão',               0.00, true, 5),
  -- Água mineral
  ('agua-sem-gas',          'agua-mineral',      'Sem gás',             0.00, true, 1),
  ('agua-com-gas',          'agua-mineral',      'Com gás',             1.00, true, 2)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Adicionais
-- ---------------------------------------------------------------------
insert into public.adicionais (id, nome, preco, ativo) values
  ('batata', 'Batata rústica', 6.00, true)
on conflict (id) do nothing;
