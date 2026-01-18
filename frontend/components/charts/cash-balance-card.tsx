import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiWalletLine } from "@remixicon/react";

interface CashBalanceCardProps {
  balance: number;
  currency: string;
}

export function CashBalanceCard({ balance, currency }: CashBalanceCardProps) {
  const formattedBalance = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
        <RiWalletLine className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedBalance}</div>
        <p className="text-xs text-muted-foreground">
          Across all active accounts
        </p>
      </CardContent>
    </Card>
  );
}
