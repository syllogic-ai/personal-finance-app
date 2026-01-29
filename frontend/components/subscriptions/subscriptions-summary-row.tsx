"use client";

import type { RecurringTransaction } from "@/lib/db/schema";

interface SubscriptionWithCategory extends RecurringTransaction {
  category?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

interface SubscriptionsSummaryRowProps {
  subscriptions: SubscriptionWithCategory[];
}

/**
 * Monthly equivalent multipliers for different frequencies
 */
const frequencyMultipliers: Record<string, number> = {
  weekly: 4,      // 4 weeks per month
  biweekly: 2,    // 2 bi-weeks per month
  monthly: 1,     // 1:1
  quarterly: 1/3, // once per 3 months
  yearly: 1/12,   // once per 12 months
};

/**
 * Calculate the monthly equivalent for a subscription
 */
function calculateMonthlyEquivalent(subscription: SubscriptionWithCategory): number {
  const amount = Math.abs(parseFloat(subscription.amount || "0"));
  const multiplier = frequencyMultipliers[subscription.frequency] || 1;
  return amount * multiplier;
}

export function SubscriptionsSummaryRow({
  subscriptions,
}: SubscriptionsSummaryRowProps) {
  // Only sum active subscriptions
  const activeSubscriptions = subscriptions.filter((s) => s.isActive);

  const monthlyTotal = activeSubscriptions.reduce((sum, subscription) => {
    return sum + calculateMonthlyEquivalent(subscription);
  }, 0);

  // Get currency from first subscription (assuming all use same currency)
  const currency = subscriptions[0]?.currency || "EUR";

  return (
    <div className="border-t bg-muted/30 px-4 py-3 flex items-center justify-between">
      <span className="text-sm font-medium text-muted-foreground">
        Total
      </span>
      <span className="text-sm font-mono font-semibold">
        {monthlyTotal.toFixed(2)} {currency}
      </span>
    </div>
  );
}
