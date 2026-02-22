import { SubscriptionsClient } from "@/components/subscriptions/subscriptions-client";
import { getSubscriptions, getSubscriptionKpis } from "@/lib/actions/subscriptions";
import { getUserCategories } from "@/lib/actions/categories";
import { getPendingSuggestions } from "@/lib/actions/subscription-suggestions";
import { getAccounts } from "@/lib/actions/accounts";

export default async function SubscriptionsPage() {
  const [subscriptions, accounts, categories, suggestions, kpis] = await Promise.all([
    getSubscriptions(),
    getAccounts(),
    getUserCategories(),
    getPendingSuggestions(),
    getSubscriptionKpis(),
  ]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      <SubscriptionsClient
        initialSubscriptions={subscriptions}
        accounts={accounts}
        categories={categories}
        suggestions={suggestions}
        kpis={kpis}
      />
    </div>
  );
}
