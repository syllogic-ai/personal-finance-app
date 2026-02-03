import type { SubscriptionOrSuggestion } from "./subscriptions-client";

/**
 * Monthly equivalent multipliers for different frequencies.
 */
export const frequencyMultipliers: Record<string, number> = {
  weekly: 4, // 4 weeks per month
  biweekly: 2, // 2 bi-weeks per month
  monthly: 1, // 1:1
  quarterly: 1 / 3, // once per 3 months
  yearly: 1 / 12, // once per 12 months
};

/**
 * Calculate the monthly equivalent for a subscription-like item.
 */
export function calculateMonthlyEquivalent(
  item: SubscriptionOrSuggestion
): number {
  const amount = Math.abs(parseFloat(item.amount || "0"));
  const multiplier = frequencyMultipliers[item.frequency] || 1;
  return amount * multiplier;
}

export function getCurrencyFallback(
  items: SubscriptionOrSuggestion[],
  fallback = "EUR"
): string {
  return items.find((item) => item.currency)?.currency || fallback;
}
