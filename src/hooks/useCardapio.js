import { useCallback, useEffect, useRef, useState } from "react";
import { MSG_SUPABASE_NAO_CONFIGURADO, supabase } from "../lib/supabase.js";

// Usado só enquanto o adicional "batata" não vem do banco.
const PRECO_BATATA_FALLBACK = 6;

const LANCHES = { categoriaId: 1, categoriaNome: "Lanches", categoriaOrdem: 1 };

// Fallback: usado só se a busca em `produtos` falhar ou vier vazia
// (ex.: antes de a migração do Supabase rodar). Mesmo formato de `mapProduto`.
const MENU = [
  {
    id: "smash-classico",
    nome: "Smash Clássico",
    desc: "Blend 180g, queijo cheddar derretido, alface americana, tomate, cebola caramelizada e molho da casa.",
    preco: 32,
    img: "https://images.unsplash.com/photo-1623945359666-8f855090ee81?auto=format&fit=crop&w=600&q=80",
    pos: "bottom",
  },
  {
    id: "duplo-fogo",
    nome: "Duplo Fogo",
    desc: "Dois blends 150g, bacon crocante, pimenta jalapeño, queijo pepper jack e aioli defumado.",
    preco: 42,
    img: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "black-angus",
    nome: "Black Angus",
    desc: "Blend premium 220g Black Angus, gorgonzola, rúcula, tomate seco e maionese trufada.",
    preco: 52,
    img: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "crispy-chicken",
    nome: "Crispy Chicken",
    desc: "Frango empanado crocante, coleslaw artesanal, picles, queijo suíço e mostarda mel.",
    preco: 36,
    img: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=600&q=80",
    pos: "center",
  },
  {
    id: "inferno",
    nome: "Inferno",
    desc: "Blend 200g, habanero, queijo pepper, cebola roxa, sriracha e molho ghost pepper.",
    preco: 44,
    img: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "combo-duplo",
    nome: "Combo Duplo",
    desc: "Dois Smash Clássicos + batata rústica + dois refrigerantes. O combo perfeito para dividir.",
    preco: 68,
    img: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",
    pos: "center",
  },
].map((p) => ({
  ...LANCHES,
  permitePonto: true,
  rotuloOpcao: null,
  opcoes: [],
  opcoesIncompletas: false,
  controlaEstoque: false,
  estoque: null,
  esgotado: false,
  ...p,
}));

function mapProduto(p, opcoesPorProduto, opcoesOk) {
  return {
    id: p.id,
    nome: p.nome,
    desc: p.descricao,
    preco: Number(p.preco),
    img: p.imagem_url,
    pos: p.imagem_posicao,
    permitePonto: p.permite_ponto,
    categoriaId: p.categorias?.id ?? null,
    categoriaNome: p.categorias?.nome ?? "Outros",
    categoriaOrdem: p.categorias?.ordem ?? Number.MAX_SAFE_INTEGER,
    rotuloOpcao: p.rotulo_opcao || null,
    opcoes: opcoesPorProduto.get(p.id) ?? [],
    // Se `produto_opcoes` falhou, não dá para saber as opções de quem tem rótulo:
    // o modal e o carrinho bloqueiam esses produtos.
    opcoesIncompletas: !opcoesOk && Boolean(p.rotulo_opcao),
    controlaEstoque: Boolean(p.controla_estoque),
    estoque: p.controla_estoque ? Number(p.estoque) : null,
    estoqueMinimo: Number(p.estoque_minimo) || 0,
    // Produto controlado e zerado continua no cardápio, mas não pode ser adicionado.
    esgotado: Boolean(p.controla_estoque) && Number(p.estoque) <= 0,
  };
}

/** Agrupa o cardápio em seções, na ordem de `categorias.ordem`. */
export function agruparPorSecao(menu) {
  const secoes = new Map();
  for (const p of menu) {
    const chave = p.categoriaId ?? "outros";
    if (!secoes.has(chave)) {
      secoes.set(chave, {
        id: chave,
        nome: p.categoriaNome,
        ordem: p.categoriaOrdem,
        produtos: [],
      });
    }
    secoes.get(chave).produtos.push(p);
  }
  return [...secoes.values()].sort((a, b) => a.ordem - b.ordem);
}

export function useCardapio() {
  const [menu, setMenu] = useState(MENU);
  const [precoBatata, setPrecoBatata] = useState(PRECO_BATATA_FALLBACK);
  // "carregando" | "ok" (veio do banco) | "falha" (exibindo o MENU de fallback)
  const [status, setStatus] = useState("carregando");
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  /** Busca o cardápio de novo (ex.: estoque mudou). Não volta para "carregando". */
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    if (!supabase) {
      setErro(`${MSG_SUPABASE_NAO_CONFIGURADO}. Exibindo itens padrão.`);
      setStatus("falha");
      return;
    }
    let ativo = true;
    // Numa recarga, se a busca falhar, mantém o último cardápio bom em vez de cair no fallback.
    const falhar = (mensagem) => {
      if (statusRef.current === "ok") return;
      setErro(mensagem);
      setStatus("falha");
    };
    (async () => {
      try {
        const [prod, opc, adic] = await Promise.all([
          supabase
            .from("produtos")
            .select(
              "id, nome, descricao, preco, imagem_url, imagem_posicao, permite_ponto, rotulo_opcao, controla_estoque, estoque, estoque_minimo, categorias(id, nome, ordem)"
            )
            .eq("ativo", true)
            .order("ordem", { ascending: true }),
          supabase
            .from("produto_opcoes")
            .select("id, produto_id, nome, preco_adicional")
            .eq("ativo", true)
            .order("ordem", { ascending: true }),
          supabase.from("adicionais").select("id, preco").eq("ativo", true),
        ]);
        if (!ativo) return;
        if (prod.error) throw prod.error;
        // Sem opções o cardápio ainda funciona; a RPC barra item sem a opção obrigatória.
        if (opc.error) console.error("Erro ao carregar opções:", opc.error.message);

        const opcoesPorProduto = new Map();
        for (const o of opc.data ?? []) {
          const lista = opcoesPorProduto.get(o.produto_id) ?? [];
          lista.push({ id: o.id, nome: o.nome, precoAdicional: Number(o.preco_adicional) || 0 });
          opcoesPorProduto.set(o.produto_id, lista);
        }

        const batata = adic.data?.find((a) => a.id === "batata");
        if (batata) setPrecoBatata(Number(batata.preco));

        if (prod.data?.length) {
          const opcoesOk = !opc.error;
          setMenu(prod.data.map((p) => mapProduto(p, opcoesPorProduto, opcoesOk)));
          setErro("");
          setStatus("ok");
        } else {
          falhar("Cardápio indisponível no momento. Exibindo itens padrão.");
        }
      } catch (e) {
        console.error("Erro ao carregar cardápio:", e?.message || e);
        if (ativo) falhar("Não foi possível carregar o cardápio. Exibindo itens padrão.");
      }
    })();
    return () => {
      ativo = false;
    };
  }, [versao]);

  return { menu, precoBatata, status, carregando: status === "carregando", erro, recarregar };
}
