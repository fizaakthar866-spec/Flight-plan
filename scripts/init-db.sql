CREATE TABLE IF NOT EXISTS routine_items (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS days (
  date TEXT PRIMARY KEY,
  intention TEXT,
  morning_photo_url TEXT,
  discipline_status TEXT,
  phone_answer TEXT,
  special_note TEXT,
  bad_note TEXT,
  score INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS completions (
  date TEXT NOT NULL,
  item_id INT NOT NULL REFERENCES routine_items(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (date, item_id)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  ts TIMESTAMPTZ DEFAULT now(),
  text TEXT NOT NULL
);

INSERT INTO routine_items (label, start_time, end_time, sort_order)
VALUES
  ('Wake up', '06:00', '06:15', 1),
  ('Physical training', '06:15', '07:00', 2),
  ('Ground school', '09:00', '15:40', 3),
  ('Chair flying / review', '16:00', '17:00', 4),
  ('Wind down', '21:00', '22:00', 5)
ON CONFLICT DO NOTHING;
