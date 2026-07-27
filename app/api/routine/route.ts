import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getRoutine } from "@/lib/db";

export async function GET() {
  const routine = await getRoutine();
  return NextResponse.json({ routine });
}

// body: { items: [{id?, label, start_time, end_time, sort_order}] }
// Replaces the whole routine list.
export async function POST(req: NextRequest) {
  const { items } = await req.json();
  if (!Array.isArray(items)) return NextResponse.json({ error: "items required" }, { status: 400 });

  await sql`DELETE FROM routine_items`;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    await sql`
      INSERT INTO routine_items (label, start_time, end_time, sort_order)
      VALUES (${it.label}, ${it.start_time}, ${it.end_time ?? null}, ${i})
    `;
  }
  const routine = await getRoutine();
  return NextResponse.json({ routine });
}
