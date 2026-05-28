import sys
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from config import INCOMING_DIR, SCAN_INTERVAL_MINUTES
from db.database import get_conn, init_db
from ingestion.pipeline import process_all_pending, process_file

scheduler = AsyncIOScheduler()


def _scan_job():
    results = process_all_pending()
    if results:
        print(f"[SCHEDULER] Processed {len(results)} file(s)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    INCOMING_DIR.mkdir(parents=True, exist_ok=True)

    scheduler.add_job(
        _scan_job,
        "interval",
        minutes=SCAN_INTERVAL_MINUTES,
        id="scan_incoming",
        replace_existing=True,
    )
    scheduler.start()
    print(f"[SCHEDULER] Started — scanning every {SCAN_INTERVAL_MINUTES} min")
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="AutoParts Ingestion API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.now().isoformat(timespec="seconds")}


@app.get("/status")
def status():
    conn = get_conn()
    try:
        last = conn.execute(
            "SELECT * FROM ingestion_log ORDER BY id DESC LIMIT 1"
        ).fetchone()
        total_records = conn.execute("SELECT COUNT(*) FROM sales").fetchone()[0]
        total_skus = conn.execute("SELECT COUNT(*) FROM sku_stats").fetchone()[0]
        pending_files = len(list(INCOMING_DIR.glob("*.csv")))

        next_run: Optional[str] = None
        job = scheduler.get_job("scan_incoming")
        if job and job.next_run_time:
            next_run = job.next_run_time.isoformat(timespec="seconds")

        return {
            "total_records": total_records,
            "total_skus": total_skus,
            "pending_files": pending_files,
            "next_scan": next_run,
            "last_ingestion": dict(last) if last else None,
        }
    finally:
        conn.close()


@app.get("/ingestion/history")
def ingestion_history(limit: int = 20):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM ingestion_log ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return {"history": [dict(r) for r in rows]}
    finally:
        conn.close()


@app.post("/ingestion/trigger")
def trigger_scan():
    results = process_all_pending()
    return {
        "triggered_at": datetime.now().isoformat(timespec="seconds"),
        "files_processed": len(results),
        "results": results,
    }


@app.post("/ingestion/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file CSV")

    dest = INCOMING_DIR / file.filename
    content = await file.read()
    dest.write_bytes(content)

    result = process_file(dest)
    return result


@app.get("/drift")
def detect_drift(window: int = 30, threshold: float = 30.0):
    """
    So sánh demand trung bình mỗi ngày của window ngày gần nhất
    vs window ngày trước đó. Trả về SKU có % thay đổi > threshold.
    """
    conn = get_conn()
    try:
        rows = conn.execute("""
            SELECT
                item_code,
                SUM(CASE WHEN sale_date >= date('now', ? || ' days') THEN quantity ELSE 0 END) AS recent,
                SUM(CASE WHEN sale_date <  date('now', ? || ' days')
                         AND sale_date >= date('now', ? || ' days') THEN quantity ELSE 0 END) AS older,
                COUNT(DISTINCT CASE WHEN sale_date >= date('now', ? || ' days') THEN sale_date END) AS recent_days,
                COUNT(DISTINCT CASE WHEN sale_date <  date('now', ? || ' days')
                                    AND sale_date >= date('now', ? || ' days') THEN sale_date END) AS older_days
            FROM sales
            GROUP BY item_code
            HAVING recent > 0 OR older > 0
        """, (
            f"-{window}", f"-{window}", f"-{window * 2}",
            f"-{window}", f"-{window}", f"-{window * 2}",
        )).fetchall()
    finally:
        conn.close()

    results = []
    for r in rows:
        recent_avg = r["recent"] / max(r["recent_days"], 1)
        older_avg  = r["older"]  / max(r["older_days"],  1)

        if older_avg == 0 and recent_avg == 0:
            continue

        if older_avg == 0:
            pct_change = 100.0
            direction  = "up"
        else:
            pct_change = ((recent_avg - older_avg) / older_avg) * 100
            direction  = "up" if pct_change > 0 else "down"

        abs_change = abs(pct_change)
        if abs_change < threshold:
            continue

        severity = "high" if abs_change >= 60 else "medium"
        results.append({
            "sku":         r["item_code"],
            "recent_avg":  round(recent_avg, 2),
            "older_avg":   round(older_avg, 2),
            "pct_change":  round(pct_change, 1),
            "direction":   direction,
            "severity":    severity,
        })

    results.sort(key=lambda x: abs(x["pct_change"]), reverse=True)
    return {
        "window_days": window,
        "threshold_pct": threshold,
        "detected_at": datetime.now().isoformat(timespec="seconds"),
        "drifting_skus": len(results),
        "items": results[:50],
    }
