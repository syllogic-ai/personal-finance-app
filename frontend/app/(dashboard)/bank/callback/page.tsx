"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RiLoader4Line, RiCheckLine, RiErrorWarningLine } from "@remixicon/react";
import { completeBankConnection } from "@/lib/actions/bank-connections";

type Status = "processing" | "success" | "error";

export default function BankCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState("Connecting your bank account...");
  const [accountCount, setAccountCount] = useState(0);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setMessage(error === "access_denied"
          ? "Bank connection was cancelled"
          : `Connection failed: ${error}`
        );
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Invalid callback parameters");
        return;
      }

      try {
        const result = await completeBankConnection(code, state);

        if (result.success) {
          setStatus("success");
          setAccountCount(result.accountCount || 0);
          setMessage(`Successfully connected ${result.accountCount || 0} account(s)`);

          // Redirect after a short delay
          setTimeout(() => {
            router.push("/settings?connected=true");
          }, 2000);
        } else {
          setStatus("error");
          setMessage(result.error || "Failed to connect bank account");
        }
      } catch (err) {
        console.error("Callback error:", err);
        setStatus("error");
        setMessage("An unexpected error occurred");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4">
        {status === "processing" && (
          <>
            <RiLoader4Line className="h-12 w-12 mx-auto animate-spin text-muted-foreground" />
            <h1 className="text-xl font-semibold">Connecting Bank Account</h1>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="h-12 w-12 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <RiCheckLine className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-xl font-semibold">Bank Connected</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="h-12 w-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <RiErrorWarningLine className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-xl font-semibold">Connection Failed</h1>
            <p className="text-muted-foreground">{message}</p>
            <button
              onClick={() => router.push("/settings")}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Go back to settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}
