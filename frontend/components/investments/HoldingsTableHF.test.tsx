import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HoldingsTableHF } from "./HoldingsTableHF";
import type { Holding } from "@/lib/api/investments";

const H: Holding[] = [
  {
    id: "1",
    account_id: "a",
    symbol: "VUAA",
    name: "Vanguard",
    currency: "USD",
    instrument_type: "etf",
    quantity: "10",
    source: "manual",
    current_price: "100",
    current_value_user_currency: "1000",
    is_stale: false,
  },
  {
    id: "2",
    account_id: "a",
    symbol: "MSFT",
    name: "Microsoft",
    currency: "USD",
    instrument_type: "equity",
    quantity: "5",
    source: "manual",
    current_price: "400",
    current_value_user_currency: "2000",
    is_stale: true,
  },
];

describe("HoldingsTableHF", () => {
  it("filters to ETF only when filter clicked", () => {
    render(
      <HoldingsTableHF
        holdings={H}
        accountNames={{ a: "Acct" }}
        accountsCount={1}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "ETF" }));
    expect(screen.queryByText("MSFT")).toBeNull();
    expect(screen.getByText("VUAA")).toBeTruthy();
  });
  it("flags stale rows", () => {
    const { container } = render(
      <HoldingsTableHF
        holdings={H}
        accountNames={{ a: "Acct" }}
        accountsCount={1}
      />,
    );
    expect(container.querySelectorAll("tr.stale").length).toBe(1);
  });
});
