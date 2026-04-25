import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HoldingDetailView } from "./HoldingDetailView";
import type { Holding, PortfolioSummary, ValuationPoint } from "@/lib/api/investments";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/actions/investments", () => ({
  fetchHoldingHistoryRange: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/api/investments", () => ({
  updateHolding: vi.fn(),
}));

const MANUAL_HOLDING: Holding = {
  id: "h1",
  account_id: "a1",
  symbol: "VUAA",
  name: "Vanguard S&P 500 UCITS ETF",
  currency: "USD",
  instrument_type: "etf",
  quantity: "100",
  avg_cost: "87.55",
  as_of_date: null,
  source: "manual",
  current_price: "98.42",
  current_value_user_currency: "9842",
  is_stale: false,
};

const IBKR_HOLDING: Holding = {
  ...MANUAL_HOLDING,
  id: "h2",
  source: "ibkr_flex",
};

const NO_COST_HOLDING: Holding = {
  ...MANUAL_HOLDING,
  id: "h3",
  avg_cost: null,
};

const PORTFOLIO: PortfolioSummary = {
  total_value: "50000",
  total_value_today_change: "100",
  currency: "EUR",
  accounts: [{ id: "a1", name: "My Account", balance: "9842", type: "manual" }],
  allocation_by_type: {},
  allocation_by_currency: {},
};

const HISTORY: ValuationPoint[] = [
  { date: "2026-03-25", value: "9500" },
  { date: "2026-04-25", value: "9842" },
];

describe("HoldingDetailView", () => {
  it("renders edit panel for manual holding", () => {
    render(
      <HoldingDetailView
        holding={MANUAL_HOLDING}
        portfolio={PORTFOLIO}
        initialHistory={HISTORY}
      />,
    );
    expect(screen.getByText("Edit holding")).toBeTruthy();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeTruthy();
  });

  it("hides edit panel for IBKR holding", () => {
    render(
      <HoldingDetailView
        holding={IBKR_HOLDING}
        portfolio={PORTFOLIO}
        initialHistory={HISTORY}
      />,
    );
    expect(screen.queryByText("Edit holding")).toBeNull();
  });

  it("shows — for total return when avg_cost is null", () => {
    render(
      <HoldingDetailView
        holding={NO_COST_HOLDING}
        portfolio={PORTFOLIO}
        initialHistory={HISTORY}
      />,
    );
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it("shows symbol and account name in header", () => {
    render(
      <HoldingDetailView
        holding={MANUAL_HOLDING}
        portfolio={PORTFOLIO}
        initialHistory={HISTORY}
      />,
    );
    expect(screen.getByText("VUAA")).toBeTruthy();
    expect(screen.getByText("My Account")).toBeTruthy();
  });
});
