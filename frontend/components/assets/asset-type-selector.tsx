"use client";

import { RiHome4Line, RiCarLine, RiBankLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import type { AssetType } from "./types";

interface AssetTypeOption {
  type: AssetType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ASSET_TYPE_OPTIONS: AssetTypeOption[] = [
  {
    type: "property",
    label: "Property",
    description: "Add a house, apartment, or land",
    icon: RiHome4Line,
  },
  {
    type: "vehicle",
    label: "Vehicle",
    description: "Add a car, motorcycle, or boat",
    icon: RiCarLine,
  },
  {
    type: "account",
    label: "Account",
    description: "Add a bank account or cash",
    icon: RiBankLine,
  },
];

interface AssetTypeSelectorProps {
  onSelect: (type: AssetType) => void;
}

export function AssetTypeSelector({ onSelect }: AssetTypeSelectorProps) {
  return (
    <div className="grid gap-4">
      {ASSET_TYPE_OPTIONS.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.type}
            type="button"
            onClick={() => onSelect(option.type)}
            className={cn(
              "flex items-center gap-4 p-4 rounded-md border text-left",
              "transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="font-medium">{option.label}</div>
              <div className="text-sm text-muted-foreground">
                {option.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
