export const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

/** 12345678901 -> ***.***.789-01 (só os últimos 5 dígitos aparecem). */
export function mascararCpf(cpf) {
  const d = soDigitos(cpf);
  if (d.length !== 11) return "Não informado";
  return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara de digitação: 000.000.000-00 */
export function formatarCpf(v) {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** Máscara de digitação: (00) 00000-0000 / (00) 0000-0000 */
export function formatarTelefone(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const corte = resto.length > 8 ? 5 : 4;
  return resto.length > corte
    ? `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`
    : `(${ddd}) ${resto}`;
}

/** Máscara de digitação da validade do cartão: MM/AA */
export function formatarValidade(v) {
  const d = soDigitos(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export const validadeValida = (v) => /^(0[1-9]|1[0-2])\/\d{2}$/.test(v);

export function formatarData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { dateStyle: "long" });
}
