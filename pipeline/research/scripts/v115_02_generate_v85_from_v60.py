#!/usr/bin/env python3
"""Generate v85: stronger recent-momentum trend model.

Input required:
- train.csv
- sample_submission.csv
- v60_PUBLIC_v51_PRIVATE_v6_support_mask_015.csv

Output:
- submission_v85_TREND_STRONGER_075.csv
"""
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
from common import load_train_sample, prepare_features, submission_to_mat56, mat56_to_submission, validate_like_sample

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-dir", default=".")
    ap.add_argument("--output", default="submission_v85_TREND_STRONGER_075.csv")
    args = ap.parse_args()

    input_dir = Path(args.input_dir)
    train, sample = load_train_sample(input_dir)
    feat = prepare_features(train, sample)
    base60 = pd.read_csv(input_dir / "v60_PUBLIC_v51_PRIVATE_v6_support_mask_015.csv")

    items = feat["items"]
    m60 = submission_to_mat56(base60, sample, items)

    active = (feat["sd180"] >= 3) & (feat["days_since"] <= 60)
    declining = (feat["days_since"] > 60) & (feat["trend"] < 0.8) & (feat["sum180"] > 0)

    scale = np.ones(len(items), dtype=np.float32)
    scale[active] = np.clip(1 + 0.075 * (feat["trend"][active] - 1), 0.92, 1.16)
    scale[declining] = 0.950

    mat56_to_submission(m60 * scale[:, None], sample, items, args.output)
    validate_like_sample(args.output, sample)

if __name__ == "__main__":
    main()
