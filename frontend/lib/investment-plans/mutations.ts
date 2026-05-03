import { db } from "@/lib/db";
import { investmentPlans, investmentPlanRuns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { SlotConfig } from "./schema";
import { validateSlots } from "./schema";

export type PlanInput = {
  name: string;
  description?: string | null;
  totalMonthly: number;
  currency: string;
  slots: SlotConfig[];
  cron: string;
  timezone: string;
  scheduleHuman: string;
  recipientEmail?: string | null;
  model?: string;
  enabled?: boolean;
};

export async function createPlan(userId: string, input: PlanInput) {
  validateSlots(input.slots, input.totalMonthly);
  const [row] = await db.insert(investmentPlans).values({
    userId,
    name: input.name,
    description: input.description ?? null,
    totalMonthly: String(input.totalMonthly),
    currency: input.currency,
    slots: input.slots,
    cron: input.cron,
    timezone: input.timezone,
    scheduleHuman: input.scheduleHuman,
    recipientEmail: input.recipientEmail ?? null,
    model: input.model ?? "claude-sonnet-4-6",
    enabled: input.enabled ?? true,
  }).returning();
  return row;
}

export async function updatePlan(userId: string, id: string, patch: Partial<PlanInput>) {
  if (patch.slots !== undefined && patch.totalMonthly !== undefined) {
    validateSlots(patch.slots, patch.totalMonthly);
  }
  const [row] = await db.update(investmentPlans)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.totalMonthly !== undefined ? { totalMonthly: String(patch.totalMonthly) } : {}),
      ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
      ...(patch.slots !== undefined ? { slots: patch.slots } : {}),
      ...(patch.cron !== undefined ? { cron: patch.cron } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
      ...(patch.scheduleHuman !== undefined ? { scheduleHuman: patch.scheduleHuman } : {}),
      ...(patch.recipientEmail !== undefined ? { recipientEmail: patch.recipientEmail } : {}),
      ...(patch.model !== undefined ? { model: patch.model } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(investmentPlans.id, id), eq(investmentPlans.userId, userId)))
    .returning();
  return row;
}

export async function deletePlan(userId: string, id: string) {
  await db.delete(investmentPlans).where(and(eq(investmentPlans.id, id), eq(investmentPlans.userId, userId)));
}

export type ExecutionMark = { executedAt: string | null; note?: string };

export async function setExecutionMark(
  userId: string, runId: string, slotId: string, mark: ExecutionMark
) {
  const [run] = await db.select({ marks: investmentPlanRuns.executionMarks })
    .from(investmentPlanRuns)
    .where(and(eq(investmentPlanRuns.id, runId), eq(investmentPlanRuns.userId, userId)))
    .limit(1);
  if (!run) throw new Error("run not found");
  const current = (run.marks as Record<string, ExecutionMark>) ?? {};
  if (mark.executedAt === null) {
    delete current[slotId];
  } else {
    current[slotId] = mark;
  }
  await db.update(investmentPlanRuns)
    .set({ executionMarks: current })
    .where(and(eq(investmentPlanRuns.id, runId), eq(investmentPlanRuns.userId, userId)));
}
