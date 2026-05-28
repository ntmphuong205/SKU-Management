from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

INCOMING_DIR  = DATA_DIR / "incoming"
PROCESSED_DIR = DATA_DIR / "processed"
FAILED_DIR    = DATA_DIR / "failed"
DB_PATH       = DATA_DIR / "autoparts.db"

SCAN_INTERVAL_MINUTES = 5
API_PORT = 8000
