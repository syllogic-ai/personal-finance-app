const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export const DEMO_RESTRICTED_ACTION_ERROR =
  "This action is disabled for the demo account.";

function normalizeEmail(email?: string | null): string | null {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}

export function isDemoModeEnabled(): boolean {
  const raw = process.env.DEMO_MODE?.trim().toLowerCase();
  return raw ? TRUE_VALUES.has(raw) : false;
}

export function getConfiguredDemoUserEmail(): string | null {
  return normalizeEmail(
    process.env.DEMO_SHARED_USER_EMAIL || process.env.NEXT_PUBLIC_DEMO_EMAIL
  );
}

export function isDemoRestrictedUserEmail(email?: string | null): boolean {
  const configuredDemoEmail = getConfiguredDemoUserEmail();
  const normalizedEmail = normalizeEmail(email);

  return (
    isDemoModeEnabled() &&
    !!configuredDemoEmail &&
    normalizedEmail === configuredDemoEmail
  );
}

export function getDemoRestrictionState(email?: string | null) {
  const demoUserEmail = getConfiguredDemoUserEmail();
  return {
    demoModeEnabled: isDemoModeEnabled(),
    demoUserEmail,
    isDemoRestrictedUser: isDemoRestrictedUserEmail(email),
  };
}
