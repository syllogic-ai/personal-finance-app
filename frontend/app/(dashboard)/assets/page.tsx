import { Header } from "@/components/layout/header";
import { getAccounts } from "@/lib/actions/accounts";
import { getProperties } from "@/lib/actions/properties";
import { getVehicles } from "@/lib/actions/vehicles";
import { AssetManagement } from "./asset-management";

export default async function AssetsPage() {
  const [accounts, properties, vehicles] = await Promise.all([
    getAccounts(),
    getProperties(),
    getVehicles(),
  ]);

  return (
    <>
      <Header title="Assets" />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        <AssetManagement
          initialAccounts={accounts}
          initialProperties={properties}
          initialVehicles={vehicles}
        />
      </div>
    </>
  );
}
