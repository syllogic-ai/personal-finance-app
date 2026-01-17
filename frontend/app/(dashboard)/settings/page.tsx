import { Header } from "@/components/layout/header";

export default function SettingsPage() {
  return (
    <>
      <Header title="Settings" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex h-[400px] items-center justify-center rounded border border-dashed">
          <p className="text-muted-foreground">Settings coming soon</p>
        </div>
      </div>
    </>
  );
}
