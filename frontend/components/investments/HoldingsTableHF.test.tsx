import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HoldingsTableHF } from "./HoldingsTableHF";
import type { Holding } from "@/lib/api/investments";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush, refresh: vi.fn() }) }));

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

describe("HoldingsTableHF row navigation", () => {
  it("navigates to holding detail on row click", () => {
    render(
      <HoldingsTableHF
        holdings={H}
        accountNames={{ a: "Acct" }}
        accountsCount={1}
      />,
    );
    fireEvent.click(screen.getByText("VUAA"));
    expect(mockPush).toHaveBeenCalledWith("/investments/1");
  });

  it("does not navigate when delete button clicked", () => {
    mockPush.mockClear();
    const onDelete = vi.fn();
    render(
      <HoldingsTableHF
        holdings={H}
        accountNames={{ a: "Acct" }}
        accountsCount={1}
        onDelete={onDelete}
      />,
    );
    // MSFT (id "2") sorts first by value (2000 > 1000); both are manual so both show Delete
    fireEvent.click(screen.getAllByTitle("Delete")[0]);
    expect(onDelete).toHaveBeenCalledWith("2");
    expect(mockPush).not.toHaveBeenCalled();
  });
});
