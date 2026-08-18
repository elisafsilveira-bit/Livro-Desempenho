export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function mondayOf(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}
export function weekLabel(mondayIso: string) {
  const monday = new Date(mondayIso + "T00:00:00");
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `Semana de ${fmt(monday)} a ${fmt(end)}`;
}
export function weekDates(mondayIso: string) {
  const monday = new Date(mondayIso + "T00:00:00");
  const arr: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    arr.push(isoDate(d));
  }
  return arr;
}
export function buildWeeks(count = 8) {
  const weeks: string[] = [];
  const thisMonday = mondayOf(new Date());
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(thisMonday);
    m.setDate(m.getDate() - i * 7);
    weeks.push(isoDate(m));
  }
  return weeks;
}
export function fmtNum(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString("pt-BR");
}
export function slug(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") +
    "_" +
    Math.random().toString(36).slice(2, 6)
  );
}

export const FUNNEL_ORDER = ["pedido_indicacao", "r1", "r2", "proposta_enc", "proposta_fechada"];
export const FUNNEL_LABELS: Record<string, string> = {
  pedido_indicacao: "Pedidos de indicação",
  r1: "R1",
  r2: "R2",
  proposta_enc: "Proposta encaminhada",
  proposta_fechada: "Proposta fechada",
};
