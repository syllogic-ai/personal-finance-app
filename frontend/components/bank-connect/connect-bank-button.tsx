"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RiBankLine, RiLoader4Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { initiateBankConnection } from "@/lib/actions/bank-connections";

interface ConnectBankButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  onSuccess?: () => void;
}

export function ConnectBankButton({
  variant = "default",
  size = "default",
  className,
  onSuccess,
}: ConnectBankButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);

    try {
      const result = await initiateBankConnection();

      if (result.success && result.authorizationUrl) {
        // Redirect to Ponto authorization
        window.location.href = result.authorizationUrl;
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to initiate bank connection");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Connect bank error:", error);
      toast.error("Failed to connect bank. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleConnect}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <RiBankLine className="mr-2 h-4 w-4" />
          Connect Bank
        </>
      )}
    </Button>
  );
}
