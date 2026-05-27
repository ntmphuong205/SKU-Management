#!/usr/bin/env python3
"""Generate v89: profit-aware day-of-week adjustment on v77.

Input required:
- train.csv
- sample_submission.csv
- submission_v77_TREND_STRONG_from_v60.csv

Output:
- submission_v89_DOW_PROFIT_ADJUST_on_v77.csv
"""
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
from common import load_train_sample, prepare_features, submission_to_mat56, mat56_to_submission, validate_like_sample

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-dir", default=".")
    ap.add_argument("--output", default="submission_v89_DOW_PROFIT_ADJUST_on_v77.csv")
    args = ap.parse_args()

    input_dir = Path(args.input_dir)
    train, sample = load_train_sample(input_dir)
    feat = prepare_features(train, sample)
    base77 = pd.read_csv(input_dir / "submission_v77_TREND_STRONG_from_v60.csv")

    items = feat["items"]
    m77 = submission_to_mat56(base77, sample, items)

    # Near-term/Public signal: DOW adjustment only for recently active, high-profit SKUs.
    active = (feat["sd84"] >= 3) & (feat["days_since"] <= 45) & (feat["profit_pct"] >= 0.70)
    factors = feat["dow_factor"][:, feat["fut_dows"]]
    adj = np.ones_like(m77, dtype=np.float32)
    adj[active] = np.clip(1 + 0.18 * (factors[active] - 1), 0.95, 1.05)

    mat56_to_submission(m77 * adj, sample, items, args.output)
    validate_like_sample(args.output, sample)

if __name__ == "__main__":
    main()
