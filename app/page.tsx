"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RoutineItem = { id: number; label: string; start_time: string; end_time: string | null; sort_order: number };
type DayRow = {
  date: string;
  intention: string | null;
  morning_photo_url: string | null;
  discipline_status: string | null;
  phone_answer: string | null;
  special_note: string | null;
  bad_note: string | null;
  score: number | null;
};

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
 export default function Page() {
  const date = todayStr();
  const [routine, setRoutine] = useState<RoutineItem[]>([]);
  const [day, setDay] = useState<DayRow | null>(null);
  const [completions, setCompletions] = useState<Record<number, boolean>>({});
  const [journal, setJournal] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const [intention, setIntention] = useState("");
  const [noteText, setNoteText] = useState("");
  const [specialNote, setSpecialNote] = useState("");
  const [badNote, setBadNote] = useState("");
  const [showEditRoutine, setShowEditRoutine] = useState(false);
  const [routineDraft, setRoutineDraft] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [phoneAnswer, setPhoneAnswer] = useState<"yes" | "no" | null>(null);
  const [showReport, setShowReport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAll() {
    const [dayRes, statsRes] = await Promise.all([
      fetch(`/api/day?date=${date}`).then((r) => r.json()),
      fetch(`/api/stats`).then((r) => r.json()),
    ]);
    setDay(dayRes.day);
    setRoutine(dayRes.routine);
    setCompletions(dayRes.completions);
    setJournal(dayRes.journal);
    setStats(statsRes);
    setSpecialNote(dayRes.day?.special_note ?? "");
    setBadNote(dayRes.day?.bad_note ?? "");
  }

  useEffect(() => {
    loadAll();
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const now = nowMinutes();
  const current = useMemo(() => {
    const sorted = [...routine].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    let currentItem: RoutineItem | null = null;
    let nextItem: RoutineItem | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const start = timeToMinutes(sorted[i].start_time);
      const end = sorted[i].end_time ? timeToMinutes(sorted[i].end_time!) : (sorted[i + 1] ? timeToMinutes(sorted[i + 1].start_time) : 24 * 60);
      if (now >= start && now < end) {
        currentItem = sorted[i];
        nextItem = sorted[i + 1] ?? null;
        break;
      }
      if (now < start) {
        nextItem = sorted[i];
        break;
      }
    }
    return { currentItem, nextItem };
  }, [routine, now, tick]);

  function minutesUntil(t: string) {
    const diff = timeToMinutes(t) - now;
    const d = diff < 0 ? diff + 24 * 60 : diff;
    const h = Math.floor(d / 60);
    const m = d % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  async function checkIn() {
    await fetch("/api/day", { method: "POST", body: JSON.stringify({ date, intention }) });
    loadAll();
  }

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, 900, 0.7);
    const form = new FormData();
    form.append("file", compressed, "photo.jpg");
    form.append("date", date);
    await fetch("/api/photo", { method: "POST", body: form });
    loadAll();
  }

  async function setDiscipline(status: "on_track" | "slipped") {
    await fetch("/api/day", { method: "POST", body: JSON.stringify({ date, discipline_status: status }) });
    loadAll();
  }

  async function toggleItem(itemId: number) {
    const completed = !completions[itemId];
    setCompletions((c) => ({ ...c, [itemId]: completed }));
    await fetch("/api/day/complete", { method: "POST", body: JSON.stringify({ date, itemId, completed }) });
  }

  async function addJournal() {
    if (!noteText.trim()) return;
    await fetch("/api/day/journal", { method: "POST", body: JSON.stringify({ date, text: noteText }) });
    setNoteText("");
    loadAll();
  }

  async function saveSpecialBad() {
    await fetch("/api/day", { method: "POST", body: JSON.stringify({ date, special_note: specialNote, bad_note: badNote }) });
  }

  async function saveRoutine() {
    const items = routineDraft
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?\s+(.+)$/);
        if (!m) return null;
        return { start_time: m[1], end_time: m[2] ?? null, label: m[3] };
      })
      .filter(Boolean);
    const res = await fetch("/api/routine", { method: "POST", body: JSON.stringify({ items }) });
    const data = await res.json();
    setRoutine(data.routine);
    setShowEditRoutine(false);
  }

  function openEditRoutine() {
    const draft = routine
      .map((r) => `${r.start_time}${r.end_time ? "-" + r.end_time : ""} ${r.label}`)
      .join("\n");
    setRoutineDraft(draft);
    setShowEditRoutine(true);
  }

  const completedCount = routine.filter((r) => completions[r.id]).length;
  const completionPct = routine.length ? Math.round((completedCount / routine.length) * 100) : 0;

  async function submitNightReview() {
    const disciplineScore = day?.discipline_status === "on_track" ? 100 : 0;
    const phoneScore = phoneAnswer === "yes" ? 100 : 0;
    const score = Math.round(completionPct * 0.6 + disciplineScore * 0.2 + phoneScore * 0.2);
    await fetch("/api/day", {
      method: "POST",
      body: JSON.stringify({ date, phone_answer: phoneAnswer, score, special_note: specialNote, bad_note: badNote }),
    });
    setShowReview(false);
    loadAll();
    }
   return (
    <main className="min-h-screen pb-16 px-4 pt-6 max-w-md mx-auto">
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={onPhotoSelected} />

      <header className="mb-4">
        <div className="text-xs text-white/40">{new Date().toLocaleString([], { weekday: "long", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
        <h1 className="text-xl font-semibold">Flight Plan — CPL Prep</h1>
      </header>

      {/* NOW CARD */}
      <section className="card p-5 mb-4">
        <div className="text-xs uppercase tracking-wide text-accent mb-1">Right now</div>
        <div className="text-2xl font-bold">
          {current.currentItem ? current.currentItem.label : "Free time"}
        </div>
        {current.currentItem && (
          <div className="text-white/50 text-sm mt-1">
            {current.currentItem.start_time}{current.currentItem.end_time ? `–${current.currentItem.end_time}` : ""}
          </div>
        )}
        {current.nextItem && (
          <div className="mt-3 text-sm text-white/60">
            Next: <span className="text-white">{current.nextItem.label}</span> in {minutesUntil(current.nextItem.start_time)}
          </div>
        )}
      </section>

      {/* MORNING CHECK-IN */}
      <section className="card p-5 mb-4">
        <div className="font-semibold mb-2">Morning Check-In</div>
        <input
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          placeholder="One-line intention for today (optional)"
          className="w-full bg-black/30 rounded-lg px-3 py-2 text-sm mb-3 outline-none"
        />
        <div className="flex gap-2">
          <button onClick={checkIn} className="flex-1 bg-accent text-black font-semibold rounded-lg py-2.5">
            {day?.intention ? "Checked in ✓" : "Check in"}
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="px-4 rounded-lg bg-white/10">
            📷
          </button>
        </div>
        {day?.morning_photo_url && (
          <img src={day.morning_photo_url} alt="Today" className="mt-3 rounded-lg w-full max-h-48 object-cover" />
        )}
      </section>

      {/* DISCIPLINE CHECK */}
      <section className="card p-5 mb-4">
        <div className="font-semibold mb-3">Discipline Check</div>
        <div className="flex gap-2">
          <button
            onClick={() => setDiscipline("on_track")}
            className={`flex-1 rounded-lg py-2.5 font-semibold ${day?.discipline_status === "on_track" ? "bg-green-500 text-black" : "bg-white/10"}`}
          >
            On track
          </button>
          <button
            onClick={() => setDiscipline("slipped")}
            className={`flex-1 rounded-lg py-2.5 font-semibold ${day?.discipline_status === "slipped" ? "bg-red-500 text-black" : "bg-white/10"}`}
          >
            Slipped
          </button>
        </div>
      </section>

      {/* TODAY'S ROUTE */}
      <section className="card p-5 mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="font-semibold">Today's Route</div>
          <button onClick={openEditRoutine} className="text-xs text-accent">Edit routine</button>
        </div>
        <div className="space-y-2">
          {routine.map((item) => (
            <label key={item.id} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2.5">
              <input type="checkbox" checked={!!completions[item.id]} onChange={() => toggleItem(item.id)} className="w-5 h-5 accent-[#3ba7ff]" />
              <div className="flex-1">
                <div className={completions[item.id] ? "line-through text-white/40" : ""}>{item.label}</div>
                <div className="text-xs text-white/40">{item.start_time}{item.end_time ? `–${item.end_time}` : ""}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* JOURNAL */}
      <section className="card p-5 mb-4">
        <div className="font-semibold mb-3">Journal</div>
        <div className="flex gap-2 mb-3">
          <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Quick note..." className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-sm outline-none" />
          <button onClick={addJournal} className="px-4 rounded-lg bg-white/10">Add</button>
        </div>
        <div className="space-y-1 mb-4 max-h-32 overflow-y-auto">
          {journal.map((j: any) => (
            <div key={j.id} className="text-xs text-white/60">
              <span className="text-white/30">{new Date(j.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> — {j.text}
            </div>
          ))}
        </div>
        <textarea value={specialNote} onChange={(e) => setSpecialNote(e.target.value)} onBlur={saveSpecialBad} placeholder="Something special that happened" className="w-full bg-black/30 rounded-lg px-3 py-2 text-sm mb-2 outline-none" rows={2} />
        <textarea value={badNote} onChange={(e) => setBadNote(e.target.value)} onBlur={saveSpecialBad} placeholder="One thing that went badly" className="w-full bg-black/30 rounded-lg px-3 py-2 text-sm outline-none" rows={2} />
      </section>

      {/* NIGHT REVIEW */}
      <section className="card p-5 mb-4">
        <div className="font-semibold mb-3">Night Review</div>
        {day?.score !== null && day?.score !== undefined ? (
          <div className="text-3xl font-bold text-accent">{day.score}%</div>
        ) : (
          <button onClick={() => setShowReview(true)} className="w-full bg-accent text-black font-semibold rounded-lg py-2.5">
            Start night review
          </button>
        )}
      </section>

      <button onClick={() => setShowReport(true)} className="w-full card py-3 mb-6 text-sm text-white/70">
        View / print today's report
      </button>

      {/* STREAK + STATS */}
      {stats && (
      {stats && (
        <>
          <section className="grid grid-cols-2 gap-3 mb-4">
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-accent">{stats.streak}</div>
              <div className="text-xs text-white/50 mt-1">Day streak</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-accent">{stats.avg30}%</div>
              <div className="text-xs text-white/50 mt-1">30-day avg</div>
            </div>
          </section>

          <section className="card p-5 mb-4 space-y-4">
            <ProgressBar label="Ground school consistency" pct={stats.groundConsistency} />
            <ProgressBar label="Discipline streak" pct={Math.min(100, stats.disciplineStreak * 10)} sub={`${stats.disciplineStreak} days`} />
            <ProgressBar label="Total days on routine" pct={Math.min(100, stats.totalDays)} sub={`${stats.totalDays} days`} />
          </section>

          {stats.firstPhoto && stats.lastPhoto && (
            <section className="card p-5 mb-4">
              <div className="font-semibold mb-3">Then vs Now</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <img src={stats.firstPhoto.morning_photo_url} className="rounded-lg w-full aspect-square object-cover" />
                  <div className="text-xs text-white/40 mt-1 text-center">{stats.firstPhoto.date}</div>
                </div>
                <div>
                  <img src={stats.lastPhoto.morning_photo_url} className="rounded-lg w-full aspect-square object-cover" />
                  <div className="text-xs text-white/40 mt-1 text-center">{stats.lastPhoto.date}</div>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* EDIT ROUTINE MODAL */}
      {showEditRoutine && (
        <Modal onClose={() => setShowEditRoutine(false)} title="Edit routine">
          <p className="text-xs text-white/50 mb-2">One line per item: `HH:MM-HH:MM Label` (end time optional)</p>
          <textarea value={routineDraft} onChange={(e) => setRoutineDraft(e.target.value)} rows={10} className="w-full bg-black/30 rounded-lg px-3 py-2 text-sm outline-none font-mono" />
          <button onClick={saveRoutine} className="w-full bg-accent text-black font-semibold rounded-lg py-2.5 mt-3">Save</button>
        </Modal>
      )}

      {/* NIGHT REVIEW MODAL */}
      {showReview && (
        <Modal onClose={() => setShowReview(false)} title="Night review">
          <div className="mb-4">
            <div className="text-sm text-white/60 mb-1">Route completed today</div>
            <div className="text-2xl font-bold">{completedCount}/{routine.length} ({completionPct}%)</div>
          </div>
          <div className="mb-4">
            <div className="text-sm text-white/60 mb-2">Did you stay off your phone during work blocks?</div>
            <div className="flex gap-2">
              <button onClick={() => setPhoneAnswer("yes")} className={`flex-1 rounded-lg py-2 ${phoneAnswer === "yes" ? "bg-green-500 text-black" : "bg-white/10"}`}>Yes</button>
              <button onClick={() => setPhoneAnswer("no")} className={`flex-1 rounded-lg py-2 ${phoneAnswer === "no" ? "bg-red-500 text-black" : "bg-white/10"}`}>No</button>
            </div>
          </div>
          <button disabled={!phoneAnswer} onClick={submitNightReview} className="w-full bg-accent text-black font-semibold rounded-lg py-2.5 disabled:opacity-40">
            Submit
          </button>
        </Modal>
      )}

      {/* REPORT MODAL */}
      {showReport && (
        <Modal onClose={() => setShowReport(false)} title="Today's report">
          <div id="report" className="space-y-3 text-sm">
            <div className="text-white/50">{date}</div>
            {day?.morning_photo_url && <img src={day.morning_photo_url} className="rounded-lg w-full max-h-48 object-cover" />}
            <div><span className="text-white/50">Intention:</span> {day?.intention || "—"}</div>
            <div><span className="text-white/50">Discipline:</span> {day?.discipline_status || "—"}</div>
            <div><span className="text-white/50">Route:</span> {completedCount}/{routine.length} completed</div>
            <div><span className="text-white/50">Score:</span> {day?.score ?? "—"}%</div>
            <div><span className="text-white/50">Special:</span> {specialNote || "—"}</div>
            <div><span className="text-white/50">Went badly:</span> {badNote || "—"}</div>
            <div>
              <span className="text-white/50">Journal:</span>
              <ul className="mt-1 space-y-1">
                {journal.map((j: any) => (
                  <li key={j.id} className="text-white/70">• {j.text}</li>
                ))}
              </ul>
            </div>
          </div>
          <button onClick={() => window.print()} className="w-full bg-accent text-black font-semibold rounded-lg py-2.5 mt-4">Save as PDF</button>
        </Modal>
      )}
    </main>
  );
}

function ProgressBar({ label, pct, sub }: { label: string; pct: number; sub?: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-white/70">{label}</span>
        <span className="text-white/50">{sub ?? `${pct}%`}</span>
      </div>
      <div className="h-2 bg-black/30 rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="text-white/50">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function compressImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("compress failed"))), "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
          }
