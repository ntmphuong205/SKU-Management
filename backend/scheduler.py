"""Entry point: python scheduler.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import uvicorn
from db.database import init_db
from config import API_PORT

if __name__ == "__main__":
    init_db()
    uvicorn.run("api.main:app", host="0.0.0.0", port=API_PORT, reload=False)
