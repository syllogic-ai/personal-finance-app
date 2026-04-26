import {
  getPortfolio,
  listHoldings,
  getPortfolioHistory,
} from "@/lib/api/investments";
import { Header } from "@/components/layout/header";
import { InvestmentsOverview } from "@/components/investments/InvestmentsOverview";
import { InvestmentsEmpty } from "@/components/investments/InvestmentsEmpty";
import { rangeToDates } from "@/lib/utils/date-ranges";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const [portfolio, holdings] = await Promise.all([
    getPortfolio(),
    listHoldings(),
  ]);
  if (holdings.length === 0) {
    return (
      <>
        <Header title="Investments" />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <InvestmentsEmpty />
        </div>
      </>
    );
  }
  const { from, to } = rangeToDates("1M");
  const history = await getPortfolioHistory(from, to);
  return (
    <>
      <Header title="Investments" />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        <InvestmentsOverview
          portfolio={portfolio}
          holdings={holdings}
          initialHistory={history}
          initialRange="1M"
        />
      </div>
    </>
  );
}
