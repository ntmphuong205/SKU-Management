"""Generate sample CSV files for testing the ingestion pipeline."""
import random
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import INCOMING_DIR

INCOMING_DIR.mkdir(parents=True, exist_ok=True)

SKUS = [
    "AP-1001", "AP-1002", "AP-1003", "AP-2001", "AP-2002",
    "AP-3001", "AP-3002", "AP-3003", "AP-4001", "AP-4002",
    "BP-0011", "BP-0012", "BP-0021", "BP-0022", "BP-0031",
    "FP-5501", "FP-5502", "FP-5503", "FP-5504", "FP-5505",
]

UNIT_PRICES = {sku: random.uniform(50_000, 2_000_000) for sku in SKUS}


def random_date(start: date, end: date) -> date:
    return start + timedelta(days=random.randint(0, (end - start).days))


def generate_file(filename: str, n_rows: int = 200, n_skus: int = 10):
    skus = random.sample(SKUS, min(n_skus, len(SKUS)))
    today = date.today()
    start = today - timedelta(days=90)

    rows = ["ItemCode,Date,Quantity,Revenue"]
    for _ in range(n_rows):
        sku = random.choice(skus)
        d   = random_date(start, today)
        qty = random.randint(1, 50)
        rev = round(qty * UNIT_PRICES[sku] * random.uniform(0.9, 1.1), 2)
        rows.append(f"{sku},{d.strftime('%Y-%m-%d')},{qty},{rev}")

    path = INCOMING_DIR / filename
    path.write_text("\n".join(rows), encoding="utf-8")
    print(f"[SAMPLE] Created {path} ({n_rows} rows, {len(skus)} SKUs)")
    return path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--files", type=int, default=3, help="Number of files to generate")
    parser.add_argument("--rows",  type=int, default=200, help="Rows per file")
    args = parser.parse_args()

    from datetime import datetime
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    for i in range(args.files):
        generate_file(f"sales_sample_{ts}_{i+1}.csv", n_rows=args.rows)

    print(f"\nDone. Drop files into {INCOMING_DIR} or POST to /ingestion/upload")
