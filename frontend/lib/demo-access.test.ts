import { describe, expect, it } from "vitest";
import {
  getConfiguredDemoUserEmail,
  getDemoRestrictionState,
  isDemoModeEnabled,
  isDemoRestrictedUserEmail,
} from "@/lib/demo-access";

const ORIGINAL_ENV = {
  DEMO_MODE: process.env.DEMO_MODE,
  DEMO_SHARED_USER_EMAIL: process.env.DEMO_SHARED_USER_EMAIL,
  NEXT_PUBLIC_DEMO_EMAIL: process.env.NEXT_PUBLIC_DEMO_EMAIL,
};

function restoreEnv() {
  if (ORIGINAL_ENV.DEMO_MODE === undefined) {
    delete process.env.DEMO_MODE;
  } else {
    process.env.DEMO_MODE = ORIGINAL_ENV.DEMO_MODE;
  }

  if (ORIGINAL_ENV.DEMO_SHARED_USER_EMAIL === undefined) {
    delete process.env.DEMO_SHARED_USER_EMAIL;
  } else {
    process.env.DEMO_SHARED_USER_EMAIL = ORIGINAL_ENV.DEMO_SHARED_USER_EMAIL;
  }

  if (ORIGINAL_ENV.NEXT_PUBLIC_DEMO_EMAIL === undefined) {
    delete process.env.NEXT_PUBLIC_DEMO_EMAIL;
  } else {
    process.env.NEXT_PUBLIC_DEMO_EMAIL = ORIGINAL_ENV.NEXT_PUBLIC_DEMO_EMAIL;
  }
}

describe("demo access helpers", () => {
  it("enables restrictions only when demo mode is on and the email matches", () => {
    try {
      process.env.DEMO_MODE = "true";
      process.env.DEMO_SHARED_USER_EMAIL = "user@example.com";
      process.env.NEXT_PUBLIC_DEMO_EMAIL = "";

      expect(isDemoModeEnabled()).toBe(true);
      expect(getConfiguredDemoUserEmail()).toBe("user@example.com");
      expect(isDemoRestrictedUserEmail("USER@example.com")).toBe(true);
      expect(isDemoRestrictedUserEmail("someone@example.com")).toBe(false);
    } finally {
      restoreEnv();
    }
  });

  it("falls back to the public demo email when the shared email is absent", () => {
    try {
      process.env.DEMO_MODE = "yes";
      delete process.env.DEMO_SHARED_USER_EMAIL;
      process.env.NEXT_PUBLIC_DEMO_EMAIL = "user@example.com";

      expect(getConfiguredDemoUserEmail()).toBe("user@example.com");
      expect(
        getDemoRestrictionState("user@example.com").isDemoRestrictedUser
      ).toBe(true);
    } finally {
      restoreEnv();
    }
  });

  it("keeps non-demo users unrestricted when demo mode is disabled", () => {
    try {
      process.env.DEMO_MODE = "false";
      process.env.DEMO_SHARED_USER_EMAIL = "user@example.com";

      expect(isDemoModeEnabled()).toBe(false);
      expect(isDemoRestrictedUserEmail("user@example.com")).toBe(false);
      expect(getDemoRestrictionState("user@example.com")).toEqual({
        demoModeEnabled: false,
        demoUserEmail: "user@example.com",
        isDemoRestrictedUser: false,
      });
    } finally {
      restoreEnv();
    }
  });
});
