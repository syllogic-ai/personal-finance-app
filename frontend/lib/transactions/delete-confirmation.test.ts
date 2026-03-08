import { describe, it, expect } from "vitest";

/**
 * Tests for the typed confirmation safeguard logic used by
 * DeleteTransactionsDialog. The dialog enables the confirm button only
 * when the input matches "delete transactions" (case-insensitive,
 * leading/trailing whitespace trimmed).
 */

function isConfirmed(input: string): boolean {
  return input.trim().toLowerCase() === "delete transactions";
}

describe("delete confirmation safeguard", () => {
  it("accepts exact match", () => {
    expect(isConfirmed("delete transactions")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isConfirmed("DELETE TRANSACTIONS")).toBe(true);
    expect(isConfirmed("Delete Transactions")).toBe(true);
    expect(isConfirmed("dElEtE tRaNsAcTiOnS")).toBe(true);
  });

  it("trims whitespace", () => {
    expect(isConfirmed("  delete transactions  ")).toBe(true);
    expect(isConfirmed("\tdelete transactions\n")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isConfirmed("")).toBe(false);
  });

  it("rejects partial match", () => {
    expect(isConfirmed("delete")).toBe(false);
    expect(isConfirmed("transactions")).toBe(false);
    expect(isConfirmed("delete transaction")).toBe(false);
  });

  it("rejects extra content", () => {
    expect(isConfirmed("delete transactions now")).toBe(false);
    expect(isConfirmed("please delete transactions")).toBe(false);
  });
});
