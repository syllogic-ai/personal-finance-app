"use client";
import { useState } from "react";
import { RiLinksLine, RiPencilLine } from "@remixicon/react";
import type { InvestmentAccount } from "@/lib/api/investments";
import { BrokerForm } from "./BrokerForm";
import { ManualForm } from "./ManualForm";
import { T } from "./_tokens";

type Path = "broker" | "manual" | null;

export function ConnectPathPicker({
  accounts,
}: {
  accounts: InvestmentAccount[];
}) {
  const [picked, setPicked] = useState<Path>(null);

  const paths: {
    id: "broker" | "manual";
    icon: React.ReactNode;
    title: string;
    sub: string;
    badge: string | null;
    detail: string;
  }[] = [
    {
      id: "broker",
      icon: <RiLinksLine size={17} />,
      title: "Connect broker",
      sub: "Positions and trades sync automatically. Best for IBKR users.",
      badge: "RECOMMENDED",
      detail:
        "Interactive Brokers via Flex Query — no manual entry once connected.",
    },
    {
      id: "manual",
      icon: <RiPencilLine size={17} />,
      title: "Add manually",
      sub: "Search by symbol, enter quantity and optional cost basis.",
      badge: null,
      detail:
        "Prices are fetched automatically. You manage quantity updates yourself.",
    },
  ];

  return (
    <div className="syllogic-surface" style={{ flex: 1, overflow: "auto" }}>
      <div
        style={{
          padding: "28px 32px",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: T.mutedFg,
            lineHeight: 1.8,
            maxWidth: 560,
          }}
        >
          Choose how to track your investments. You can use both methods across
          different accounts — a brokerage account synced from IBKR alongside a
          manually-managed account for assets held elsewhere.
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {paths.map((p) => {
            const sel = picked === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setPicked(p.id)}
                style={{
                  flex: 1,
                  padding: 24,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  background: sel ? T.bg : T.card,
                  border: sel
                    ? `2px solid ${T.primary}`
                    : `1px solid ${T.border}`,
                  transition: "border-color 120ms, background 120ms",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      border: `1px solid ${T.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: sel ? T.primary : T.card,
                      color: sel ? T.primaryFg : T.mutedFg,
                    }}
                  >
                    {p.icon}
                  </div>
                  {p.badge && (
                    <span
                      style={{
                        padding: "2px 8px",
                        background: T.primary,
                        color: T.primaryFg,
                        fontSize: 9,
                        letterSpacing: ".08em",
                      }}
                    >
                      {p.badge}
                    </span>
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      marginBottom: 6,
                    }}
                  >
                    {p.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: T.mutedFg,
                      lineHeight: 1.7,
                    }}
                  >
                    {p.sub}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: T.mutedFg,
                    borderTop: `1px solid ${T.border}`,
                    paddingTop: 12,
                    marginTop: "auto",
                    lineHeight: 1.6,
                  }}
                >
                  {p.detail}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      border: `1.5px solid ${sel ? T.primary : T.border}`,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {sel && (
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          background: T.primary,
                          borderRadius: "50%",
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: sel ? T.fg : T.mutedFg,
                      fontWeight: sel ? 600 : 400,
                    }}
                  >
                    {sel ? "Selected" : "Select this path"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {picked === "manual" && (
          <ManualForm accounts={accounts} onCancel={() => setPicked(null)} />
        )}
        {picked === "broker" && <BrokerForm onCancel={() => setPicked(null)} />}
        {!picked && (
          <div
            style={{
              fontSize: 11,
              color: T.mutedFg,
              textAlign: "center",
              paddingTop: 4,
            }}
          >
            Select a path above to continue
          </div>
        )}
      </div>
    </div>
  );
}
