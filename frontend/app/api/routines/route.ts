import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-helpers";
import { listRoutines, createRoutine } from "@/lib/routines";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  prompt: z.string().min(1),
  cron: z.string().min(1).max(100),
  timezone: z.string().min(1).max(64),
  scheduleHuman: z.string().min(1),
  recipientEmail: z.string().email(),
  model: z.string().optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  const userId = await requireAuth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listRoutines(userId);
  return NextResponse.json({ routines: rows });
}

export async function POST(req: NextRequest) {
  const userId = await requireAuth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const input = createSchema.parse(await req.json());
  const row = await createRoutine(userId, input);
  return NextResponse.json({ routine: row }, { status: 201 });
}
