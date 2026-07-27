import { NextRequest, NextResponse } from "next/server";
import { addJournalEntry } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { date, text } = await req.json();
  if (!date || !text) return NextResponse.json({ error: "date and text required" }, { status: 400 });
  await addJournalEntry(date, text);
  return NextResponse.json({ ok: true });
}
