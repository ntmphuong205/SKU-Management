import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
import sys

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import INCOMING_DIR, PROCESSED_DIR, FAILED_DIR
from db.database import get_conn
from ingestion.validator import validate


def process_file(file_path: Path) -> dict:
    """Xử lý 1 file CSV. Trả về báo cáo ingestion."""
    started_at = datetime.now().isoformat(timespec='seconds')
    filename   = file_path.name
    file_size  = file_path.stat().st_size

    print(f"[INGEST] Đang xử lý: {filename} ({file_size:,} bytes)")

    # Đọc file
    try:
        df_raw = pd.read_csv(file_path, encoding='utf-8-sig')
    except Exception as e:
        return _fail(file_path, filename, file_size, started_at, f"Không đọc được file: {e}")

    # Validate
    df, report = validate(df_raw)
    if not report['valid']:
        error_msg = "; ".join(report['errors'])
        return _fail(file_path, filename, file_size, started_at, error_msg, len(df_raw))

    # Ghi vào DB
    inserted = duplicate = invalid = 0
    conn = get_conn()
    try:
        for _, row in df.iterrows():
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO sales
                       (item_code, sale_date, quantity, revenue, source_file)
                       VALUES (?, ?, ?, ?, ?)""",
                    (str(row['item_code']), row['sale_date'],
                     float(row['quantity']), float(row['revenue']), filename),
                )
                inserted += conn.execute("SELECT changes()").fetchone()[0]
                duplicate += 1 - conn.execute("SELECT changes()").fetchone()[0]
            except Exception:
                invalid += 1

        # Recalculate duplicate count correctly
        duplicate = len(df) - inserted - invalid

        conn.commit()
        _update_sku_stats(conn, df)
        conn.commit()
    finally:
        conn.close()

    status = 'success' if invalid == 0 else 'partial'
    _write_log(filename, file_size, status, len(df_raw), inserted, duplicate, invalid, None, started_at)

    # Di chuyển file đã xử lý
    ts   = datetime.now().strftime('%Y%m%d_%H%M%S')
    dest = PROCESSED_DIR / f"{ts}_{filename}"
    shutil.move(str(file_path), str(dest))

    result = {
        'filename': filename,
        'status': status,
        'records_total': len(df_raw),
        'records_inserted': inserted,
        'records_duplicate': duplicate,
        'records_invalid': invalid,
        'warnings': report.get('warnings', []),
        'stats': report.get('stats', {}),
    }
    print(f"[INGEST] ✓ {filename}: inserted={inserted} dup={duplicate} invalid={invalid}")
    return result


def process_all_pending() -> list[dict]:
    """Quét thư mục incoming/ và xử lý tất cả file CSV."""
    files = sorted(INCOMING_DIR.glob("*.csv"))
    if not files:
        return []
    print(f"[INGEST] Tìm thấy {len(files)} file(s)")
    return [process_file(f) for f in files]


# ── Helpers ────────────────────────────────────────────────────────────────

def _update_sku_stats(conn: sqlite3.Connection, df: pd.DataFrame):
    """Cập nhật bảng sku_stats cho các SKU bị ảnh hưởng."""
    skus = df['item_code'].unique().tolist()
    placeholders = ','.join('?' * len(skus))
    rows = conn.execute(f"""
        SELECT item_code,
               SUM(quantity)          AS total_qty,
               SUM(revenue)           AS total_rev,
               COUNT(DISTINCT sale_date) AS sale_days,
               MIN(sale_date)         AS first_sale,
               MAX(sale_date)         AS last_sale
        FROM sales WHERE item_code IN ({placeholders})
        GROUP BY item_code
    """, skus).fetchall()

    for r in rows:
        conn.execute("""
            INSERT INTO sku_stats
              (item_code, total_quantity, total_revenue, sale_days, first_sale, last_sale, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
            ON CONFLICT(item_code) DO UPDATE SET
              total_quantity = excluded.total_quantity,
              total_revenue  = excluded.total_revenue,
              sale_days      = excluded.sale_days,
              first_sale     = excluded.first_sale,
              last_sale      = excluded.last_sale,
              updated_at     = excluded.updated_at
        """, (r['item_code'], r['total_qty'], r['total_rev'],
              r['sale_days'], r['first_sale'], r['last_sale']))


def _fail(file_path, filename, file_size, started_at, error_msg, total=0) -> dict:
    _write_log(filename, file_size, 'failed', total, 0, 0, 0, error_msg, started_at)
    ts   = datetime.now().strftime('%Y%m%d_%H%M%S')
    dest = FAILED_DIR / f"{ts}_{filename}"
    shutil.move(str(file_path), str(dest))
    print(f"[INGEST] ✗ FAILED {filename}: {error_msg}")
    return {'filename': filename, 'status': 'failed', 'error': error_msg}


def _write_log(filename, file_size, status, total, inserted, duplicate, invalid, error, started_at):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO ingestion_log
              (filename, file_size, status, records_total, records_inserted,
               records_duplicate, records_invalid, error_message, started_at, finished_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
        """, (filename, file_size, status, total, inserted, duplicate, invalid, error, started_at))
