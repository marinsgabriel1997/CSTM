// Textos de data e hora dos itens do histórico do clipboard no cadastro.

const pad = (value: number) => String(value).padStart(2, "0");
const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const daysBetween = (now: Date, date: Date) => Math.round((day(now) - day(date)) / 86_400_000);

/** Hora da cópia na árvore; de outro dia, "ontem" ou a data `dd/mm` (como no menu de colagem). */
export function copiedLabel(iso: string, now = new Date()): string {
  const copied = new Date(iso);
  const days = daysBetween(now, copied);
  if (days === 0) return clock(copied);
  if (days === 1) return "ontem";
  return `${pad(copied.getDate())}/${pad(copied.getMonth() + 1)}`;
}

/** "Copiado hoje às 09:42", "Copiado ontem às 18:20" ou "Copiado em 10/10/2026 às 09:42". */
export function copiedAtLabel(iso: string, now = new Date()): string {
  const copied = new Date(iso);
  const days = daysBetween(now, copied);
  const when =
    days === 0
      ? "hoje"
      : days === 1
        ? "ontem"
        : `em ${pad(copied.getDate())}/${pad(copied.getMonth() + 1)}/${copied.getFullYear()}`;
  return `Copiado ${when} às ${clock(copied)}`;
}
