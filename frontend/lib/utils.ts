import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as currency
 * @param value - The numeric value to format
 * @param currency - ISO 4217 currency code (e.g., "EUR", "USD")
 * @param options - Optional formatting options
 */
export function formatCurrency(
  value: number,
  currency: string,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    locale?: string;
    showSign?: boolean;
  }
): string {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
    locale = "en-US",
    showSign = false,
  } = options ?? {};

  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(Math.abs(value));

  if (showSign) {
    return value < 0 ? `-${formatted}` : formatted;
  }

  return formatted;
}

/**
 * Format an amount with sign (for transactions)
 * @param amount - The transaction amount (negative for expenses)
 * @param currency - ISO 4217 currency code
 */
export function formatAmount(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return amount < 0 ? `-${formatted}` : formatted;
}

/**
 * Format a date with various presets
 * @param date - The date to format
 * @param options - Intl.DateTimeFormat options or preset name
 */
export function formatDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions | "short" | "medium" | "long"
): string {
  const presets: Record<string, Intl.DateTimeFormatOptions> = {
    short: { month: "short", day: "numeric" },
    medium: { month: "short", day: "numeric", year: "numeric" },
    long: { month: "long", day: "numeric", year: "numeric" },
  };

  const formatOptions = typeof options === "string" ? presets[options] : options ?? presets.medium;

  return new Intl.DateTimeFormat("en-GB", formatOptions).format(date);
}
