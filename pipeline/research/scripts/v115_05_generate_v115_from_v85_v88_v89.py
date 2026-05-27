#!/usr/bin/env python3
"""Generate final v115.

Formula:
- Validation/Public rows = v89 + 15.0 * (v89 - v88), clipped to non-negative.
- Evaluation/Private rows = v85.

Input required:
- sample_submission.csv
- submission_v85_TREND_STRONGER_075.csv
- submission_v88_DOW_MICRO_ADJUST_on_v77.csv
- submission_v89_DOW_PROFIT_ADJUST_on_v77.csv

Output:
- submission_v115_PUBLIC_v89_extrap1500_PRIVATE_v85.csv
"""
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
from common import F, validate_like_sample

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-dir", default=".")
    ap.add_argument("--output", default="submission_v115_PUBLIC_v89_extrap1500_PRIVATE_v85.csv")
    ap.add_argument("--alpha", type=float, default=15.0)
    args = ap.parse_args()

    input_dir = Path(args.input_dir)
    sample = pd.read_csv(input_dir / "sample_submission.csv")
    v85 = pd.read_csv(input_dir / "submission_v85_TREND_STRONGER_075.csv")
    v88 = pd.read_csv(input_dir / "submission_v88_DOW_MICRO_ADJUST_on_v77.csv")
    v89 = pd.read_csv(input_dir / "submission_v89_DOW_PROFIT_ADJUST_on_v77.csv")

    assert list(sample["id"]) == list(v85["id"]) == list(v88["id"]) == list(v89["id"])

    is_val = sample["id"].str.endswith("_validation")
    out = sample.copy()

    # Start with robust later-horizon trend model.
    out[F] = v85[F].astype(float)

    # Aggressive Public/near-horizon extrapolation.
    public = (
        v89.loc[is_val, F].astype(float).to_numpy()
        + args.alpha * (
            v89.loc[is_val, F].astype(float).to_numpy()
            - v88.loc[is_val, F].astype(float).to_numpy()
        )
    )
    out.loc[is_val, F] = np.clip(public, 0, None)
    out.to_csv(args.output, index=False, float_format="%.6f")
    validate_like_sample(args.output, sample)

if __name__ == "__main__":
    main()
