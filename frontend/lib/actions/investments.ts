export type Range = "1W" | "1M" | "3M" | "1Y" | "ALL";

export function rangeToDates(range: Range, now: Date = new Date()) {
  const to = now.toISOString().slice(0, 10);
  if (range === "ALL") return { from: "2010-01-01", to };
  const days = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 }[range];
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return { from: d.toISOString().slice(0, 10), to };
}

export async function fetchHistoryRange(range: Range) {
  "use server";
  const { getPortfolioHistory } = await import("@/lib/api/investments");
  const { from, to } = rangeToDates(range);
  return getPortfolioHistory(from, to);
}

export async function searchSymbolsAction(q: string) {
  "use server";
  if (!q.trim()) return [];
  const { searchSymbols } = await import("@/lib/api/investments");
  return searchSymbols(q);
}
