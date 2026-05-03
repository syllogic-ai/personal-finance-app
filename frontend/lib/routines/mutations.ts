import { db } from "@/lib/db";
import { routines } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export type RoutineInput = {
  name: string;
  description?: string | null;
  prompt: string;
  cron: string;
  timezone: string;
  scheduleHuman: string;
  recipientEmail: string;
  model?: string;
  enabled?: boolean;
};

export async function createRoutine(userId: string, input: RoutineInput) {
  const [row] = await db
    .insert(routines)
    .values({
      userId,
      name: input.name,
      description: input.description ?? null,
      prompt: input.prompt,
      cron: input.cron,
      timezone: input.timezone,
      scheduleHuman: input.scheduleHuman,
      recipientEmail: input.recipientEmail,
      model: input.model ?? "claude-sonnet-4-6",
      enabled: input.enabled ?? true,
    })
    .returning();
  return row;
}

export async function updateRoutine(userId: string, id: string, patch: Partial<RoutineInput>) {
  const [row] = await db
    .update(routines)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
      ...(patch.cron !== undefined ? { cron: patch.cron } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
      ...(patch.scheduleHuman !== undefined ? { scheduleHuman: patch.scheduleHuman } : {}),
      ...(patch.recipientEmail !== undefined ? { recipientEmail: patch.recipientEmail } : {}),
      ...(patch.model !== undefined ? { model: patch.model } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(routines.id, id), eq(routines.userId, userId)))
    .returning();
  return row;
}

export async function deleteRoutine(userId: string, id: string) {
  await db.delete(routines).where(and(eq(routines.id, id), eq(routines.userId, userId)));
}
