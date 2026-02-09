import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOnboardingStatus, getOnboardingRedirectPath } from "@/lib/actions/onboarding";

export default async function StepFourLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const onboardingStatus = await getOnboardingStatus();
  if (onboardingStatus && !onboardingStatus.isCompleted) {
    const redirectPath = await getOnboardingRedirectPath(onboardingStatus.status);
    redirect(redirectPath);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-5xl">{children}</div>
    </div>
  );
}
