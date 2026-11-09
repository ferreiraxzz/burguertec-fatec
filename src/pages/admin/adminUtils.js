// Utilitários da área administrativa.

/** "Suco Natural 400 ml" -> "suco-natural-400-ml" */
export function gerarSlug(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const POSICOES_IMAGEM = [
  { id: "bottom", label: "Base" },
  { id: "center", label: "Centro" },
  { id: "top", label: "Topo" },
];

export const MOTIVOS_AJUSTE = [
  { id: "entrada", label: "Entrada" },
  { id: "ajuste", label: "Ajuste" },
  { id: "perda", label: "Perda" },
];

export const MOTIVO_LABEL = {
  entrada: "Entrada",
  ajuste: "Ajuste",
  perda: "Perda",
  venda: "Venda",
  cancelamento: "Cancelamento",
};

// Upload de imagens (bucket público `produtos`).
export const BUCKET_PRODUTOS = "produtos";
export const MAX_IMAGEM_BYTES = 2 * 1024 * 1024;
export const TIPOS_IMAGEM = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

let audioCtx = null;

/** Bip curto via Web Audio (sem arquivo externo). Silencioso se o navegador bloquear. */
export function tocarBip() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const ganho = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    ganho.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
    osc.connect(ganho).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.26);
  } catch {
    /* sem áudio: segue só com o destaque visual */
  }
}

/** Preferência simples por navegador (ex.: som ligado). */
export function lerPreferencia(chave, padrao) {
  try {
    const v = window.localStorage.getItem(chave);
    return v === null ? padrao : JSON.parse(v);
  } catch {
    return padrao;
  }
}

export function salvarPreferencia(chave, valor) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* ignora */
  }
}
