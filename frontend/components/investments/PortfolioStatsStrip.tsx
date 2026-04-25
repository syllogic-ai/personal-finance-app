import { T } from "./_tokens";

export function computeBestDay(
  series: number[],
): { delta: number; index: number } | null {
  if (series.length < 2) return null;
  let best = { delta: -Infinity, index: -1 };
  for (let i = 1; i < series.length; i++) {
    const d = series[i] - series[i - 1];
    if (d > best.delta) best = { delta: d, index: i };
  }
  return best.delta > 0 ? best : null;
}

export function PortfolioStatsStrip({
  costBasis,
  unrealizedPnl,
  returnPct,
  holdingsCount,
  accountsCount,
  bestDay,
  currencySymbol = "€",
}: {
  costBasis: number;
  unrealizedPnl: number;
  returnPct: number;
  holdingsCount: number;
  accountsCount: number;
  bestDay: { delta: number; label: string } | null;
  currencySymbol?: string;
}) {
  const cells: [string, string][] = [
    [
      "Cost basis",
      `${currencySymbol} ${costBasis.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ],
    [
      "Unrealized P&L",
      `${unrealizedPnl >= 0 ? "▲ +" : "▼ -"}${currencySymbol} ${Math.abs(unrealizedPnl).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ],
    ["Return", `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(1)}%`],
    [
      "Holdings",
      `${holdingsCount} across ${accountsCount} account${accountsCount !== 1 ? "s" : ""}`,
    ],
    [
      "Best day",
      bestDay
        ? `▲ +${currencySymbol} ${bestDay.delta.toLocaleString("en", { maximumFractionDigits: 0 })} (${bestDay.label})`
        : "—",
    ],
  ];
  return (
    <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${T.border}` }}>
      {cells.map(([label, val], i) => (
        <div
          key={i}
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRight:
              i < cells.length - 1 ? `1px solid ${T.border}` : "none",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: T.mutedFg,
              textTransform: "uppercase",
              letterSpacing: ".08em",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {val}
          </div>
        </div>
      ))}
    </div>
  );
}
