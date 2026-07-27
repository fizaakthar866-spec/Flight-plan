import { sql } from "@vercel/postgres";

export type RoutineItem = {
  id: number;
  label: string;
  start_time: string;
  end_time: string | null;
  sort_order: number;
};

export type DayRow = {
  date: string;
  intention: string | null;
  morning_photo_url: string | null;
  discipline_status: string | null;
  phone_answer: string | null;
  special_note: string | null;
  bad_note: string | null;
  score: number | null;
};

export async function getRoutine(): Promise<RoutineItem[]> {
  const { rows } = await sql`SELECT * FROM routine_items ORDER BY sort_order ASC`;
  return rows as RoutineItem[];
}

export async function getDay(date: string): Promise<DayRow | null> {
  const { rows } = await sql`SELECT * FROM days WHERE date = ${date}`;
  return (rows[0] as DayRow) ?? null;
}

export async function upsertDay(date: string, fields: Partial<DayRow>) {
  const existing = await getDay(date);
  const merged = { ...existing, ...fields, date };
  await sql`
    INSERT INTO days (date, intention, morning_photo_url, discipline_status, phone_answer, special_note, bad_note, score)
    VALUES (${date}, ${merged.intention ?? null}, ${merged.morning_photo_url ?? null}, ${merged.discipline_status ?? null}, ${merged.phone_answer ?? null}, ${merged.special_note ?? null}, ${merged.bad_note ?? null}, ${merged.score ?? null})
    ON CONFLICT (date) DO UPDATE SET
      intention = EXCLUDED.intention,
      morning_photo_url = EXCLUDED.morning_photo_url,
      discipline_status = EXCLUDED.discipline_status,
      phone_answer = EXCLUDED.phone_answer,
      special_note = EXCLUDED.special_note,
      bad_note = EXCLUDED.bad_note,
      score = EXCLUDED.score
  `;
}

export async function getCompletions(date: string): Promise<Record<number, boolean>> {
  const { rows } = await sql`SELECT item_id, completed FROM completions WHERE date = ${date}`;
  const map: Record<number, boolean> = {};
  for (const r of rows as any[]) map[r.item_id] = r.completed;
  return map;
}

export async function setCompletion(date: string, itemId: number, completed: boolean) {
  await sql`
    INSERT INTO completions (date, item_id, completed)
    VALUES (${date}, ${itemId}, ${completed})
    ON CONFLICT (date, item_id) DO UPDATE SET completed = EXCLUDED.completed
  `;
}

export async function getJournal(date: string) {
  const { rows } = await sql`SELECT * FROM journal_entries WHERE date = ${date} ORDER BY ts ASC`;
  return rows;
}

export async function addJournalEntry(date: string, text: string) {
  await sql`INSERT INTO journal_entries (date, text) VALUES (${date}, ${text})`;
}

export async function getRecentDays(limit: number): Promise<DayRow[]> {
  const { rows } = await sql`SELECT * FROM days ORDER BY date DESC LIMIT ${limit}`;
  return rows as DayRow[];
}

export async function getFirstAndLastPhoto() {
  const first = await sql`SELECT date, morning_photo_url FROM days WHERE morning_photo_url IS NOT NULL ORDER BY date ASC LIMIT 1`;
  const last = await sql`SELECT date, morning_photo_url FROM days WHERE morning_photo_url IS NOT NULL ORDER BY date DESC LIMIT 1`;
  return { first: first.rows[0] ?? null, last: last.rows[0] ?? null };
}
