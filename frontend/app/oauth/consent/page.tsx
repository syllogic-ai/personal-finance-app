import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ConsentForm } from "./consent-form";

type SearchParams = {
  client_id?: string;
  scope?: string;
  redirect_uri?: string;
  state?: string;
  [key: string]: string | string[] | undefined;
};

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    const returnTo =
      "/oauth/consent?" +
      new URLSearchParams(
        Object.entries(params).flatMap(([k, v]) =>
          typeof v === "string" ? [[k, v] as [string, string]] : []
        )
      ).toString();
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const clientName = params.client_id ?? "Unknown client";
  const scopes = (params.scope ?? "").split(" ").filter(Boolean);

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Authorize {clientName}</h1>
      <p className="text-sm text-muted-foreground">
        <strong>{clientName}</strong> is requesting access to your Syllogic
        account. If you approve, it will be able to:
      </p>
      <ul className="list-disc pl-6 text-sm">
        {scopes.includes("mcp:access") && (
          <li>View and update your financial data via the Syllogic MCP server</li>
        )}
        {scopes.length === 0 && <li>Access your Syllogic data</li>}
      </ul>
      <ConsentForm params={params} />
    </main>
  );
}
