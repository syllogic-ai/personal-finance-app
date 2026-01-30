"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RiArrowLeftLine,
  RiCheckLine,
  RiBankLine,
  RiArrowRightLine,
} from "@remixicon/react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { ConnectBankButton } from "@/components/bank-connect";
import { BankConnectionStatus } from "@/components/bank-connect";
import { completeOnboarding } from "@/lib/actions/onboarding";
import {
  getBankConnections,
  type BankConnection,
} from "@/lib/actions/bank-connections";

export default function Step3Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);

  // Check for successful connection from callback
  const connected = searchParams.get("connected") === "true";

  useEffect(() => {
    const loadConnections = async () => {
      setIsLoadingConnections(true);
      const data = await getBankConnections();
      setConnections(data);
      setIsLoadingConnections(false);
    };

    loadConnections();

    if (connected) {
      toast.success("Bank connected successfully!");
    }
  }, [connected]);

  const handleComplete = async () => {
    setIsLoading(true);

    try {
      const result = await completeOnboarding();

      if (result.success) {
        toast.success("Setup complete! Welcome to your dashboard.");
        router.push("/");
      } else {
        toast.error(result.error || "Failed to complete setup");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshConnections = async () => {
    const data = await getBankConnections();
    setConnections(data);
  };

  const hasConnections = connections.length > 0;

  return (
    <div className="flex flex-col h-full">
      <OnboardingProgress currentStep={3} />

      <Card className="flex flex-col flex-1 mt-8">
        <CardHeader>
          <CardTitle>Connect Your Bank (Optional)</CardTitle>
          <CardDescription>
            Securely connect your bank account to automatically sync transactions.
            You can skip this step and add accounts manually later.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1">
          {isLoadingConnections ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : hasConnections ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You have connected the following bank(s):
              </p>
              {connections.map((connection) => (
                <BankConnectionStatus
                  key={connection.id}
                  connection={connection}
                  onUpdate={handleRefreshConnections}
                />
              ))}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  Want to connect another bank?
                </p>
                <ConnectBankButton variant="outline" />
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6 py-8">
              <div className="h-20 w-20 mx-auto bg-muted rounded-full flex items-center justify-center">
                <RiBankLine className="h-10 w-10 text-muted-foreground" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-lg font-semibold">
                  Automatic Transaction Sync
                </h3>
                <p className="text-sm text-muted-foreground">
                  Connect your bank account securely via Ponto to automatically
                  import and sync your transactions. Your credentials are never
                  stored on our servers.
                </p>
              </div>

              <div className="space-y-3">
                <ConnectBankButton size="lg" />
                <p className="text-xs text-muted-foreground">
                  Powered by Ponto Connect (Isabel Group)
                </p>
              </div>

              <div className="pt-6 border-t max-w-md mx-auto">
                <p className="text-xs text-muted-foreground">
                  <strong>Why connect?</strong>
                  <br />
                  Automatic sync means less manual data entry. Transactions are
                  synced daily, and you can trigger manual syncs anytime.
                </p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-between border-t pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/step-2")}
          >
            <RiArrowLeftLine className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="flex gap-3">
            {!hasConnections && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleComplete}
                disabled={isLoading}
              >
                Skip for now
                <RiArrowRightLine className="ml-2 h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              onClick={handleComplete}
              disabled={isLoading}
            >
              {isLoading ? "Completing..." : hasConnections ? "Complete Setup" : "Complete Setup"}
              <RiCheckLine className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
