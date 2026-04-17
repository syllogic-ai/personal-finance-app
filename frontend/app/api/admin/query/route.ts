import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, accounts, transactions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

/** Temporary read-only admin query endpoint. Remove after diagnosis. */
export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_AUTH_SECRET?.trim();
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!userRows.length) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const userId = userRows[0].id;

  const userAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      currency: accounts.currency,
      bankConnectionId: accounts.bankConnectionId,
      functionalBalance: accounts.functionalBalance,
      lastSyncedAt: accounts.lastSyncedAt,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const accountsWithTxns = await Promise.all(
    userAccounts.map(async (acc) => {
      const txns = await db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          description: transactions.description,
          merchant: transactions.merchant,
          bookedAt: transactions.bookedAt,
          externalId: transactions.externalId,
        })
        .from(transactions)
        .where(and(eq(transactions.accountId, acc.id), eq(transactions.userId, userId)))
        .orderBy(desc(transactions.bookedAt))
        .limit(5);

      const total = await db
        .select({ count: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.accountId, acc.id), eq(transactions.userId, userId)));

      return { ...acc, txnCount: total.length, recentTxns: txns };
    })
  );

  return NextResponse.json({ userId, accounts: accountsWithTxns });
}
