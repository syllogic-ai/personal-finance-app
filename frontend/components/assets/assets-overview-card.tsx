"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { AssetsStackedBar } from "./assets-stacked-bar";
import { AssetsTable } from "./assets-table";
import { AddAssetDialog } from "./add-asset-dialog";
import type { AssetsOverviewData } from "./types";

interface AssetsOverviewCardProps {
  data: AssetsOverviewData;
}

export function AssetsOverviewCard({ data }: AssetsOverviewCardProps) {
  const router = useRouter();

  const handleAssetAdded = () => {
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle>Assets Overview</CardTitle>
            <AddAssetDialog onAssetAdded={handleAssetAdded} />
          </div>
          <span className="text-2xl font-bold">
            {formatCurrency(data.total, data.currency)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <AssetsStackedBar categories={data.categories} total={data.total} />
        <AssetsTable categories={data.categories} currency={data.currency} />
      </CardContent>
    </Card>
  );
}
