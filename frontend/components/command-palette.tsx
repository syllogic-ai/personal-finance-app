"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  RiDashboardLine,
  RiExchangeLine,
  RiSettings3Line,
  RiAddLine,
  RiMoonLine,
  RiSunLine,
  RiComputerLine,
  RiPieChartLine,
} from "@remixicon/react";
import {
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";

interface CommandPaletteProps {
  onAddTransaction?: () => void;
}

export function CommandPalette({ onAddTransaction }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { setTheme, theme } = useTheme();

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // CMD+K or CTRL+K to toggle command palette
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }

      // CMD+N or CTRL+N to add transaction
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onAddTransaction?.();
      }

      // CMD+/ or CTRL+/ to toggle theme
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setTheme(theme === "dark" ? "light" : "dark");
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [theme, setTheme, onAddTransaction]);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:font-medium">
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Navigation">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/"))}
            >
              <RiDashboardLine className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
              <CommandShortcut>G D</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/transactions"))}
            >
              <RiExchangeLine className="mr-2 h-4 w-4" />
              <span>Transactions</span>
              <CommandShortcut>G T</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/assets"))}
            >
              <RiPieChartLine className="mr-2 h-4 w-4" />
              <span>Assets</span>
              <CommandShortcut>G A</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/settings"))}
            >
              <RiSettings3Line className="mr-2 h-4 w-4" />
              <span>Settings</span>
              <CommandShortcut>G S</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => runCommand(() => onAddTransaction?.())}
            >
              <RiAddLine className="mr-2 h-4 w-4" />
              <span>Add Transaction</span>
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
              <RiSunLine className="mr-2 h-4 w-4" />
              <span>Light Mode</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
              <RiMoonLine className="mr-2 h-4 w-4" />
              <span>Dark Mode</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme("system"))}>
              <RiComputerLine className="mr-2 h-4 w-4" />
              <span>System Theme</span>
              <CommandShortcut>⌘/</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
