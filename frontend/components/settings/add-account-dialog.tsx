"use client";

import { useState } from "react";
import { RiAddLine } from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/accounts/account-form";

interface AddAccountDialogProps {
  onAccountAdded?: () => void;
}

export function AddAccountDialog({ onAccountAdded }: AddAccountDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <RiAddLine className="mr-2 h-4 w-4" />
        Add Account
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
          <DialogDescription>
            Create a new account to track your finances.
          </DialogDescription>
        </DialogHeader>
        <AccountForm
          onSuccess={() => {
            setOpen(false);
            onAccountAdded?.();
          }}
          onCancel={() => setOpen(false)}
          submitLabel="Create Account"
          successMessage="Account created successfully"
        />
      </DialogContent>
    </Dialog>
  );
}
