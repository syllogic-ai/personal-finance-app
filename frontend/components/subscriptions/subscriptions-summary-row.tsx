"use client";

import type { SubscriptionOrSuggestion } from "./subscriptions-client";
import { calculateMonthlyEquivalent, getCurrencyFallback } from "./subscription-math";

interface SubscriptionsSummaryRowProps {
  data: SubscriptionOrSuggestion[];
}

export function SubscriptionsSummaryRow({
  data,
}: SubscriptionsSummaryRowProps) {
  // Only sum active subscriptions (exclude suggestions)
  const activeSubscriptions = data.filter((s) => !s.isSuggestion && s.isActive);

  const monthlyTotal = activeSubscriptions.reduce((sum, subscription) => {
    return sum + calculateMonthlyEquivalent(subscription);
  }, 0);

  // Get currency from first subscription (assuming all use same currency)
  const currency = getCurrencyFallback(data);

  return (
    <div className="border-t bg-muted/30 px-4 py-3 flex items-center justify-between">
      <span className="text-sm font-medium text-muted-foreground">
        Monthly Total
      </span>
      <span className="text-sm font-mono font-semibold">
        {monthlyTotal.toFixed(2)} {currency}
      </span>
    </div>
  );
}
