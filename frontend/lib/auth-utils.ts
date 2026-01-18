"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Result type for authentication check
 */
export type AuthResult =
  | { success: true; userId: string }
  | { success: false; error: string };

/**
 * Require authentication for server actions
 * Returns userId if authenticated, otherwise returns an error
 * 
 * @example
 * ```ts
 * const authResult = await requireAuth();
 * if (!authResult.success) {
 *   return { success: false, error: authResult.error };
 * }
 * const userId = authResult.userId;
 * ```
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  return { success: true, userId: session.user.id };
}

/**
 * Get the current user ID if authenticated
 * Returns null if not authenticated (for optional auth scenarios)
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user?.id ?? null;
}
