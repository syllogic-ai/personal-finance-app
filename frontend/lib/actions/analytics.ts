"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { accounts, transactions } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, sql, gte, and, desc } from "drizzle-orm";

export async function getTotalBalance() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { total: 0, currency: "EUR" };
  }

  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${accounts.functionalBalance}), 0)`,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, session.user.id), eq(accounts.isActive, true)));

  return {
    total: parseFloat(result[0]?.total || "0"),
    currency: "EUR",
  };
}

export async function getTransactionSummary(days: number = 30) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return [];
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db
    .select({
      date: sql<string>`DATE(${transactions.bookedAt})`,
      income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} = 'credit' THEN ${transactions.amount} ELSE 0 END), 0)`,
      expenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} = 'debit' THEN ABS(${transactions.amount}) ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        gte(transactions.bookedAt, startDate)
      )
    )
    .groupBy(sql`DATE(${transactions.bookedAt})`)
    .orderBy(sql`DATE(${transactions.bookedAt})`);

  return result.map((row) => ({
    date: row.date,
    income: parseFloat(row.income),
    expenses: parseFloat(row.expenses),
  }));
}

export async function getRecentTransactions(limit: number = 5) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return [];
  }

  const result = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      merchant: transactions.merchant,
      amount: transactions.amount,
      transactionType: transactions.transactionType,
      bookedAt: transactions.bookedAt,
      currency: transactions.currency,
    })
    .from(transactions)
    .where(eq(transactions.userId, session.user.id))
    .orderBy(desc(transactions.bookedAt))
    .limit(limit);

  return result.map((tx) => ({
    ...tx,
    amount: parseFloat(tx.amount?.toString() || "0"),
  }));
}
