import type { Category, Account } from "@/lib/db/schema";

/**
 * Reusable category subset for UI components
 * Contains only the fields needed for display purposes
 */
export type CategoryDisplay = Pick<Category, "id" | "name" | "color" | "icon">;

/**
 * Account subset for filters and dropdowns
 * Contains only the fields needed for selection/display
 */
export type AccountDisplay = Pick<Account, "id" | "name" | "institution" | "accountType">;

/**
 * Minimal account type for filter components
 */
export interface AccountForFilter {
  id: string;
  name: string;
}

/**
 * Minimal category type for filter components
 */
export interface CategoryForFilter {
  id: string;
  name: string;
  color: string | null;
}
