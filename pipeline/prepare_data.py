#!/usr/bin/env python3
"""
prepare_data.py — AutoParts Forecast Intelligence Platform
Preprocesses train.csv + forecast submission files into processed/ CSVs.

Usage:
    python prepare_data.py [--data-dir data] [--out-dir processed]
"""
from __future__ import annotations

import argparse
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

REFERENCE_DATE = pd.Timestamp("2025-09-05")
FORECAST_START_VAL = pd.Timestamp("2025-09-06")
FORECAST_START_EVAL = pd.Timestamp("2025-10-04")

# Inventory simulation defaults
DEFAULT_STOCK_COVERAGE_DAYS = 21
DEFAULT_LEAD_TIME_DAYS = 14
DEFAULT_SAFETY_STOCK_DAYS = 7

# High disagreement threshold
DISAGREEMENT_HIGH_THRESHOLD = 0.30  # 30%

# ─────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────

def safe_divide(a: pd.Series, b: pd.Series) -> pd.Series:
    return a.div(b.replace(0, np.nan)).fillna(0)


def parse_numeric_col(series: pd.Series) -> pd.Series:
    """Handle comma-decimal strings like '123,456.7' or '123559,1'."""
    if series.dtype == object:
        series = series.astype(str).str.replace(",", ".", regex=False)
    return pd.to_numeric(series, errors="coerce").fillna(0)


def load_train(data_dir: Path) -> pd.DataFrame:
    path = data_dir / "train.csv"
    if not path.exists():
        raise FileNotFoundError(f"train.csv not found at {path}")
    df = pd.read_csv(path, low_memory=False)
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df["Quantity"] = pd.to_numeric(df["Quantity"], errors="coerce").fillna(0).astype(int)
    df["SalesAmount"] = parse_numeric_col(df["SalesAmount"])
    df["Cost Amount"] = parse_numeric_col(df["Cost Amount"])
    return df


def load_forecast(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    df = pd.read_csv(path)
    forecast_cols = [c for c in df.columns if c.startswith("F")]
    df[forecast_cols] = df[forecast_cols].clip(lower=0)
    return df


def forecast_to_sku_totals(df: pd.DataFrame) -> pd.DataFrame:
    """Flatten submission (validation + evaluation rows) into one row per SKU."""
    if df is None:
        return pd.DataFrame()
    forecast_cols = [c for c in df.columns if c.startswith("F")]
    val = df[df["id"].str.endswith("_validation")].copy()
    evl = df[df["id"].str.endswith("_evaluation")].copy()
    val["ItemCode"] = val["id"].str.replace("_validation", "", regex=False)
    evl["ItemCode"] = evl["id"].str.replace("_evaluation", "", regex=False)
    val["forecast_28d_validation"] = val[forecast_cols].sum(axis=1)
    evl["forecast_28d_evaluation"] = evl[forecast_cols].sum(axis=1)
    merged = val[["ItemCode", "forecast_28d_validation"]].merge(
        evl[["ItemCode", "forecast_28d_evaluation"]], on="ItemCode", how="outer"
    ).fillna(0)
    merged["forecast_56d_total"] = merged["forecast_28d_validation"] + merged["forecast_28d_evaluation"]
    merged["avg_forecast_per_day"] = merged["forecast_56d_total"] / 56
    return merged


def get_daily_forecast_series(df: pd.DataFrame, sku: str) -> pd.Series:
    """Return a 56-day daily forecast series for a given SKU."""
    if df is None:
        return pd.Series(dtype=float)
    forecast_cols = [c for c in df.columns if c.startswith("F")]
    val_row = df[df["id"] == f"{sku}_validation"]
    evl_row = df[df["id"] == f"{sku}_evaluation"]
    days = []
    if not val_row.empty:
        days.extend(val_row[forecast_cols].values[0].tolist())
    if not evl_row.empty:
        days.extend(evl_row[forecast_cols].values[0].tolist())
    dates = pd.date_range(FORECAST_START_VAL, periods=len(days), freq="D")
    return pd.Series(np.clip(days, 0, None), index=dates, name="forecast")


# ─────────────────────────────────────────
# SKU-level metrics
# ─────────────────────────────────────────

def compute_sku_metrics(train: pd.DataFrame) -> pd.DataFrame:
    all_skus = train["ItemCode"].unique()

    # ---- Positive / negative split ----
    pos = train[train["Quantity"] > 0]
    neg = train[train["Quantity"] < 0]

    # ---- Aggregate total ----
    total = (
        train.groupby("ItemCode")
        .agg(
            revenue=("SalesAmount", "sum"),
            cost=("Cost Amount", "sum"),
        )
        .reset_index()
    )
    total["profit"] = total["revenue"] - total["cost"]
    total["profit_weight"] = total["profit"].clip(lower=0)

    # ---- Positive qty totals ----
    pos_agg = (
        pos.groupby("ItemCode")
        .agg(
            total_sales_qty=("Quantity", "sum"),
            sale_days_total=("Date", "nunique"),
            last_sale_date=("Date", "max"),
        )
        .reset_index()
    )

    # ---- Negative qty (returns) ----
    neg_agg = (
        neg.groupby("ItemCode")
        .agg(total_return_qty=("Quantity", lambda x: abs(x.sum())))
        .reset_index()
    )

    # ---- Activity in last 180 / 365 days ----
    cutoff_180 = REFERENCE_DATE - pd.Timedelta(days=180)
    cutoff_365 = REFERENCE_DATE - pd.Timedelta(days=365)

    pos_180 = pos[pos["Date"] >= cutoff_180].groupby("ItemCode")["Date"].nunique().rename("sale_days_180")
    pos_365 = pos[pos["Date"] >= cutoff_365].groupby("ItemCode")["Date"].nunique().rename("sale_days_365")
    avg_180 = (
        pos[pos["Date"] >= cutoff_180]
        .groupby("ItemCode")["Quantity"]
        .sum()
        .div(180)
        .rename("avg_daily_sales_180")
    )

    # ---- Build master ----
    sku = (
        pd.DataFrame({"ItemCode": all_skus})
        .merge(total, on="ItemCode", how="left")
        .merge(pos_agg, on="ItemCode", how="left")
        .merge(neg_agg, on="ItemCode", how="left")
        .merge(pos_180.reset_index(), on="ItemCode", how="left")
        .merge(pos_365.reset_index(), on="ItemCode", how="left")
        .merge(avg_180.reset_index(), on="ItemCode", how="left")
    )

    sku["total_sales_qty"] = sku["total_sales_qty"].fillna(0)
    sku["total_return_qty"] = sku["total_return_qty"].fillna(0)
    sku["net_qty"] = sku["total_sales_qty"] - sku["total_return_qty"]
    sku["revenue"] = sku["revenue"].fillna(0)
    sku["cost"] = sku["cost"].fillna(0)
    sku["profit"] = sku["profit"].fillna(0)
    sku["profit_weight"] = sku["profit_weight"].fillna(0)
    sku["sale_days_total"] = sku["sale_days_total"].fillna(0).astype(int)
    sku["sale_days_180"] = sku["sale_days_180"].fillna(0).astype(int)
    sku["sale_days_365"] = sku["sale_days_365"].fillna(0).astype(int)
    sku["avg_daily_sales_180"] = sku["avg_daily_sales_180"].fillna(0)
    sku["last_sale_date"] = pd.to_datetime(sku["last_sale_date"])
    sku["days_since_last_sale"] = (REFERENCE_DATE - sku["last_sale_date"]).dt.days.fillna(9999).astype(int)

    sku["return_ratio"] = safe_divide(sku["total_return_qty"], sku["total_sales_qty"])

    # ---- Profit percentile ----
    sku["profit_percentile"] = sku["profit_weight"].rank(pct=True)

    return sku


# ─────────────────────────────────────────
# Segmentation
# ─────────────────────────────────────────

def assign_profit_segment(sku: pd.DataFrame) -> pd.DataFrame:
    sku["profit_segment"] = "Low Profit"
    sku.loc[sku["profit_percentile"] >= 0.50, "profit_segment"] = "Medium Profit"
    sku.loc[sku["profit_percentile"] >= 0.90, "profit_segment"] = "High Profit"
    return sku


def assign_demand_class(sku: pd.DataFrame) -> pd.DataFrame:
    has_sales = sku["total_sales_qty"] > 0
    dsl_q90 = sku.loc[has_sales, "days_since_last_sale"].quantile(0.90)
    active_180 = sku["sale_days_180"] > 0
    dormant = (~active_180) | (sku["days_since_last_sale"] >= dsl_q90)

    active_mask = active_180 & ~dormant
    med_180 = sku.loc[active_mask, "sale_days_180"].median() if active_mask.any() else 1
    q75_180 = sku.loc[active_mask, "sale_days_180"].quantile(0.75) if active_mask.any() else 1

    sku["demand_class"] = "Dormant"
    sku.loc[active_mask, "demand_class"] = "Active"
    sku.loc[active_mask & (sku["sale_days_180"] <= med_180), "demand_class"] = "Intermittent"
    sku.loc[active_mask & (sku["sale_days_180"] >= q75_180), "demand_class"] = "Frequent"

    return sku


def assign_return_heavy(sku: pd.DataFrame) -> pd.DataFrame:
    has_sales = sku["total_sales_qty"] > 0
    rr_q90 = sku.loc[has_sales, "return_ratio"].quantile(0.90) if has_sales.any() else 1
    sku["return_heavy"] = sku["return_ratio"] >= rr_q90
    return sku


def assign_reliability(sku: pd.DataFrame) -> pd.DataFrame:
    """
    Reliability based on transparent, explainable rules — no arbitrary weights.
    """
    cond_insufficient = sku["sale_days_total"] <= 2

    cond_low = (
        (sku["demand_class"] == "Dormant")
        | sku["return_heavy"]
        | (sku.get("model_disagreement", pd.Series(0, index=sku.index)) >= DISAGREEMENT_HIGH_THRESHOLD)
    )

    cond_medium = (
        (sku["demand_class"] == "Intermittent")
        | ((sku["days_since_last_sale"] > 30) & (sku["days_since_last_sale"] < sku["days_since_last_sale"].quantile(0.90)))
    )

    sku["reliability_tag"] = "High Reliability"
    sku.loc[cond_medium, "reliability_tag"] = "Medium Reliability"
    sku.loc[cond_low, "reliability_tag"] = "Low Reliability"
    sku.loc[cond_insufficient, "reliability_tag"] = "Insufficient History"
    return sku


# ─────────────────────────────────────────
# Model disagreement
# ─────────────────────────────────────────

def compute_disagreement(
    forecast_v19: pd.DataFrame | None,
    forecast_v6: pd.DataFrame | None,
    forecast_v2: pd.DataFrame | None,
    forecast_v22: pd.DataFrame | None,
    all_skus: list[str],
) -> pd.DataFrame:
    dis = pd.DataFrame({"ItemCode": all_skus})

    def disagree(a: pd.DataFrame | None, b: pd.DataFrame | None, col_name: str) -> pd.Series:
        if a is None or b is None:
            return pd.Series(np.nan, index=dis.index)
        m = a.rename(columns={"forecast_56d_total": "a"}).merge(
            b.rename(columns={"forecast_56d_total": "b"})[["ItemCode", "b"]],
            on="ItemCode", how="left"
        )
        denom = m[["a", "b"]].max(axis=1).clip(lower=1)
        return ((m["a"] - m["b"]).abs() / denom).rename(col_name)

    t_v19 = forecast_to_sku_totals(forecast_v19)
    t_v6 = forecast_to_sku_totals(forecast_v6)
    t_v2 = forecast_to_sku_totals(forecast_v2)
    t_v22 = forecast_to_sku_totals(forecast_v22)

    if not t_v19.empty and not t_v6.empty:
        d19_v6 = disagree(t_v19, t_v6, "disagreement_v19_v6_56d")
        dis = dis.merge(
            t_v19[["ItemCode", "forecast_56d_total"]].assign(disagreement_v19_v6_56d=d19_v6.values),
            on="ItemCode", how="left"
        )

    if not t_v19.empty and not t_v22.empty:
        d19_v22 = disagree(t_v19, t_v22, "disagreement_v19_v22_56d")
        dis["disagreement_v19_v22_56d"] = d19_v22.values

    if not t_v6.empty and not t_v2.empty:
        d6_v2 = disagree(t_v6, t_v2, "disagreement_v6_v2_56d")
        dis["disagreement_v6_v2_56d"] = d6_v2.values

    return dis


# ─────────────────────────────────────────
# Reason codes
# ─────────────────────────────────────────

def build_reason_codes(row: pd.Series) -> str:
    reasons = []
    if row.get("sale_days_total", 0) <= 2:
        reasons.append(f"Only {int(row['sale_days_total'])} total sale days (Insufficient History)")
    if row.get("demand_class") == "Dormant":
        reasons.append(f"Dormant SKU — no sale in last 180 days")
    if row.get("days_since_last_sale", 9999) > 90:
        reasons.append(f"Last sale was {int(row['days_since_last_sale'])} days ago")
    if row.get("sale_days_180", 0) > 0 and row.get("sale_days_180", 0) <= 5:
        reasons.append(f"Only {int(row['sale_days_180'])} sale days in last 180 days")
    if row.get("return_heavy", False):
        reasons.append(f"High return ratio: {row.get('return_ratio', 0)*100:.1f}%")
    if row.get("model_disagreement", 0) >= DISAGREEMENT_HIGH_THRESHOLD:
        reasons.append(f"High model disagreement: {row.get('model_disagreement', 0)*100:.1f}%")
    if row.get("profit_segment") == "High Profit":
        reasons.append(f"High profit SKU: top 10%")
    if row.get("demand_class") == "Dormant" and row.get("forecast_56d_total", 0) > 1:
        reasons.append(f"Dormant SKU with non-zero forecast ({row.get('forecast_56d_total', 0):.1f} units)")
    if row.get("demand_class") == "Frequent":
        reasons.append("Frequent recent sales")
    if row.get("model_disagreement", 0) < 0.10 and row.get("demand_class") not in ["Dormant", None]:
        reasons.append("Stable model agreement")
    return " | ".join(reasons) if reasons else "Normal SKU"


# ─────────────────────────────────────────
# Risk & action
# ─────────────────────────────────────────

def assign_risk_level(sku: pd.DataFrame) -> pd.DataFrame:
    sku["risk_level"] = "Normal"
    # Medium risk: intermittent, some recency concern, moderate disagreement
    med = (
        (sku["demand_class"] == "Intermittent")
        | (sku.get("model_disagreement", pd.Series(0, index=sku.index)).between(0.15, DISAGREEMENT_HIGH_THRESHOLD))
        | ((sku["stockout_flag"]) & (sku["profit_segment"] == "Medium Profit"))
    )
    sku.loc[med, "risk_level"] = "Medium Risk"
    # High risk
    high = (
        (sku["reliability_tag"] == "Low Reliability")
        | (sku["stockout_flag"] & (sku["profit_segment"] == "High Profit"))
        | (sku.get("model_disagreement", pd.Series(0, index=sku.index)) >= DISAGREEMENT_HIGH_THRESHOLD)
    )
    sku.loc[high, "risk_level"] = "High Risk"
    # Low risk
    low = (
        (sku["reliability_tag"] == "High Reliability")
        & (sku["risk_level"] == "Normal")
        & (~sku["stockout_flag"])
    )
    sku.loc[low, "risk_level"] = "Low Risk"
    return sku


def assign_action(sku: pd.DataFrame) -> pd.DataFrame:
    sku["recommended_action"] = "Monitor closely"

    # Overstock + low profit → do not replenish
    sku.loc[
        sku["overstock_flag"] & (sku["profit_segment"] == "Low Profit"),
        "recommended_action"
    ] = "Do not replenish"

    # Overstock + medium/high profit → review slow-moving
    sku.loc[
        sku["overstock_flag"] & (sku["profit_segment"] != "Low Profit"),
        "recommended_action"
    ] = "Review slow-moving stock"

    # Return-heavy → check quality
    sku.loc[sku["return_heavy"], "recommended_action"] = "Check return/quality issue"

    # Stockout risk + high profit → prioritize
    sku.loc[
        sku["stockout_flag"] & (sku["profit_segment"] == "High Profit"),
        "recommended_action"
    ] = "Prioritize replenishment"

    # Stockout risk + medium profit → review with sales
    sku.loc[
        sku["stockout_flag"] & (sku["profit_segment"] == "Medium Profit"),
        "recommended_action"
    ] = "Review with Sales"

    # Low reliability high profit → manual review
    sku.loc[
        (sku["reliability_tag"] == "Low Reliability") & (sku["profit_segment"] == "High Profit"),
        "recommended_action"
    ] = "Manual review required"

    # High model disagreement + high forecast → manual review
    sku.loc[
        (sku.get("model_disagreement", pd.Series(0, index=sku.index)) >= DISAGREEMENT_HIGH_THRESHOLD)
        & (sku["forecast_56d_total"] > sku["forecast_56d_total"].quantile(0.75)),
        "recommended_action"
    ] = "Manual review required"

    return sku


def assign_priority(sku: pd.DataFrame) -> pd.DataFrame:
    sku["priority_level"] = "P3 — Normal"

    # P4 — Low Priority
    sku.loc[
        (sku["profit_segment"] == "Low Profit")
        | (sku["demand_class"] == "Dormant")
        | (sku["forecast_56d_total"] < sku["forecast_56d_total"].quantile(0.10)),
        "priority_level"
    ] = "P4 — Low Priority"

    # P2 — Monitor Closely
    sku.loc[
        ((sku["profit_segment"].isin(["Medium Profit", "High Profit"])) & (sku["reliability_tag"] == "Medium Reliability"))
        | (sku["risk_level"] == "Medium Risk"),
        "priority_level"
    ] = "P2 — Monitor Closely"

    # P1 — Urgent Review
    sku.loc[
        ((sku["profit_segment"] == "High Profit") & (sku["reliability_tag"] == "Low Reliability"))
        | ((sku["profit_segment"] == "High Profit") & (sku["risk_level"] == "High Risk"))
        | (
            (sku.get("model_disagreement", pd.Series(0, index=sku.index)) >= DISAGREEMENT_HIGH_THRESHOLD)
            & (sku["forecast_56d_total"] > sku["forecast_56d_total"].quantile(0.75))
        ),
        "priority_level"
    ] = "P1 — Urgent Review"

    return sku


# ─────────────────────────────────────────
# Inventory simulation
# ─────────────────────────────────────────

def simulate_inventory(
    sku: pd.DataFrame,
    stock_coverage_days: int = DEFAULT_STOCK_COVERAGE_DAYS,
    lead_time_days: int = DEFAULT_LEAD_TIME_DAYS,
    safety_stock_days: int = DEFAULT_SAFETY_STOCK_DAYS,
) -> pd.DataFrame:
    sku["assumed_current_stock"] = sku["avg_forecast_per_day"] * stock_coverage_days
    sku["forecast_during_lead_time"] = sku["avg_forecast_per_day"] * lead_time_days
    sku["safety_stock_demand"] = sku["avg_forecast_per_day"] * safety_stock_days
    sku["projected_stock_after_lead_time"] = (
        sku["assumed_current_stock"] - sku["forecast_during_lead_time"]
    )
    sku["stockout_flag"] = sku["projected_stock_after_lead_time"] < sku["safety_stock_demand"]
    sku["reorder_qty"] = (
        sku["forecast_during_lead_time"] + sku["safety_stock_demand"] - sku["assumed_current_stock"]
    ).clip(lower=0)
    sku["overstock_flag"] = sku["assumed_current_stock"] > sku["forecast_56d_total"] * 1.5
    return sku


# ─────────────────────────────────────────
# Main
# ─────────────────────────────────────────

def main(data_dir: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    print("📦 Loading train.csv …")
    train = load_train(data_dir)

    print("📊 Loading forecast files …")
    f_v115 = load_forecast(data_dir / "submission_v115.csv")
    f_v22 = load_forecast(data_dir / "submission_v22.csv")
    f_v19 = load_forecast(data_dir / "submission_v19.csv")
    f_v6 = load_forecast(data_dir / "submission_v6.csv")
    f_v2 = load_forecast(data_dir / "submission_v2.csv")
    f_v16 = load_forecast(data_dir / "submission_v16.csv")

    # Pick best available forecast as primary — v115 là bản tốt nhất trên Kaggle
    def _first_valid(*dfs):
        for d in dfs:
            if d is not None and not d.empty:
                return d
        return None

    primary = _first_valid(f_v115, f_v22, f_v19, f_v6, f_v2, f_v16)
    if primary is None:
        raise RuntimeError("No forecast file found. Please add at least one submission_*.csv to data/")

    print("🔢 Computing SKU metrics …")
    sku = compute_sku_metrics(train)

    # Attach forecast totals from primary model
    forecast_df = forecast_to_sku_totals(primary)
    sku = sku.merge(forecast_df, on="ItemCode", how="left")
    sku["forecast_28d_validation"] = sku["forecast_28d_validation"].fillna(0)
    sku["forecast_28d_evaluation"] = sku["forecast_28d_evaluation"].fillna(0)
    sku["forecast_56d_total"] = sku["forecast_56d_total"].fillna(0)
    sku["avg_forecast_per_day"] = sku["avg_forecast_per_day"].fillna(0)

    print("📐 Computing model disagreement …")
    # v115 là primary; dùng v22 hoặc v6 làm challenger để tính disagreement
    ref_forecast = f_v115 if f_v115 is not None else f_v19
    dis = compute_disagreement(ref_forecast, f_v6, f_v2, f_v22, sku["ItemCode"].tolist())
    # Use v19_v6 (hoặc v115_v6) as primary disagreement signal; fall back to v19_v22
    if "disagreement_v19_v6_56d" in dis.columns:
        dis["model_disagreement"] = dis["disagreement_v19_v6_56d"].fillna(0)
    elif "disagreement_v19_v22_56d" in dis.columns:
        dis["model_disagreement"] = dis["disagreement_v19_v22_56d"].fillna(0)
    else:
        dis["model_disagreement"] = 0.0

    dis_cols = ["ItemCode", "model_disagreement"] + [
        c for c in dis.columns if c.startswith("disagreement_") and c != "model_disagreement"
    ]
    sku = sku.merge(dis[dis_cols], on="ItemCode", how="left")
    sku["model_disagreement"] = sku["model_disagreement"].fillna(0)

    print("🏷️  Assigning segments and tags …")
    sku = assign_profit_segment(sku)
    sku = assign_demand_class(sku)
    sku = assign_return_heavy(sku)

    # Inventory simulation (default params)
    sku = simulate_inventory(sku)

    sku = assign_reliability(sku)
    sku = assign_risk_level(sku)
    sku = assign_action(sku)
    sku = assign_priority(sku)

    print("📝 Building reason codes …")
    sku["reason_codes"] = sku.apply(build_reason_codes, axis=1)

    # ─── Save outputs ───
    print("💾 Saving processed files …")

    sku.to_csv(out_dir / "sku_summary.csv", index=False)
    print(f"  ✓ sku_summary.csv  ({len(sku):,} rows)")

    forecast_df.to_csv(out_dir / "forecast_summary.csv", index=False)
    print(f"  ✓ forecast_summary.csv  ({len(forecast_df):,} rows)")

    risk_cols = [
        "ItemCode", "profit_segment", "demand_class", "reliability_tag",
        "priority_level", "risk_level", "recommended_action", "reason_codes",
        "forecast_28d_validation", "forecast_28d_evaluation", "forecast_56d_total",
        "sale_days_180", "days_since_last_sale", "return_ratio", "model_disagreement",
        "stockout_flag", "overstock_flag", "reorder_qty",
    ]
    risk_cols = [c for c in risk_cols if c in sku.columns]
    sku[risk_cols].to_csv(out_dir / "risk_table.csv", index=False)
    print(f"  ✓ risk_table.csv")

    dis.to_csv(out_dir / "model_disagreement.csv", index=False)
    print(f"  ✓ model_disagreement.csv")

    # Monthly trend for frontend charts
    monthly = (
        train[train["Quantity"] > 0]
        .assign(month=lambda x: x["Date"].dt.to_period("M").dt.to_timestamp())
        .groupby("month")
        .agg(total_qty=("Quantity", "sum"), total_revenue=("SalesAmount", "sum"))
        .reset_index()
    )
    monthly.columns = ["month", "total_qty", "total_revenue"]
    monthly["month"] = monthly["month"].dt.strftime("%Y-%m")
    monthly.to_csv(out_dir / "monthly_trend.csv", index=False)
    print(f"  ✓ monthly_trend.csv  ({len(monthly)} months)")

    # Manual review queue
    mrq_mask = (
        ((sku["profit_segment"] == "High Profit") & (sku["reliability_tag"] == "Low Reliability"))
        | ((sku["profit_segment"] == "High Profit") & (sku["risk_level"] == "High Risk"))
        | (sku["model_disagreement"] >= DISAGREEMENT_HIGH_THRESHOLD)
        | sku["return_heavy"]
        | ((sku["demand_class"] == "Dormant") & (sku["forecast_56d_total"] > 1))
        | (sku["stockout_flag"] & (sku["profit_segment"] == "High Profit"))
    )
    mrq = sku[mrq_mask].copy()
    mrq.to_csv(out_dir / "manual_review_queue.csv", index=False)
    print(f"  ✓ manual_review_queue.csv  ({len(mrq):,} SKUs flagged)")

    # Stats
    print("\n📈 Summary:")
    print(f"  Total SKUs:               {len(sku):,}")
    print(f"  High Profit SKUs:         {(sku['profit_segment']=='High Profit').sum():,}")
    print(f"  Stockout risk SKUs:       {sku['stockout_flag'].sum():,}")
    print(f"  P1 Urgent Review SKUs:    {(sku['priority_level']=='P1 — Urgent Review').sum():,}")
    print(f"  Manual Review Queue:      {len(mrq):,}")
    print(f"  Total 56d forecast qty:   {sku['forecast_56d_total'].sum():,.0f}")
    print("\n✅ Done. Run: streamlit run app.py")


if __name__ == "__main__":
    # Mặc định: data/ và processed/ nằm ở thư mục gốc project (một cấp trên pipeline/)
    _root = Path(__file__).parent.parent
    parser = argparse.ArgumentParser(description="Prepare data for AutoParts Forecast Intelligence Platform")
    parser.add_argument("--data-dir", type=Path, default=_root / "data")
    parser.add_argument("--out-dir",  type=Path, default=_root / "processed")
    args = parser.parse_args()
    main(args.data_dir, args.out_dir)
