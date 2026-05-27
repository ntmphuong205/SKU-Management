#!/usr/bin/env python3
import os
from pathlib import Path
import numpy as np
import pandas as pd

F = [f"F{i}" for i in range(1, 29)]

def parse_num_series(s):
    """Parse Vietnamese decimal comma numeric series."""
    return pd.to_numeric(pd.Series(s).astype(str).str.replace(",", ".", regex=False), errors="coerce")

def load_train_sample(input_dir):
    input_dir = Path(input_dir)
    train = pd.read_csv(input_dir / "train.csv", low_memory=False)
    sample = pd.read_csv(input_dir / "sample_submission.csv")
    return train, sample

def prepare_features(train, sample):
    """
    Build SKU-level behavior features used by v77/v85/v88/v89.
    Target is daily net quantity clipped to non-negative.
    """
    items = sample["id"].str.replace(r"_(validation|evaluation)$", "", regex=True).unique()
    item_to_idx = {it: i for i, it in enumerate(items)}

    train = train.copy()
    train["Date"] = pd.to_datetime(train["Date"])
    daily = train.groupby(["ItemCode", "Date"], as_index=False).agg(qty=("Quantity", "sum"))
    daily["target"] = daily["qty"].clip(lower=0)

    end_date = pd.Timestamp("2025-09-05")
    dates = pd.date_range(daily["Date"].min(), end_date, freq="D")
    date_to_idx = {d: i for i, d in enumerate(dates)}

    mat = np.zeros((len(items), len(dates)), dtype=np.float32)
    d = daily[daily["ItemCode"].isin(item_to_idx)].copy()
    rows = d["ItemCode"].map(item_to_idx).to_numpy()
    cols = d["Date"].map(date_to_idx).to_numpy()
    mat[rows, cols] = d["target"].to_numpy(np.float32)

    has = mat > 0
    rev = np.flip(has, axis=1)
    last_sale_pos = np.argmax(rev, axis=1)
    has_any = has.any(axis=1)
    days_since = np.where(has_any, last_sale_pos, 9999).astype(np.float32)

    def window_sum(days):
        return mat[:, max(0, mat.shape[1] - days):].sum(axis=1)

    def window_mean(days):
        return mat[:, max(0, mat.shape[1] - days):].mean(axis=1)

    def sale_days(days):
        return (mat[:, max(0, mat.shape[1] - days):] > 0).sum(axis=1).astype(np.float32)

    sum28, sum84, sum180 = window_sum(28), window_sum(84), window_sum(180)
    mean28, mean84 = window_mean(28), window_mean(84)
    sd28, sd56, sd84, sd180 = sale_days(28), sale_days(56), sale_days(84), sale_days(180)

    # Recent momentum signal: >1 means latest 28d demand stronger than latest 84d baseline.
    trend = np.clip((mean28 + 0.01) / (mean84 + 0.01), 0.2, 4.0).astype(np.float32)

    # Profit percentile is used by v89. Cost Amount can contain decimal comma.
    train["CostAmount_num"] = parse_num_series(train["Cost Amount"]).fillna(0).values
    train["profit_line"] = train["SalesAmount"].astype(float) - train["CostAmount_num"].astype(float)
    profit = train.groupby("ItemCode")["profit_line"].sum().reindex(items).fillna(0).clip(lower=0)
    profit_pct = profit.rank(pct=True).fillna(0).to_numpy(np.float32)

    # Day-of-week factor from last 84 calendar days.
    last84_mat = mat[:, -84:]
    last84_dates = dates[-84:]
    overall84 = last84_mat.mean(axis=1).astype(np.float32) + 0.01
    dow_means = np.zeros((len(items), 7), dtype=np.float32)
    for dow in range(7):
        mask = np.array([d.dayofweek == dow for d in last84_dates])
        dow_means[:, dow] = last84_mat[:, mask].mean(axis=1)
    dow_factor = np.clip((dow_means + 0.01) / overall84[:, None], 0.70, 1.30).astype(np.float32)

    fut_dates = pd.date_range(pd.Timestamp("2025-09-06"), periods=56, freq="D")
    fut_dows = np.array([d.dayofweek for d in fut_dates])

    return {
        "items": items,
        "days_since": days_since,
        "sd28": sd28,
        "sd56": sd56,
        "sd84": sd84,
        "sd180": sd180,
        "sum28": sum28,
        "sum84": sum84,
        "sum180": sum180,
        "trend": trend,
        "profit_pct": profit_pct,
        "dow_factor": dow_factor,
        "fut_dows": fut_dows,
    }

def submission_to_mat56(df, sample, items):
    idx = {it: i for i, it in enumerate(items)}
    df = df.set_index("id")
    out = np.zeros((len(items), 56), dtype=np.float32)
    for it, i in idx.items():
        out[i, :28] = df.loc[f"{it}_validation", F].astype(float).to_numpy()
        out[i, 28:] = df.loc[f"{it}_evaluation", F].astype(float).to_numpy()
    return out

def mat56_to_submission(mat56, sample, items, output):
    item_to_idx = {it: i for i, it in enumerate(items)}
    out = sample.copy()
    vals = np.zeros((len(out), 28), dtype=np.float32)
    for r, idv in enumerate(out["id"].values):
        it = idv.rsplit("_", 1)[0]
        i = item_to_idx[it]
        vals[r] = mat56[i, :28] if idv.endswith("_validation") else mat56[i, 28:]
    out[F] = np.clip(vals, 0, None)
    out.to_csv(output, index=False, float_format="%.6f")

def validate_like_sample(path, sample):
    df = pd.read_csv(path)
    assert df.shape == sample.shape, f"Shape mismatch: {df.shape} vs {sample.shape}"
    assert list(df["id"]) == list(sample["id"]), "ID order mismatch"
    assert df["id"].is_unique, "Duplicate id"
    vals = df[F].to_numpy(float)
    assert np.isfinite(vals).all(), "NaN/inf found"
    assert (vals >= 0).all(), "Negative prediction found"
    return df
