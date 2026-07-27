import { NextRequest, NextResponse } from "next/server";
import { getDay, upsertDay, getRoutine, getCompletions, getJournal } from "@/lib/db";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const [day, routine, completions, journal] = await Promise.all([
    getDay(date),
    getRoutine(),
    getCompletions(date),
    getJournal(date),
  ]);

  return NextResponse.json({ day, routine, completions, journal });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, ...fields } = body;
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
  await upsertDay(date, fields);
  return NextResponse.json({ ok: true });
}
