-- Habilita o Supabase Realtime na tabela de pedidos (tela "Meus pedidos").
-- Rodar no SQL Editor depois de 20261109000000_schema_inicial.sql. Pode ser rodado de novo.
-- O RLS continua valendo: cada cliente só recebe eventos dos próprios pedidos.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end $$;
