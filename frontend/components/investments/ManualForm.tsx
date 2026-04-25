"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RiSearchLine } from "@remixicon/react";
import {
  addManualHolding,
  createManualAccount,
  type InvestmentAccount,
  type SymbolSearchResult,
} from "@/lib/api/investments";
import { searchSymbolsAction } from "@/lib/actions/investments";
import { T } from "./_tokens";
import {
  Field,
  Input,
  SelectWithChevron,
  btnGhost,
  btnPrimary,
} from "./_form-bits";

const NEW = "__new__";
type Inst = "etf" | "equity" | "cash";

export function ManualForm({
  accounts,
  onCancel,
}: {
  accounts: InvestmentAccount[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? NEW);
  const [newName, setNewName] = useState("My Brokerage");
  const [baseCcy, setBaseCcy] = useState("EUR");
  const [symbol, setSymbol] = useState("");
  const [matches, setMatches] = useState<SymbolSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [qty, setQty] = useState("");
  const [type, setType] = useState<Inst>("etf");
  const [currency, setCurrency] = useState("EUR");
  const [avgCost, setAvgCost] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    if (debounce.current) window.clearTimeout(debounce.current);
    if (!symbol) {
      setMatches([]);
      return;
    }
    debounce.current = window.setTimeout(async () => {
      try {
        setMatches(await searchSymbolsAction(symbol));
      } catch {
        setMatches([]);
      }
    }, 200);
  }, [symbol]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const target =
        accountId === NEW
          ? (await createManualAccount(newName, baseCcy)).account_id
          : accountId;
      await addManualHolding(target, {
        symbol,
        quantity: qty,
        instrument_type: type,
        currency,
        ...(avgCost ? { avg_cost: avgCost } : {}),
      });
      router.push("/investments");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      style={{
        borderTop: `2px solid ${T.primary}`,
        background: T.card,
        border: `1px solid ${T.border}`,
        padding: 24,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 18 }}>
        Add a holding
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 14 }}>
          <Field label="Account" flex={1.2}>
            <SelectWithChevron
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.base_currency}
                </option>
              ))}
              <option value={NEW}>+ Create new account…</option>
            </SelectWithChevron>
          </Field>
          <Field label="Symbol" flex={2}>
            <div style={{ position: "relative" }}>
              <RiSearchLine
                size={12}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: T.mutedFg,
                }}
              />
              <Input
                placeholder="Search symbol or name…"
                style={{ paddingLeft: 30 }}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                onFocus={() => setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
              />
              {showResults && matches.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    zIndex: 10,
                    boxShadow: "0 4px 12px -2px rgb(0 0 0 / .08)",
                  }}
                >
                  {matches.map((r, i) => (
                    <div
                      key={i}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSymbol(r.symbol);
                        if (r.currency) setCurrency(r.currency);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 12px",
                        borderBottom:
                          i < matches.length - 1
                            ? `1px solid ${T.muted}`
                            : "none",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{ fontWeight: 700, fontSize: 12, minWidth: 44 }}
                      >
                        {r.symbol}
                      </span>
                      <span
                        style={{ flex: 1, fontSize: 11, color: T.mutedFg }}
                      >
                        {r.name}
                      </span>
                      {r.exchange && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "1px 5px",
                            border: `1px solid ${T.border}`,
                            color: T.mutedFg,
                          }}
                        >
                          {r.exchange}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Field>
        </div>
        {accountId === NEW && (
          <div style={{ display: "flex", gap: 14 }}>
            <Field label="New account name" flex={2}>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </Field>
            <Field label="Base currency" flex={1}>
              <SelectWithChevron
                value={baseCcy}
                onChange={(e) => setBaseCcy(e.target.value)}
              >
                <option>EUR</option>
                <option>USD</option>
                <option>GBP</option>
              </SelectWithChevron>
            </Field>
          </div>
        )}
        <div style={{ display: "flex", gap: 14 }}>
          <Field label="Quantity" flex={1}>
            <Input
              type="number"
              placeholder="0.00"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <Field label="Instrument type" flex={1}>
            <div style={{ display: "flex", gap: 0 }}>
              {(["etf", "equity", "cash"] as Inst[]).map((t, i) => {
                const active = type === t;
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setType(t)}
                    style={{
                      padding: "6px 14px",
                      fontSize: 12,
                      fontFamily: "inherit",
                      border: `1px solid ${active ? T.primary : T.border}`,
                      background: active ? T.primary : T.card,
                      color: active ? T.primaryFg : T.mutedFg,
                      cursor: "pointer",
                      marginLeft: i === 0 ? 0 : -1,
                      textTransform: "capitalize",
                    }}
                  >
                    {t === "etf" ? "ETF" : t}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Currency" flex={1}>
            <SelectWithChevron
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option>EUR</option>
              <option>USD</option>
              <option>GBP</option>
            </SelectWithChevron>
          </Field>
          <Field
            label={
              <>
                Avg cost{" "}
                <span style={{ fontWeight: 400, color: T.mutedFg }}>
                  (optional)
                </span>
              </>
            }
            flex={1}
          >
            <Input
              type="number"
              placeholder="—"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
            />
          </Field>
        </div>
        {err && <div style={{ color: T.negative, fontSize: 11 }}>{err}</div>}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 4,
          }}
        >
          <button type="button" onClick={onCancel} style={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={busy} style={btnPrimary}>
            {busy ? "Adding…" : "Add holding"}
          </button>
        </div>
      </div>
    </form>
  );
}
