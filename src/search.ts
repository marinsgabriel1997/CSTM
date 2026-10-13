// Destaque do termo buscado e trecho do conteúdo. Os resultados vêm do backend (FTS5);
// aqui só se aproxima a mesma regra para exibição: termos por prefixo de palavra,
// sem diferenciar maiúsculas nem acentos.

/** Parte de um texto, marcada quando corresponde a um termo da busca. */
export interface Part {
  text: string;
  match: boolean;
}

const EXCERPT_BEFORE = 20;
const EXCERPT_LENGTH = 90;

/** Termos da busca, sem acentos e em minúsculas. */
export function searchTerms(query: string): string[] {
  return query.split(/\s+/).map(fold).filter((term) => /[\p{L}\p{N}]/u.test(term));
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Texto sem acentos e, para cada caractere dele, a posição correspondente no original. */
function folded(text: string): { text: string; origin: number[] } {
  let result = "";
  const origin: number[] = [];
  for (let index = 0; index < text.length; ) {
    const char = String.fromCodePoint(text.codePointAt(index)!);
    for (const piece of fold(char)) {
      result += piece;
      origin.push(index);
    }
    index += char.length;
  }
  origin.push(text.length);
  return { text: result, origin };
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Intervalos `[início, fim)` do texto original que correspondem a algum termo. */
function matchRanges(text: string, terms: string[]): [number, number][] {
  const { text: plain, origin } = folded(text);
  const ranges: [number, number][] = [];
  for (const term of terms) {
    for (let at = plain.indexOf(term); at >= 0; at = plain.indexOf(term, at + 1)) {
      if (at === 0 || !WORD_CHAR.test(plain[at - 1])) {
        ranges.push([origin[at], origin[at + term.length]]);
      }
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** Divide o texto em partes, marcando as correspondências. */
export function highlight(text: string, terms: string[]): Part[] {
  const parts: Part[] = [];
  let position = 0;
  for (const [start, end] of matchRanges(text, terms)) {
    if (start > position) parts.push({ text: text.slice(position, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    position = end;
  }
  if (position < text.length) parts.push({ text: text.slice(position), match: false });
  return parts;
}

/** Se todos os termos aparecem no título. */
export function titleMatches(title: string, terms: string[]): boolean {
  return terms.every((term) => matchRanges(title, [term]).length > 0);
}

/** Trecho do conteúdo em volta da primeira correspondência, em uma linha. */
export function excerpt(content: string, terms: string[]): Part[] {
  const first = matchRanges(content, terms)[0];
  if (!first) return [];
  let start = Math.max(0, first[0] - EXCERPT_BEFORE);
  // O trecho começa numa palavra inteira.
  const space = content.slice(start, first[0]).search(/\s/);
  if (start > 0 && space >= 0) start += space + 1;
  const piece = content.slice(start, start + EXCERPT_LENGTH).replace(/\s+/g, " ");
  const parts = highlight(piece, terms);
  if (start > 0) parts.unshift({ text: "…", match: false });
  return parts;
}
