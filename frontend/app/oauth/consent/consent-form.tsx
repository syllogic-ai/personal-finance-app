"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  params: Record<string, string | string[] | undefined>;
};

export function ConsentForm({ params }: Props) {
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);

  async function submit(decision: "allow" | "deny") {
    setPending(decision);
    const res = await fetch("/api/auth/oauth2/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, decision }),
    });
    if (res.redirected) {
      window.location.assign(res.url);
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (body.redirect_uri) {
      window.location.assign(body.redirect_uri);
      return;
    }
    setPending(null);
  }

  return (
    <div className="flex gap-3">
      <Button
        variant="default"
        disabled={pending !== null}
        onClick={() => submit("allow")}
      >
        {pending === "allow" ? "Authorizing…" : "Allow"}
      </Button>
      <Button
        variant="outline"
        disabled={pending !== null}
        onClick={() => submit("deny")}
      >
        Deny
      </Button>
    </div>
  );
}
