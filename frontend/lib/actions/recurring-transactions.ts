"use server";

import { revalidatePath } from "next/cache";
import { eq, and, isNull, desc, asc, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  recurringTransactions,
  transactions,
  categories,
  type RecurringTransaction,
  type NewRecurringTransaction,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-helpers";

// ============================================================================
// Input Interfaces
// ============================================================================

export interface RecurringTransactionCreateInput {
  name: string;
  merchant?: string;
  amount: number;
  currency?: string;
  categoryId?: string;
  importance: number; // 1-5
  frequency: "monthly" | "weekly" | "yearly" | "quarterly" | "biweekly";
  description?: string;
}

export interface RecurringTransactionUpdateInput {
  name?: string;
  merchant?: string;
  amount?: number;
  currency?: string;
  categoryId?: string;
  importance?: number;
  frequency?: "monthly" | "weekly" | "yearly" | "quarterly" | "biweekly";
  description?: string;
  isActive?: boolean;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new recurring transaction
 */
export async function createRecurringTransaction(
  input: RecurringTransactionCreateInput
): Promise<{ success: boolean; error?: string; recurringTransactionId?: string }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Validate input
    if (!input.name?.trim()) {
      return { success: false, error: "Name is required" };
    }

    if (input.amount <= 0) {
      return { success: false, error: "Amount must be greater than 0" };
    }

    if (input.importance < 1 || input.importance > 5) {
      return { success: false, error: "Importance must be between 1 and 5" };
    }

    // Validate category belongs to user if provided
    if (input.categoryId) {
      const category = await db.query.categories.findFirst({
        where: and(
          eq(categories.id, input.categoryId),
          eq(categories.userId, userId)
        ),
      });

      if (!category) {
        return { success: false, error: "Invalid category" };
      }
    }

    // Check for duplicate name
    const existing = await db.query.recurringTransactions.findFirst({
      where: and(
        eq(recurringTransactions.userId, userId),
        eq(recurringTransactions.name, input.name.trim())
      ),
    });

    if (existing) {
      return {
        success: false,
        error: "A recurring transaction with this name already exists",
      };
    }

    // Create recurring transaction
    const [created] = await db
      .insert(recurringTransactions)
      .values({
        userId,
        name: input.name.trim(),
        merchant: input.merchant?.trim() || null,
        amount: input.amount.toFixed(2),
        currency: input.currency || "EUR",
        categoryId: input.categoryId || null,
        importance: input.importance,
        frequency: input.frequency,
        description: input.description?.trim() || null,
      })
      .returning({ id: recurringTransactions.id });

    revalidatePath("/recurring-transactions");
    return { success: true, recurringTransactionId: created.id };
  } catch (error) {
    console.error("Failed to create recurring transaction:", error);
    return { success: false, error: "Failed to create recurring transaction" };
  }
}

/**
 * Update an existing recurring transaction
 */
export async function updateRecurringTransaction(
  id: string,
  input: RecurringTransactionUpdateInput
): Promise<{ success: boolean; error?: string }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Verify ownership
    const existing = await db.query.recurringTransactions.findFirst({
      where: and(
        eq(recurringTransactions.id, id),
        eq(recurringTransactions.userId, userId)
      ),
    });

    if (!existing) {
      return { success: false, error: "Recurring transaction not found" };
    }

    // Validate inputs
    if (input.amount !== undefined && input.amount <= 0) {
      return { success: false, error: "Amount must be greater than 0" };
    }

    if (input.importance !== undefined && (input.importance < 1 || input.importance > 5)) {
      return { success: false, error: "Importance must be between 1 and 5" };
    }

    // Validate category if changing
    if (input.categoryId) {
      const category = await db.query.categories.findFirst({
        where: and(
          eq(categories.id, input.categoryId),
          eq(categories.userId, userId)
        ),
      });

      if (!category) {
        return { success: false, error: "Invalid category" };
      }
    }

    // Check for duplicate name if changing
    if (input.name && input.name.trim() !== existing.name) {
      const duplicate = await db.query.recurringTransactions.findFirst({
        where: and(
          eq(recurringTransactions.userId, userId),
          eq(recurringTransactions.name, input.name.trim())
        ),
      });

      if (duplicate) {
        return {
          success: false,
          error: "A recurring transaction with this name already exists",
        };
      }
    }

    // Build update object
    const updateData: Partial<NewRecurringTransaction> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.merchant !== undefined) updateData.merchant = input.merchant.trim() || null;
    if (input.amount !== undefined) updateData.amount = input.amount.toFixed(2);
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId || null;
    if (input.importance !== undefined) updateData.importance = input.importance;
    if (input.frequency !== undefined) updateData.frequency = input.frequency;
    if (input.description !== undefined) updateData.description = input.description?.trim() || null;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    // Update
    await db
      .update(recurringTransactions)
      .set(updateData)
      .where(eq(recurringTransactions.id, id));

    revalidatePath("/recurring-transactions");
    revalidatePath("/transactions");
    return { success: true };
  } catch (error) {
    console.error("Failed to update recurring transaction:", error);
    return { success: false, error: "Failed to update recurring transaction" };
  }
}

/**
 * Delete a recurring transaction
 */
export async function deleteRecurringTransaction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Verify ownership
    const existing = await db.query.recurringTransactions.findFirst({
      where: and(
        eq(recurringTransactions.id, id),
        eq(recurringTransactions.userId, userId)
      ),
    });

    if (!existing) {
      return { success: false, error: "Recurring transaction not found" };
    }

    // Delete (linked transactions will have recurringTransactionId set to null due to onDelete: "set null")
    await db
      .delete(recurringTransactions)
      .where(eq(recurringTransactions.id, id));

    revalidatePath("/recurring-transactions");
    revalidatePath("/transactions");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete recurring transaction:", error);
    return { success: false, error: "Failed to delete recurring transaction" };
  }
}

/**
 * Toggle active status of a recurring transaction
 */
export async function toggleRecurringTransactionActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Verify ownership
    const existing = await db.query.recurringTransactions.findFirst({
      where: and(
        eq(recurringTransactions.id, id),
        eq(recurringTransactions.userId, userId)
      ),
    });

    if (!existing) {
      return { success: false, error: "Recurring transaction not found" };
    }

    // Update active status
    await db
      .update(recurringTransactions)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(recurringTransactions.id, id));

    revalidatePath("/recurring-transactions");
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle recurring transaction active status:", error);
    return { success: false, error: "Failed to update status" };
  }
}

/**
 * Get all recurring transactions for the current user
 */
export async function getRecurringTransactions(
  includeInactive = false
): Promise<RecurringTransaction[]> {
  const userId = await requireAuth();

  if (!userId) {
    return [];
  }

  try {
    const whereConditions = includeInactive
      ? eq(recurringTransactions.userId, userId)
      : and(
          eq(recurringTransactions.userId, userId),
          eq(recurringTransactions.isActive, true)
        );

    const results = await db.query.recurringTransactions.findMany({
      where: whereConditions,
      with: {
        category: true,
      },
      orderBy: [
        desc(recurringTransactions.importance),
        asc(recurringTransactions.name),
      ],
    });

    return results;
  } catch (error) {
    console.error("Failed to get recurring transactions:", error);
    return [];
  }
}

/**
 * Get a single recurring transaction by ID
 */
export async function getRecurringTransaction(
  id: string
): Promise<RecurringTransaction | null> {
  const userId = await requireAuth();

  if (!userId) {
    return null;
  }

  try {
    const result = await db.query.recurringTransactions.findFirst({
      where: and(
        eq(recurringTransactions.id, id),
        eq(recurringTransactions.userId, userId)
      ),
      with: {
        category: true,
      },
    });

    return result || null;
  } catch (error) {
    console.error("Failed to get recurring transaction:", error);
    return null;
  }
}

// ============================================================================
// Matching & Linking Operations
// ============================================================================

export interface PotentialMatch {
  transactionId: string;
  recurringTransactionId: string;
  transaction: {
    id: string;
    merchant: string | null;
    amount: string;
    description: string | null;
    bookedAt: Date;
    accountName: string;
  };
  recurringTransaction: {
    id: string;
    name: string;
    merchant: string | null;
    amount: string;
  };
  matchScore: number; // 0-100
  matchReason: string;
}

/**
 * Simple string similarity using Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Calculate similarity score between two strings (0-100)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;
  if (s1.includes(s2) || s2.includes(s1)) return 80;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.max(0, similarity);
}

/**
 * Find potential matches between unlinked transactions and active recurring transactions
 */
export async function findPotentialMatches(): Promise<PotentialMatch[]> {
  const userId = await requireAuth();

  if (!userId) {
    return [];
  }

  try {
    // Get active recurring transactions
    const activeRecurring = await db.query.recurringTransactions.findMany({
      where: and(
        eq(recurringTransactions.userId, userId),
        eq(recurringTransactions.isActive, true)
      ),
    });

    if (activeRecurring.length === 0) {
      return [];
    }

    // Get unlinked transactions from last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const unlinkedTransactions = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        isNull(transactions.recurringTransactionId),
        sql`${transactions.bookedAt} >= ${ninetyDaysAgo}`
      ),
      with: {
        account: true,
      },
      orderBy: [desc(transactions.bookedAt)],
      limit: 500, // Limit for performance
    });

    if (unlinkedTransactions.length === 0) {
      return [];
    }

    // Find matches
    const matches: PotentialMatch[] = [];

    for (const recurring of activeRecurring) {
      for (const transaction of unlinkedTransactions) {
        let matchScore = 0;
        const reasons: string[] = [];

        // Merchant matching
        if (recurring.merchant && transaction.merchant) {
          const merchantSimilarity = calculateStringSimilarity(
            recurring.merchant,
            transaction.merchant
          );

          if (merchantSimilarity === 100) {
            matchScore += 50;
            reasons.push("Exact merchant match");
          } else if (merchantSimilarity >= 80) {
            matchScore += 30;
            reasons.push("Similar merchant");
          }
        }

        // Amount matching (±5% tolerance)
        const recurringAmount = parseFloat(recurring.amount);
        const transactionAmount = Math.abs(parseFloat(transaction.amount));
        const amountDiff = Math.abs(recurringAmount - transactionAmount);
        const amountTolerance = recurringAmount * 0.05;

        if (amountDiff === 0) {
          matchScore += 30;
          reasons.push("Exact amount match");
        } else if (amountDiff <= amountTolerance) {
          matchScore += 20;
          reasons.push("Amount within 5%");
        }

        // Category matching (bonus points)
        if (
          recurring.categoryId &&
          (transaction.categoryId === recurring.categoryId ||
            transaction.categorySystemId === recurring.categoryId)
        ) {
          matchScore += 10;
          reasons.push("Same category");
        }

        // Description fallback matching if no merchant
        if (!recurring.merchant && !transaction.merchant) {
          const descSimilarity = calculateStringSimilarity(
            recurring.name,
            transaction.description || ""
          );
          if (descSimilarity >= 70) {
            matchScore += 20;
            reasons.push("Description match");
          }
        }

        // Only include matches with score >= 50
        if (matchScore >= 50) {
          matches.push({
            transactionId: transaction.id,
            recurringTransactionId: recurring.id,
            transaction: {
              id: transaction.id,
              merchant: transaction.merchant,
              amount: transaction.amount,
              description: transaction.description,
              bookedAt: transaction.bookedAt,
              accountName: transaction.account.name,
            },
            recurringTransaction: {
              id: recurring.id,
              name: recurring.name,
              merchant: recurring.merchant,
              amount: recurring.amount,
            },
            matchScore,
            matchReason: reasons.join(", "),
          });
        }
      }
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Return top 50 matches
    return matches.slice(0, 50);
  } catch (error) {
    console.error("Failed to find potential matches:", error);
    return [];
  }
}

/**
 * Link a transaction to a recurring transaction
 */
export async function linkTransactionToRecurring(
  transactionId: string,
  recurringTransactionId: string
): Promise<{ success: boolean; error?: string }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Verify both records belong to user
    const [transaction, recurringTransaction] = await Promise.all([
      db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId)
        ),
      }),
      db.query.recurringTransactions.findFirst({
        where: and(
          eq(recurringTransactions.id, recurringTransactionId),
          eq(recurringTransactions.userId, userId)
        ),
      }),
    ]);

    if (!transaction) {
      return { success: false, error: "Transaction not found" };
    }

    if (!recurringTransaction) {
      return { success: false, error: "Recurring transaction not found" };
    }

    // Link the transaction
    await db
      .update(transactions)
      .set({
        recurringTransactionId,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, transactionId));

    revalidatePath("/transactions");
    revalidatePath("/recurring-transactions");
    return { success: true };
  } catch (error) {
    console.error("Failed to link transaction:", error);
    return { success: false, error: "Failed to link transaction" };
  }
}

/**
 * Unlink a transaction from its recurring transaction
 */
export async function unlinkTransactionFromRecurring(
  transactionId: string
): Promise<{ success: boolean; error?: string }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Verify transaction belongs to user
    const transaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId)
      ),
    });

    if (!transaction) {
      return { success: false, error: "Transaction not found" };
    }

    // Unlink the transaction
    await db
      .update(transactions)
      .set({
        recurringTransactionId: null,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, transactionId));

    revalidatePath("/transactions");
    revalidatePath("/recurring-transactions");
    return { success: true };
  } catch (error) {
    console.error("Failed to unlink transaction:", error);
    return { success: false, error: "Failed to unlink transaction" };
  }
}

/**
 * Bulk link multiple transactions to recurring transactions
 */
export async function bulkLinkTransactions(
  links: Array<{ transactionId: string; recurringTransactionId: string }>
): Promise<{ success: boolean; error?: string; linkedCount?: number }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  if (links.length === 0) {
    return { success: true, linkedCount: 0 };
  }

  try {
    // Verify all transactions and recurring transactions belong to user
    const transactionIds = links.map((l) => l.transactionId);
    const recurringTransactionIds = [...new Set(links.map((l) => l.recurringTransactionId))];

    const [userTransactions, userRecurringTransactions] = await Promise.all([
      db.query.transactions.findMany({
        where: and(
          inArray(transactions.id, transactionIds),
          eq(transactions.userId, userId)
        ),
      }),
      db.query.recurringTransactions.findMany({
        where: and(
          inArray(recurringTransactions.id, recurringTransactionIds),
          eq(recurringTransactions.userId, userId)
        ),
      }),
    ]);

    // Create sets for quick lookup
    const validTransactionIds = new Set(userTransactions.map((t) => t.id));
    const validRecurringIds = new Set(userRecurringTransactions.map((r) => r.id));

    // Filter to valid links only
    const validLinks = links.filter(
      (link) =>
        validTransactionIds.has(link.transactionId) &&
        validRecurringIds.has(link.recurringTransactionId)
    );

    if (validLinks.length === 0) {
      return { success: false, error: "No valid links found" };
    }

    // Perform bulk update
    let linkedCount = 0;
    for (const link of validLinks) {
      await db
        .update(transactions)
        .set({
          recurringTransactionId: link.recurringTransactionId,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, link.transactionId));
      linkedCount++;
    }

    revalidatePath("/transactions");
    revalidatePath("/recurring-transactions");
    return { success: true, linkedCount };
  } catch (error) {
    console.error("Failed to bulk link transactions:", error);
    return { success: false, error: "Failed to link transactions" };
  }
}

/**
 * Match transactions to a recurring transaction based on description and amount similarity.
 * Updates the recurring_transaction_id field for matched transactions.
 */
export async function matchTransactionsToRecurring(
  recurringTransactionId: string,
  descriptionSimilarityThreshold: number = 0.6,
  amountTolerancePercent: number = 0.05
): Promise<{ success: boolean; error?: string; matchedCount?: number; transactionIds?: string[] }> {
  const userId = await requireAuth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8000";

    const response = await fetch(
      `${backendUrl}/api/recurring-transactions/${recurringTransactionId}/match-transactions?user_id=${userId}&description_similarity_threshold=${descriptionSimilarityThreshold}&amount_tolerance_percent=${amountTolerancePercent}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend match failed:", response.status, errorText);
      return { success: false, error: `Failed to match transactions: ${response.status}` };
    }

    const backendResponse = await response.json();

    if (!backendResponse.success) {
      return { success: false, error: backendResponse.message };
    }

    revalidatePath("/transactions");
    revalidatePath("/recurring-transactions");

    return {
      success: true,
      matchedCount: backendResponse.matched_count,
      transactionIds: backendResponse.transaction_ids,
    };
  } catch (error) {
    console.error("Failed to match transactions:", error);
    return { success: false, error: "Failed to match transactions" };
  }
}

/**
 * Get all transactions linked to a recurring transaction
 */
export async function getLinkedTransactions(
  recurringTransactionId: string
): Promise<any[]> {
  const userId = await requireAuth();

  if (!userId) {
    return [];
  }

  try {
    // Verify recurring transaction belongs to user
    const recurringTransaction = await db.query.recurringTransactions.findFirst({
      where: and(
        eq(recurringTransactions.id, recurringTransactionId),
        eq(recurringTransactions.userId, userId)
      ),
    });

    if (!recurringTransaction) {
      return [];
    }

    // Get linked transactions
    const linkedTransactions = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        eq(transactions.recurringTransactionId, recurringTransactionId)
      ),
      with: {
        account: true,
        category: true,
      },
      orderBy: [desc(transactions.bookedAt)],
    });

    return linkedTransactions;
  } catch (error) {
    console.error("Failed to get linked transactions:", error);
    return [];
  }
}
