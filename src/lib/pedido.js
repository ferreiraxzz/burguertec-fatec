// Helpers compartilhados entre o carrinho (App), o Checkout e Meus pedidos.
// Os valores aqui são só para exibição: o total real é sempre calculado no banco
// pela função `criar_pedido`.

export const PONTO_LABEL = { mal: "Mal passado", ponto: "Ao ponto", bem: "Bem passado" };

export const TAXA_ENTREGA_ESTIMADA = 5;

export const FORMAS_PAGAMENTO = [
  { id: "pix", label: "Pix" },
  { id: "cartao_credito", label: "Cartão de crédito" },
  { id: "cartao_debito", label: "Cartão de débito" },
  { id: "dinheiro", label: "Dinheiro" },
];

export const FORMA_PAGAMENTO_LABEL = Object.fromEntries(
  FORMAS_PAGAMENTO.map((f) => [f.id, f.label])
);

// Sequência normal do pedido; `cancelado` fica fora da linha do tempo.
export const ETAPAS_STATUS = ["recebido", "em_preparo", "saiu_para_entrega", "entregue"];

const STATUS_LABEL = {
  recebido: "Recebido",
  em_preparo: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

// Na retirada no balcão, as duas últimas etapas ganham rótulos próprios.
const STATUS_LABEL_RETIRADA = {
  saiu_para_entrega: "Pronto para retirada",
  entregue: "Retirado",
};

export function rotuloStatus(status, retirada = false) {
  return (retirada && STATUS_LABEL_RETIRADA[status]) || STATUS_LABEL[status] || status;
}

const formatadorBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarPreco(valor) {
  return formatadorBRL.format(Number(valor) || 0);
}

/** Opção atual (do cardápio) escolhida na linha, ou null. */
export function opcaoDaLinha(linha, produtosPorId) {
  const produto = produtosPorId.get(linha.menuId);
  if (!produto || !linha.opcaoId) return null;
  return produto.opcoes?.find((o) => o.id === linha.opcaoId) ?? null;
}

/** Nome da opção para exibir: do cardápio atual ou, se sumiu, o guardado na linha. */
export function nomeOpcaoLinha(linha, produtosPorId) {
  return opcaoDaLinha(linha, produtosPorId)?.nome || linha.opcaoNome || null;
}

// Limites da RPC `criar_pedido`.
export const MAX_QTD_LINHA = 99;
export const MAX_LINHAS = 50;

/** Duas linhas do carrinho são "a mesma" se só diferem na quantidade. */
export function linhasIguais(a, b) {
  return (
    a.menuId === b.menuId &&
    (a.opcaoId ?? null) === (b.opcaoId ?? null) &&
    (a.ponto ?? null) === (b.ponto ?? null) &&
    Boolean(a.batata) === Boolean(b.batata) &&
    (a.obs ?? "").trim() === (b.obs ?? "").trim()
  );
}

/** Unidades do produto no carrinho, somando todas as linhas e opções. */
export function qtdProdutoNoCarrinho(carrinho, produtoId, excetoCartId = null) {
  return carrinho.reduce(
    (soma, l) => (l.menuId === produtoId && l.cartId !== excetoCartId ? soma + l.qty : soma),
    0
  );
}

/**
 * Quantas unidades ainda cabem no carrinho para o produto (limitado a 99 por linha).
 * Sem controle de estoque (ou sem dados do banco) o limite é só o de 99.
 */
export function maxAdicionavel(produto, carrinho, qtdAtualLinha = 0, excetoCartId = null) {
  const teto = MAX_QTD_LINHA - qtdAtualLinha;
  if (!produto?.controlaEstoque) return Math.max(0, teto);
  const restante = produto.estoque - qtdProdutoNoCarrinho(carrinho, produto.id, excetoCartId);
  return Math.max(0, Math.min(teto, restante));
}

/** Mostra "Restam N" quando o estoque está baixo (≤ mínimo ou ≤ 10). */
export const estoqueBaixo = (produto) =>
  Boolean(produto?.controlaEstoque) &&
  produto.estoque > 0 &&
  (produto.estoque <= produto.estoqueMinimo || produto.estoque <= 10);

/**
 * Avalia uma linha do carrinho contra o cardápio atual (nunca pelo preço salvo
 * no localStorage). `cardapio` = { produtosPorId, precoBatata, status }, com
 * status "carregando" | "ok" | "falha". `totalProduto` = soma do produto no carrinho.
 *
 * Retorna { estado, preco, texto, bloqueia }:
 * - carregando: o cardápio ainda não chegou; bloqueia só enquanto carrega.
 * - sem_preco: a busca falhou; não bloqueia (a RPC valida no envio).
 * - indisponivel: cardápio carregado do banco e o produto/opção não existe ou esgotou; bloqueia.
 * - incompleta: produto exige opção e ela falta ou não pôde ser carregada; bloqueia.
 * - excede: a soma do produto no carrinho passa do estoque; bloqueia até ajustar.
 * - ok: preço estimado = produto + opção + batata.
 */
export function avaliarLinha(linha, { produtosPorId, precoBatata, status }, totalProduto = linha.qty) {
  if (status === "carregando") {
    return { estado: "carregando", preco: null, texto: "carregando preço…", bloqueia: true };
  }
  if (status !== "ok") {
    return { estado: "sem_preco", preco: null, texto: "preço indisponível", bloqueia: false };
  }
  const produto = produtosPorId.get(linha.menuId);
  if (!produto) {
    return { estado: "indisponivel", preco: null, texto: "Indisponível — remova", bloqueia: true };
  }
  if (produto.esgotado) {
    return { estado: "indisponivel", preco: null, texto: "Esgotado — remova", bloqueia: true };
  }
  if (produto.opcoesIncompletas) {
    return {
      estado: "incompleta",
      preco: null,
      texto: "Opções indisponíveis no momento",
      bloqueia: true,
    };
  }
  const temOpcoes = produto.opcoes.length > 0;
  let adicionalOpcao = 0;
  if (temOpcoes && !linha.opcaoId) {
    const rotulo = (produto.rotuloOpcao || "").toLowerCase();
    return {
      estado: "incompleta",
      preco: null,
      texto: `${rotulo ? `Escolha o ${rotulo}` : "Escolha uma opção"} — remova`,
      bloqueia: true,
    };
  }
  if (linha.opcaoId) {
    const opcao = opcaoDaLinha(linha, produtosPorId);
    if (!opcao) {
      return { estado: "indisponivel", preco: null, texto: "Indisponível — remova", bloqueia: true };
    }
    adicionalOpcao = opcao.precoAdicional;
  }
  const preco = produto.preco + adicionalOpcao + (linha.batata ? precoBatata : 0);
  if (produto.controlaEstoque && totalProduto > produto.estoque) {
    return {
      estado: "excede",
      preco,
      texto: `Só ${produto.estoque} ${produto.estoque === 1 ? "disponível" : "disponíveis"} — ajuste`,
      bloqueia: true,
    };
  }
  return { estado: "ok", preco, texto: "", bloqueia: false };
}

/** Totais estimados, travas do carrinho e a avaliação de cada linha (por cartId). */
export function resumirCarrinho(carrinho, cardapio) {
  const totais = new Map();
  for (const l of carrinho) totais.set(l.menuId, (totais.get(l.menuId) ?? 0) + l.qty);

  const avaliacoes = new Map();
  let subtotal = 0;
  let precoCompleto = true;
  let temBloqueio = false;
  for (const l of carrinho) {
    const r = avaliarLinha(l, cardapio, totais.get(l.menuId));
    avaliacoes.set(l.cartId, r);
    if (r.bloqueia) temBloqueio = true;
    if (r.preco === null) precoCompleto = false;
    else subtotal += r.preco * l.qty;
  }
  const excedeLinhas = carrinho.length > MAX_LINHAS;
  return {
    avaliacoes,
    subtotal,
    precoCompleto,
    carregando: cardapio.status === "carregando",
    temBloqueio,
    excedeLinhas,
    bloqueado: carrinho.length === 0 || temBloqueio || excedeLinhas,
  };
}

/** Converte o carrinho do localStorage no `p_itens` esperado por `criar_pedido`. */
export function montarItensPedido(carrinho) {
  return carrinho.map((l) => ({
    produto_id: l.menuId,
    quantidade: l.qty,
    opcao_id: l.opcaoId || null,
    ponto_carne: l.ponto || null,
    adicionais: l.batata ? ["batata"] : [],
    observacao: l.obs?.trim() || null,
  }));
}

/* ---------- formas de pagamento salvas ---------- */
export const COLUNAS_FORMA_SALVA =
  "id, tipo, apelido, bandeira, final_cartao, titular, validade, principal, created_at";

export const BANDEIRAS = [
  { id: "visa", label: "Visa" },
  { id: "mastercard", label: "Mastercard" },
  { id: "elo", label: "Elo" },
  { id: "amex", label: "American Express" },
  { id: "hipercard", label: "Hipercard" },
];

export const ehCartao = (tipo) => tipo === "cartao_credito" || tipo === "cartao_debito";

/** Ex.: "Mastercard •••• 1234 · val. 08/29 · MARIA S" */
export function descreverFormaSalva(f) {
  if (!ehCartao(f.tipo)) return FORMA_PAGAMENTO_LABEL[f.tipo] || f.tipo;
  const bandeira = BANDEIRAS.find((b) => b.id === f.bandeira)?.label || "Cartão";
  return [
    `${FORMA_PAGAMENTO_LABEL[f.tipo]} · ${bandeira} •••• ${f.final_cartao}`,
    f.validade && `val. ${f.validade}`,
    f.titular,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Mensagem que explica por que o carrinho não pode ser finalizado (ou null). */
export function mensagemBloqueio(resumo, totalLinhas) {
  if (resumo.excedeLinhas) {
    const sobra = totalLinhas - MAX_LINHAS;
    return `O pedido pode ter no máximo ${MAX_LINHAS} itens diferentes. Remova ${sobra} ${
      sobra === 1 ? "item" : "itens"
    } para continuar.`;
  }
  if (resumo.carregando) return "Carregando os preços do cardápio...";
  if (resumo.temBloqueio)
    return "Há itens indisponíveis, sem a opção escolhida ou acima do estoque. Ajuste ou remova para continuar.";
  return null;
}

/* ---------- exibição de pedidos (cliente e admin) ---------- */
export const formatarDataHora = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const formatarHora = (iso) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// `endereco_entrega` é o snapshot do endereço gravado no pedido; null = retirada.
export const ehRetirada = (p) => !p.endereco_entrega;

export function textoEnderecoEntrega(e) {
  if (!e) return "";
  const cep = String(e.cep ?? "").replace(/\D/g, "");
  const partes = [
    e.apelido,
    [e.logradouro, e.numero].filter(Boolean).join(", ") +
      (e.complemento ? ` - ${e.complemento}` : ""),
    [e.bairro, [e.cidade, e.uf].filter(Boolean).join("/")].filter(Boolean).join(", "),
    cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : e.cep,
  ];
  return partes.filter(Boolean).join(" · ");
}

/** Próximo status na sequência normal (null quando já finalizado). */
export const PROXIMO_STATUS = {
  recebido: "em_preparo",
  em_preparo: "saiu_para_entrega",
  saiu_para_entrega: "entregue",
};

export const statusFinalizado = (s) => s === "entregue" || s === "cancelado";

/** { status: created_at } com o horário mais recente em que o pedido entrou em cada status. */
export function horariosPorStatus(historico) {
  const mapa = {};
  for (const h of historico ?? []) {
    if (!mapa[h.status] || h.created_at > mapa[h.status]) mapa[h.status] = h.created_at;
  }
  return mapa;
}

// Embed do histórico usado nas consultas de pedidos.
export const SELECT_HISTORICO = "pedidos_status_historico(status, created_at)";
