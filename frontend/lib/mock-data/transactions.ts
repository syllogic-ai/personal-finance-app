// Mock transactions for UI testing
// This file should be removed or replaced when connected to real database

import type { MockCategory } from "./categories";

export interface MockAccount {
  id: string;
  name: string;
  institution: string;
  accountType: "checking" | "savings" | "credit";
}

export interface MockTransaction {
  id: string;
  accountId: string;
  account: MockAccount;
  description: string;
  merchant: string | null;
  amount: number;
  currency: string;
  categoryId: string | null; // User-overridden category
  category: MockCategory | null;
  categorySystemId: string | null; // AI-assigned category (never updated by user)
  categorySystem: MockCategory | null;
  bookedAt: Date;
  pending: boolean;
  categorizationInstructions: string | null;
}

export const mockAccounts: MockAccount[] = [
  { id: "acc-1", name: "ING Main", institution: "ING Bank", accountType: "checking" },
  { id: "acc-2", name: "ABN Savings", institution: "ABN AMRO", accountType: "savings" },
];

// Helper to create transaction with system category defaulting to user category
const createTransaction = (
  tx: Omit<MockTransaction, "categorySystemId" | "categorySystem">
): MockTransaction => ({
  ...tx,
  categorySystemId: tx.categoryId,
  categorySystem: tx.category,
});

export const mockTransactions: MockTransaction[] = [
  createTransaction({
    id: "tx-1",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Exchanged To Btc",
    merchant: "Bitvavo",
    amount: -0.50,
    currency: "EUR",
    categoryId: "cat-11",
    category: { id: "cat-11", name: "Other", color: "#78716C", icon: "RiMoreLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-17"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-2",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Exchanged To Btc",
    merchant: "Bitvavo",
    amount: -1.60,
    currency: "EUR",
    categoryId: "cat-11",
    category: { id: "cat-11", name: "Other", color: "#78716C", icon: "RiMoreLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-15"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-3",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Bakkerij Wolf Wolvenstr",
    merchant: "Bakkerij Wolf",
    amount: -13.20,
    currency: "EUR",
    categoryId: "cat-1",
    category: { id: "cat-1", name: "Meals", color: "#F59E0B", icon: "RiRestaurantLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-15"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-4",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Jumbo Troelstralaan",
    merchant: "Jumbo Supermarkt",
    amount: -14.83,
    currency: "EUR",
    categoryId: "cat-1",
    category: { id: "cat-1", name: "Meals", color: "#F59E0B", icon: "RiRestaurantLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-15"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-5",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Www Amazon Nl",
    merchant: "Amazon",
    amount: -6.99,
    currency: "EUR",
    categoryId: "cat-2",
    category: { id: "cat-2", name: "Software", color: "#3B82F6", icon: "RiCodeLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-14"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-6",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Exchanged To Btc",
    merchant: "Bitvavo",
    amount: -1.10,
    currency: "EUR",
    categoryId: "cat-11",
    category: { id: "cat-11", name: "Other", color: "#78716C", icon: "RiMoreLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-14"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-7",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Starbucks 21580 Ferdin",
    merchant: "Starbucks",
    amount: -4.45,
    currency: "EUR",
    categoryId: "cat-1",
    category: { id: "cat-1", name: "Meals", color: "#F59E0B", icon: "RiRestaurantLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-14"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-8",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Exchanged To Btc",
    merchant: "Bitvavo",
    amount: -0.60,
    currency: "EUR",
    categoryId: "cat-11",
    category: { id: "cat-11", name: "Other", color: "#78716C", icon: "RiMoreLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-13"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-9",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Anne Max Delft",
    merchant: "Anne & Max",
    amount: -8.70,
    currency: "EUR",
    categoryId: "cat-1",
    category: { id: "cat-1", name: "Meals", color: "#F59E0B", icon: "RiRestaurantLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-13"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-10",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Jumbo Troelstralaan",
    merchant: "Jumbo Supermarkt",
    amount: -13.00,
    currency: "EUR",
    categoryId: "cat-1",
    category: { id: "cat-1", name: "Meals", color: "#F59E0B", icon: "RiRestaurantLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-13"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-11",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Cloudflare",
    merchant: "Cloudflare",
    amount: -4.30,
    currency: "EUR",
    categoryId: "cat-2",
    category: { id: "cat-2", name: "Software", color: "#3B82F6", icon: "RiCodeLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-12"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-12",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Apple Com Bill",
    merchant: "Apple",
    amount: -2.99,
    currency: "EUR",
    categoryId: "cat-3",
    category: { id: "cat-3", name: "Equipment", color: "#6366F1", icon: "RiComputerLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-12"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-13",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Exchanged To Btc",
    merchant: "Bitvavo",
    amount: -0.02,
    currency: "EUR",
    categoryId: "cat-11",
    category: { id: "cat-11", name: "Other", color: "#78716C", icon: "RiMoreLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-12"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-14",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Nespresso Nederland Bv",
    merchant: "Nespresso",
    amount: -38.90,
    currency: "EUR",
    categoryId: "cat-1",
    category: { id: "cat-1", name: "Meals", color: "#F59E0B", icon: "RiRestaurantLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-10"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-15",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Duty Free Shops",
    merchant: "Duty Free",
    amount: -51.10,
    currency: "EUR",
    categoryId: null,
    category: null,
    bookedAt: new Date("2026-01-10"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-16",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Salary January 2026",
    merchant: "Employer BV",
    amount: 3500.00,
    currency: "EUR",
    categoryId: "cat-9",
    category: { id: "cat-9", name: "Income", color: "#22C55E", icon: "RiWalletLine", categoryType: "income" },
    bookedAt: new Date("2026-01-08"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-17",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "NS Reizigers",
    merchant: "NS",
    amount: -24.50,
    currency: "EUR",
    categoryId: "cat-4",
    category: { id: "cat-4", name: "Transportation", color: "#10B981", icon: "RiCarLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-08"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-18",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Vattenfall Energie",
    merchant: "Vattenfall",
    amount: -125.00,
    currency: "EUR",
    categoryId: "cat-5",
    category: { id: "cat-5", name: "Utilities", color: "#EF4444", icon: "RiLightbulbLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-05"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-19",
    accountId: "acc-2",
    account: mockAccounts[1],
    description: "Transfer to Savings",
    merchant: null,
    amount: 500.00,
    currency: "EUR",
    categoryId: "cat-10",
    category: { id: "cat-10", name: "Transfer", color: "#64748B", icon: "RiExchangeLine", categoryType: "transfer" },
    bookedAt: new Date("2026-01-05"),
    pending: false,
    categorizationInstructions: null,
  }),
  createTransaction({
    id: "tx-20",
    accountId: "acc-1",
    account: mockAccounts[0],
    description: "Bol.com",
    merchant: "Bol.com",
    amount: -45.99,
    currency: "EUR",
    categoryId: "cat-7",
    category: { id: "cat-7", name: "Shopping", color: "#8B5CF6", icon: "RiShoppingBagLine", categoryType: "expense" },
    bookedAt: new Date("2026-01-03"),
    pending: true,
    categorizationInstructions: null,
  }),
];

export function getTransactionById(id: string): MockTransaction | undefined {
  return mockTransactions.find((tx) => tx.id === id);
}

export function getTransactionsByAccount(accountId: string): MockTransaction[] {
  return mockTransactions.filter((tx) => tx.accountId === accountId);
}

export function getUncategorizedTransactions(): MockTransaction[] {
  return mockTransactions.filter((tx) => tx.categoryId === null);
}
