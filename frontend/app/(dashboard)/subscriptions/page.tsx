import { Header } from "@/components/layout/header";
import { SubscriptionsClient } from "@/components/subscriptions/subscriptions-client";
import { getSubscriptions } from "@/lib/actions/subscriptions";
import { getUserCategories } from "@/lib/actions/categories";

export default async function SubscriptionsPage() {
  const [subscriptions, categories] = await Promise.all([
    getSubscriptions(),
    getUserCategories(),
  ]);

  return (
    <>
      <Header title="Subscriptions" />
      <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 pt-0">
        <SubscriptionsClient
          initialSubscriptions={subscriptions}
          categories={categories}
        />
      </div>
    </>
  );
}
