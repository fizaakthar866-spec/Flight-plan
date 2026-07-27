import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getFirstAndLastPhoto } from "@/lib/db";

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const { rows: allDays } = await sql`SELECT * FROM days ORDER BY date DESC`;

  let streak = 0;
  const byDate = new Map(allDays.map((d: any) => [d.date, d]));
  let cursor = new Date();
  if (!byDate.get(toDateStr(cursor))?.score) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const ds = toDateStr(cursor);
    const row: any = byDate.get(ds);
    if (row && row.score !== null && row.score !== undefined) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  const last30 = allDays.slice(0, 30).filter((d: any) => d.score !== null && d.score !== undefined);
  const avg30 =
    last30.length > 0
      ? Math.round(last30.reduce((s: number, d: any) => s + d.score, 0) / last30.length)
      : 0;

  let disciplineStreak = 0;
  let dCursor = new Date();
  while (true) {
    const ds = toDateStr(dCursor);
    const row: any = byDate.get(ds);
    if (row && row.discipline_status === "on_track") {
      disciplineStreak++;
      dCursor.setDate(dCursor.getDate() - 1);
    } else if (row && row.discipline_status) {
      break;
    } else if (!row) {
      break;
    } else {
      break;
    }
  }

  const { rows: groundItem } = await sql`SELECT id FROM routine_items WHERE label ILIKE '%ground%' LIMIT 1`;
  let groundConsistency = 0;
  if (groundItem[0]) {
    const { rows: completedRows } = await sql`
      SELECT COUNT(*)::int AS cnt FROM completions
      WHERE item_id = ${groundItem[0].id} AND completed = true
      AND date > ${toDateStr(new Date(Date.now() - 30 * 86400000))}
    `;
    groundConsistency = Math.min(100, Math.round(((completedRows[0].cnt as number) / 30) * 100));
  }

  const totalDays = allDays.length;
  const { first, last } = await getFirstAndLastPhoto();

  return NextResponse.json({
    streak,
    avg30,
    disciplineStreak,
    groundConsistency,
    totalDays,
    firstPhoto: first,
    lastPhoto: last,
  });
         }
