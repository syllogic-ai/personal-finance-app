"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, ACCOUNT_TYPES } from "@/lib/constants";
import { createAccount } from "@/lib/actions/accounts";

interface AccountFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  successMessage?: string;
}

export function AccountForm({
  onSuccess,
  onCancel,
  submitLabel = "Create Account",
  cancelLabel = "Cancel",
  showCancel = true,
  successMessage = "Account created successfully",
}: AccountFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("");
  const [institution, setInstitution] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [initialBalance, setInitialBalance] = useState("");

  const resetForm = () => {
    setName("");
    setAccountType("");
    setInstitution("");
    setCurrency("EUR");
    setInitialBalance("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter an account name");
      return;
    }

    if (!accountType) {
      toast.error("Please select an account type");
      return;
    }

    if (!currency) {
      toast.error("Please select a currency");
      return;
    }

    setIsLoading(true);

    try {
      const balance = initialBalance ? parseFloat(initialBalance) : 0;
      if (initialBalance && isNaN(balance)) {
        toast.error("Please enter a valid initial balance");
        setIsLoading(false);
        return;
      }

      const result = await createAccount({
        name: name.trim(),
        accountType,
        institution: institution.trim() || undefined,
        currency,
        startingBalance: balance,
      });

      if (result.success) {
        toast.success(successMessage);
        resetForm();
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to create account");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="account-name">Account Name</Label>
          <Input
            id="account-name"
            placeholder="e.g., Main Checking"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-type">Account Type</Label>
          <Select value={accountType} onValueChange={(v) => v && setAccountType(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-institution">Institution (optional)</Label>
          <Input
            id="account-institution"
            placeholder="e.g., Bank of America"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-currency">Currency</Label>
          <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((curr) => (
                <SelectItem key={curr.code} value={curr.code}>
                  {curr.code} - {curr.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-balance">Initial Balance (optional)</Label>
          <Input
            id="account-balance"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {showCancel && (
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Creating..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
