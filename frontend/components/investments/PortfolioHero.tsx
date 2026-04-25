"use client";
import { RiAlertLine } from "@remixicon/react";
import { T } from "./_tokens";
import type { Range } from "@/lib/actions/investments";

const RANGES: Range[] = ["1W", "1M", "3M", "1Y", "ALL"];

export function PortfolioHero({
  totalValue,
  currency,
  absChange,
  pctChange,
  range,
  onRangeChange,
  asOf,
  staleCount,
}: {
  totalValue: number;
  currency: string;
  absChange: number;
  pctChange: number;
  range: Range;
  onRangeChange: (r: Range) => void;
  asOf?: string;
  staleCount: number;
}) {
  const positive = absChange >= 0;
  const sym = currency === "USD" ? "$" : currency === "GBP" ? "£" : "€";
  const rangeLabel = {
    "1W": "this week",
    "1M": "this month",
    "3M": "this 3 months",
    "1Y": "this year",
    ALL: "all time",
  }[range];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 0, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <div
          style={{
            fontSize: 11,
            color: T.mutedFg,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Portfolio value
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {sym}{" "}
          {totalValue.toLocaleString("en", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: positive ? T.positive : T.negative,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {positive ? "▲" : "▼"} {positive ? "+" : "-"}
            {sym}{" "}
            {Math.abs(absChange).toLocaleString("en", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            ({positive ? "+" : ""}
            {pctChange.toFixed(2)}%)
          </span>
          <span style={{ fontSize: 11, color: T.mutedFg }}>{rangeLabel}</span>
          {asOf && (
            <>
              <span style={{ fontSize: 11, color: T.mutedFg }}>·</span>
              <span style={{ fontSize: 11, color: T.mutedFg }}>as of {asOf}</span>
            </>
          )}
          {staleCount > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                background: T.staleBg,
                border: `1px solid ${T.staleBorder}`,
                fontSize: 10,
                color: "oklch(0.6 0.1 70)",
              }}
            >
              <RiAlertLine size={10} /> {staleCount} stale price
              {staleCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 0, alignSelf: "flex-end" }}>
        {RANGES.map((r) => {
          const active = range === r;
          return (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                fontFamily: "inherit",
                border: `1px solid ${active ? T.primary : T.border}`,
                background: active ? T.primary : T.card,
                color: active ? T.primaryFg : T.mutedFg,
                cursor: "pointer",
                marginLeft: -1,
                position: active ? "relative" : "static",
                zIndex: active ? 1 : 0,
              }}
            >
              {r}
            </button>
          );
        })}
      </div>
    </div>
  );
}
