import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS sales (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code   TEXT    NOT NULL,
    sale_date   TEXT    NOT NULL,
    quantity    REAL    NOT NULL DEFAULT 0,
    revenue     REAL    DEFAULT 0,
    source_file TEXT    NOT NULL,
    ingested_at TEXT    DEFAULT (datetime('now', 'localtime')),
    UNIQUE(item_code, sale_date, source_file)
);

CREATE TABLE IF NOT EXISTS ingestion_log (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    filename          TEXT NOT NULL,
    file_size         INTEGER DEFAULT 0,
    status            TEXT NOT NULL,
    records_total     INTEGER DEFAULT 0,
    records_inserted  INTEGER DEFAULT 0,
    records_duplicate INTEGER DEFAULT 0,
    records_invalid   INTEGER DEFAULT 0,
    error_message     TEXT,
    started_at        TEXT DEFAULT (datetime('now', 'localtime')),
    finished_at       TEXT
);

CREATE TABLE IF NOT EXISTS sku_stats (
    item_code      TEXT PRIMARY KEY,
    total_quantity REAL DEFAULT 0,
    total_revenue  REAL DEFAULT 0,
    sale_days      INTEGER DEFAULT 0,
    first_sale     TEXT,
    last_sale      TEXT,
    updated_at     TEXT DEFAULT (datetime('now', 'localtime'))
);
"""

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(SCHEMA)
    print(f"[DB] Initialized at {DB_PATH}")
