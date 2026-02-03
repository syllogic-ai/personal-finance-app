"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray, sql, ne, desc, gte, lte, ilike, or, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, transactionLinks, accounts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-helpers";
import crypto from "crypto";

export type LinkRole = "primary" | "reimbursement" | "expense";

export interface TransactionLinkInfo {
  id: string;
  groupId: string;
  transactionId: string;
  linkRole: LinkRole;
  createdAt: Date | null;
}

export interface LinkedTransaction {
  id: string;
  amount: number;
  description: string | null;
  merchant: string | null;
  bookedAt: Date;
  transactionType: string | null;
  linkRole: LinkRole;
}

export interface TransactionLinkGroup {
  groupId: string;
  primary: LinkedTransaction | null;
  linked: LinkedTransaction[];
  netAmount: number;
  currency: string | null;
}

export interface SuggestedLink {
  id: string;
  amount: number;
  description: string | null;
  merchant: string | null;
  bookedAt: Date;
  transactionType: string | null;
  accountId: string;
  accountName: string | null;
  score: number; // Match confidence score
}

export interface LinkSearchFilters {
  searchQuery?: string;
  accountId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  pageSize?: number;
}

export interface LinkSearchResult {
  transactions: SuggestedLink[];
  totalCount: number;
  hasMore: boolean;
}

export interface AccountOption {
  id: string;
  name: string;
}

/**
 * Gets all user accounts for filter dropdown.
 */
export async function getUserAccountsForLinking(): Promise<AccountOption[]> {
  const userId = await requireAuth();

  if (!userId) {
    return [];
  }

  try {
    const userAccounts = await db.query.accounts.findMany({
      where: eq(accounts.userId, userId),
      columns: {
        id: true,
        name: true,
      },
      orderBy: [accounts.name],
    });

    return userAccounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
    }));
  } catch (error) {
    console.error("Failed to get user accounts:", error);
    return [];
  }
}

/**
 * Creates a new transaction link group with a primary transaction and linked transactions.
 */
export async function createTransactionLinkGroup(
  primaryId: string,
  linkedIds: string[],
  linkType: "reimbursement" | "expense"
): Promise<{ success: boolean; error?: string; groupId?: string }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  if (linkedIds.length === 0) {
    return { success: false, error: "At least one linked transaction is required" };
  }

  try {
    // Verify all transactions belong to the user
    const allIds = [primaryId, ...linkedIds];
    const userTransactions = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        inArray(transactions.id, allIds)
      ),
    });

    if (userTransactions.length !== allIds.length) {
      return { success: false, error: "Some transactions not found or not owned by user" };
    }

    // Check if any transaction is already linked
    const existingLinks = await db.query.transactionLinks.findMany({
      where: inArray(transactionLinks.transactionId, allIds),
    });

    if (existingLinks.length > 0) {
      return { success: false, error: "One or more transactions are already linked to a group" };
    }

    // Create a new group
    const groupId = crypto.randomUUID();

    // Insert all links
    const linkValues = [
      {
        userId,
        groupId,
        transactionId: primaryId,
        linkRole: "primary" as const,
      },
      ...linkedIds.map((txId) => ({
        userId,
        groupId,
        transactionId: txId,
        linkRole: linkType,
      })),
    ];

    await db.insert(transactionLinks).values(linkValues);

    revalidatePath("/transactions");
    revalidatePath("/");
    return { success: true, groupId };
  } catch (error) {
    console.error("Failed to create transaction link group:", error);
    return { success: false, error: "Failed to create link group" };
  }
}

/**
 * Adds a transaction to an existing link group.
 */
export async function addTransactionToLinkGroup(
  groupId: string,
  transactionId: string,
  role: LinkRole
): Promise<{ success: boolean; error?: string }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Verify the transaction belongs to the user
    const transaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId)
      ),
    });

    if (!transaction) {
      return { success: false, error: "Transaction not found" };
    }

    // Verify the group exists and belongs to the user
    const existingGroupLink = await db.query.transactionLinks.findFirst({
      where: and(
        eq(transactionLinks.groupId, groupId),
        eq(transactionLinks.userId, userId)
      ),
    });

    if (!existingGroupLink) {
      return { success: false, error: "Link group not found" };
    }

    // Check if transaction is already linked
    const existingLink = await db.query.transactionLinks.findFirst({
      where: eq(transactionLinks.transactionId, transactionId),
    });

    if (existingLink) {
      return { success: false, error: "Transaction is already linked to a group" };
    }

    // Add the transaction to the group
    await db.insert(transactionLinks).values({
      userId,
      groupId,
      transactionId,
      linkRole: role,
    });

    revalidatePath("/transactions");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to add transaction to link group:", error);
    return { success: false, error: "Failed to add transaction to group" };
  }
}

/**
 * Removes a transaction from its link group.
 * If it's the primary transaction or the last one, deletes the entire group.
 */
export async function removeTransactionFromLinkGroup(
  transactionId: string
): Promise<{ success: boolean; error?: string; groupDeleted?: boolean }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Find the link for this transaction
    const link = await db.query.transactionLinks.findFirst({
      where: and(
        eq(transactionLinks.transactionId, transactionId),
        eq(transactionLinks.userId, userId)
      ),
    });

    if (!link) {
      return { success: false, error: "Transaction is not linked to any group" };
    }

    const groupId = link.groupId;

    // Count remaining transactions in the group
    const groupLinks = await db.query.transactionLinks.findMany({
      where: eq(transactionLinks.groupId, groupId),
    });

    // If this is the primary or there are only 2 transactions, delete the entire group
    if (link.linkRole === "primary" || groupLinks.length <= 2) {
      await db.delete(transactionLinks).where(eq(transactionLinks.groupId, groupId));

      revalidatePath("/transactions");
      revalidatePath("/");
      return { success: true, groupDeleted: true };
    }

    // Otherwise, just remove this transaction
    await db.delete(transactionLinks).where(eq(transactionLinks.transactionId, transactionId));

    revalidatePath("/transactions");
    revalidatePath("/");
    return { success: true, groupDeleted: false };
  } catch (error) {
    console.error("Failed to remove transaction from link group:", error);
    return { success: false, error: "Failed to remove transaction from group" };
  }
}

/**
 * Deletes an entire link group.
 */
export async function deleteLinkGroup(
  groupId: string
): Promise<{ success: boolean; error?: string }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Verify the group belongs to the user
    const existingLink = await db.query.transactionLinks.findFirst({
      where: and(
        eq(transactionLinks.groupId, groupId),
        eq(transactionLinks.userId, userId)
      ),
    });

    if (!existingLink) {
      return { success: false, error: "Link group not found" };
    }

    // Delete all links in the group
    await db.delete(transactionLinks).where(eq(transactionLinks.groupId, groupId));

    revalidatePath("/transactions");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete link group:", error);
    return { success: false, error: "Failed to delete link group" };
  }
}

/**
 * Gets the link group for a transaction, including all linked transactions and net amount.
 */
export async function getTransactionLinkGroup(
  transactionId: string
): Promise<TransactionLinkGroup | null> {
  const userId = await requireAuth();

  if (!userId) {
    return null;
  }

  try {
    // Find the link for this transaction
    const link = await db.query.transactionLinks.findFirst({
      where: and(
        eq(transactionLinks.transactionId, transactionId),
        eq(transactionLinks.userId, userId)
      ),
    });

    if (!link) {
      return null;
    }

    // Get all links in the group
    const groupLinks = await db.query.transactionLinks.findMany({
      where: eq(transactionLinks.groupId, link.groupId),
    });

    // Get all transactions in the group
    const txnIds = groupLinks.map((l) => l.transactionId);
    const linkedTransactions = await db.query.transactions.findMany({
      where: inArray(transactions.id, txnIds),
    });

    // Build the result
    let primary: LinkedTransaction | null = null;
    const linked: LinkedTransaction[] = [];
    let netAmount = 0;
    let currency: string | null = null;

    for (const txn of linkedTransactions) {
      const linkInfo = groupLinks.find((l) => l.transactionId === txn.id);
      const role = (linkInfo?.linkRole || "reimbursement") as LinkRole;
      const amount = parseFloat(txn.amount);

      currency = txn.currency;
      netAmount += amount;

      const linkedTxn: LinkedTransaction = {
        id: txn.id,
        amount,
        description: txn.description,
        merchant: txn.merchant,
        bookedAt: txn.bookedAt,
        transactionType: txn.transactionType,
        linkRole: role,
      };

      if (role === "primary") {
        primary = linkedTxn;
      } else {
        linked.push(linkedTxn);
      }
    }

    // Sort linked transactions by date
    linked.sort((a, b) => new Date(a.bookedAt).getTime() - new Date(b.bookedAt).getTime());

    return {
      groupId: link.groupId,
      primary,
      linked,
      netAmount,
      currency,
    };
  } catch (error) {
    console.error("Failed to get transaction link group:", error);
    return null;
  }
}

/**
 * Gets all link groups for the current user.
 */
export async function getUserLinkGroups(): Promise<TransactionLinkGroup[]> {
  const userId = await requireAuth();

  if (!userId) {
    return [];
  }

  try {
    // Get all links for the user
    const userLinks = await db.query.transactionLinks.findMany({
      where: eq(transactionLinks.userId, userId),
    });

    // Group by groupId
    const groupMap = new Map<string, TransactionLinkInfo[]>();
    for (const link of userLinks) {
      const existing = groupMap.get(link.groupId) || [];
      existing.push({
        id: link.id,
        groupId: link.groupId,
        transactionId: link.transactionId,
        linkRole: link.linkRole as LinkRole,
        createdAt: link.createdAt,
      });
      groupMap.set(link.groupId, existing);
    }

    // Build groups
    const groups: TransactionLinkGroup[] = [];

    for (const [groupId, links] of groupMap) {
      const txnIds = links.map((l) => l.transactionId);
      const linkedTransactions = await db.query.transactions.findMany({
        where: inArray(transactions.id, txnIds),
      });

      let primary: LinkedTransaction | null = null;
      const linked: LinkedTransaction[] = [];
      let netAmount = 0;
      let currency: string | null = null;

      for (const txn of linkedTransactions) {
        const linkInfo = links.find((l) => l.transactionId === txn.id);
        const role = (linkInfo?.linkRole || "reimbursement") as LinkRole;
        const amount = parseFloat(txn.amount);

        currency = txn.currency;
        netAmount += amount;

        const linkedTxn: LinkedTransaction = {
          id: txn.id,
          amount,
          description: txn.description,
          merchant: txn.merchant,
          bookedAt: txn.bookedAt,
          transactionType: txn.transactionType,
          linkRole: role,
        };

        if (role === "primary") {
          primary = linkedTxn;
        } else {
          linked.push(linkedTxn);
        }
      }

      linked.sort((a, b) => new Date(a.bookedAt).getTime() - new Date(b.bookedAt).getTime());

      groups.push({
        groupId,
        primary,
        linked,
        netAmount,
        currency,
      });
    }

    return groups;
  } catch (error) {
    console.error("Failed to get user link groups:", error);
    return [];
  }
}

/**
 * Finds potential reimbursement transactions for an expense.
 * Returns credits across all accounts with server-side filtering and pagination.
 */
export async function findPotentialReimbursements(
  transactionId: string,
  filters: LinkSearchFilters = {}
): Promise<LinkSearchResult> {
  const userId = await requireAuth();

  if (!userId) {
    return { transactions: [], totalCount: 0, hasMore: false };
  }

  const {
    searchQuery,
    accountId,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    page = 1,
    pageSize = 50,
  } = filters;

  try {
    // Get the source transaction
    const sourceTxn = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId)
      ),
    });

    if (!sourceTxn) {
      return { transactions: [], totalCount: 0, hasMore: false };
    }

    // Only look for reimbursements for expenses (debit/negative amounts)
    const sourceAmount = parseFloat(sourceTxn.amount);
    if (sourceAmount >= 0) {
      return { transactions: [], totalCount: 0, hasMore: false };
    }

    // Get already linked transaction IDs
    const linkedTxnIds = await db
      .select({ transactionId: transactionLinks.transactionId })
      .from(transactionLinks)
      .where(eq(transactionLinks.userId, userId));

    const linkedIds = linkedTxnIds.map((l) => l.transactionId);

    // Build conditions
    const conditions = [
      eq(transactions.userId, userId),
      eq(transactions.transactionType, "credit"),
      eq(transactions.currency, sourceTxn.currency || "EUR"),
      ne(transactions.id, transactionId),
    ];

    // Exclude already linked transactions
    if (linkedIds.length > 0) {
      conditions.push(sql`${transactions.id} NOT IN (${sql.join(linkedIds.map(id => sql`${id}`), sql`, `)})`);
    }

    // Search filter
    if (searchQuery) {
      conditions.push(
        or(
          ilike(transactions.merchant, `%${searchQuery}%`),
          ilike(transactions.description, `%${searchQuery}%`)
        )!
      );
    }

    // Account filter
    if (accountId) {
      conditions.push(eq(transactions.accountId, accountId));
    }

    // Date range filter
    if (dateFrom) {
      conditions.push(gte(transactions.bookedAt, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(transactions.bookedAt, dateTo));
    }

    // Amount range filter (on absolute value)
    if (minAmount !== undefined) {
      conditions.push(gte(transactions.amount, String(minAmount)));
    }
    if (maxAmount !== undefined) {
      conditions.push(lte(transactions.amount, String(maxAmount)));
    }

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(transactions)
      .where(and(...conditions));
    const totalCount = countResult[0]?.count || 0;

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const potentialReimbursements = await db.query.transactions.findMany({
      where: and(...conditions),
      orderBy: [desc(transactions.bookedAt)],
      limit: pageSize,
      offset,
      with: {
        account: true,
      },
    });

    const suggestions: SuggestedLink[] = potentialReimbursements.map((txn) => ({
      id: txn.id,
      amount: parseFloat(txn.amount),
      description: txn.description,
      merchant: txn.merchant,
      bookedAt: txn.bookedAt,
      transactionType: txn.transactionType,
      accountId: txn.accountId,
      accountName: txn.account?.name || null,
      score: 0,
    }));

    return {
      transactions: suggestions,
      totalCount,
      hasMore: offset + suggestions.length < totalCount,
    };
  } catch (error) {
    console.error("Failed to find potential reimbursements:", error);
    return { transactions: [], totalCount: 0, hasMore: false };
  }
}

/**
 * Finds potential expense transactions for an income/allowance.
 * Returns debits across all accounts with server-side filtering and pagination.
 */
export async function findPotentialExpenses(
  transactionId: string,
  filters: LinkSearchFilters = {}
): Promise<LinkSearchResult> {
  const userId = await requireAuth();

  if (!userId) {
    return { transactions: [], totalCount: 0, hasMore: false };
  }

  const {
    searchQuery,
    accountId,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    page = 1,
    pageSize = 50,
  } = filters;

  try {
    // Get the source transaction
    const sourceTxn = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId)
      ),
    });

    if (!sourceTxn) {
      return { transactions: [], totalCount: 0, hasMore: false };
    }

    // Only look for expenses for income (credit/positive amounts)
    const sourceAmount = parseFloat(sourceTxn.amount);
    if (sourceAmount <= 0) {
      return { transactions: [], totalCount: 0, hasMore: false };
    }

    // Get already linked transaction IDs
    const linkedTxnIds = await db
      .select({ transactionId: transactionLinks.transactionId })
      .from(transactionLinks)
      .where(eq(transactionLinks.userId, userId));

    const linkedIds = linkedTxnIds.map((l) => l.transactionId);

    // Build conditions
    const conditions = [
      eq(transactions.userId, userId),
      eq(transactions.transactionType, "debit"),
      eq(transactions.currency, sourceTxn.currency || "EUR"),
      ne(transactions.id, transactionId),
    ];

    // Exclude already linked transactions
    if (linkedIds.length > 0) {
      conditions.push(sql`${transactions.id} NOT IN (${sql.join(linkedIds.map(id => sql`${id}`), sql`, `)})`);
    }

    // Search filter
    if (searchQuery) {
      conditions.push(
        or(
          ilike(transactions.merchant, `%${searchQuery}%`),
          ilike(transactions.description, `%${searchQuery}%`)
        )!
      );
    }

    // Account filter
    if (accountId) {
      conditions.push(eq(transactions.accountId, accountId));
    }

    // Date range filter
    if (dateFrom) {
      conditions.push(gte(transactions.bookedAt, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(transactions.bookedAt, dateTo));
    }

    // Amount range filter (on absolute value, debits are negative)
    if (minAmount !== undefined) {
      conditions.push(lte(transactions.amount, String(-minAmount)));
    }
    if (maxAmount !== undefined) {
      conditions.push(gte(transactions.amount, String(-maxAmount)));
    }

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(transactions)
      .where(and(...conditions));
    const totalCount = countResult[0]?.count || 0;

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const potentialExpenses = await db.query.transactions.findMany({
      where: and(...conditions),
      orderBy: [desc(transactions.bookedAt)],
      limit: pageSize,
      offset,
      with: {
        account: true,
      },
    });

    const suggestions: SuggestedLink[] = potentialExpenses.map((txn) => ({
      id: txn.id,
      amount: parseFloat(txn.amount),
      description: txn.description,
      merchant: txn.merchant,
      bookedAt: txn.bookedAt,
      transactionType: txn.transactionType,
      accountId: txn.accountId,
      accountName: txn.account?.name || null,
      score: 0,
    }));

    return {
      transactions: suggestions,
      totalCount,
      hasMore: offset + suggestions.length < totalCount,
    };
  } catch (error) {
    console.error("Failed to find potential expenses:", error);
    return { transactions: [], totalCount: 0, hasMore: false };
  }
}

/**
 * Gets the link info for a single transaction.
 */
export async function getTransactionLinkInfo(
  transactionId: string
): Promise<TransactionLinkInfo | null> {
  const userId = await requireAuth();

  if (!userId) {
    return null;
  }

  try {
    const link = await db.query.transactionLinks.findFirst({
      where: and(
        eq(transactionLinks.transactionId, transactionId),
        eq(transactionLinks.userId, userId)
      ),
    });

    if (!link) {
      return null;
    }

    return {
      id: link.id,
      groupId: link.groupId,
      transactionId: link.transactionId,
      linkRole: link.linkRole as LinkRole,
      createdAt: link.createdAt,
    };
  } catch (error) {
    console.error("Failed to get transaction link info:", error);
    return null;
  }
}

/**
 * Bulk creates a link group from multiple selected transactions.
 * Auto-detects the primary (largest expense or income) and assigns roles.
 */
export async function createLinkGroupFromSelection(
  transactionIds: string[]
): Promise<{ success: boolean; error?: string; groupId?: string }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  if (transactionIds.length < 2) {
    return { success: false, error: "At least 2 transactions are required" };
  }

  try {
    // Verify all transactions belong to the user
    const userTransactions = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        inArray(transactions.id, transactionIds)
      ),
    });

    if (userTransactions.length !== transactionIds.length) {
      return { success: false, error: "Some transactions not found or not owned by user" };
    }

    // Check if any transaction is already linked
    const existingLinks = await db.query.transactionLinks.findMany({
      where: inArray(transactionLinks.transactionId, transactionIds),
    });

    if (existingLinks.length > 0) {
      return { success: false, error: "One or more transactions are already linked" };
    }

    // Determine primary: largest absolute amount
    let primaryTxn = userTransactions[0];
    let maxAbsAmount = Math.abs(parseFloat(userTransactions[0].amount));

    for (const txn of userTransactions) {
      const absAmount = Math.abs(parseFloat(txn.amount));
      if (absAmount > maxAbsAmount) {
        maxAbsAmount = absAmount;
        primaryTxn = txn;
      }
    }

    // Determine link type based on primary transaction type
    const primaryAmount = parseFloat(primaryTxn.amount);
    const linkType = primaryAmount < 0 ? "reimbursement" : "expense";

    // Create the group
    const groupId = crypto.randomUUID();

    const linkValues = userTransactions.map((txn) => ({
      userId,
      groupId,
      transactionId: txn.id,
      linkRole: txn.id === primaryTxn.id ? ("primary" as const) : linkType,
    }));

    await db.insert(transactionLinks).values(linkValues);

    revalidatePath("/transactions");
    revalidatePath("/");
    return { success: true, groupId };
  } catch (error) {
    console.error("Failed to create link group from selection:", error);
    return { success: false, error: "Failed to create link group" };
  }
}
