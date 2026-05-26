"""
AutoParts Forecast Intelligence Platform
Nền tảng dự báo nhu cầu và cảnh báo rủi ro tồn kho phụ tùng ô tô

Dashboard dành cho người dùng kinh doanh: Quản lý, Kinh doanh, Kho vận.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

# ─── Cài đặt trang ───────────────────────────────────────────────────────────
st.set_page_config(
    page_title="AutoParts — Quản lý dự báo nhu cầu",
    page_icon="🚗",
    layout="wide",
    initial_sidebar_state="expanded",
)

DATA_DIR = Path("data")
PROC_DIR = Path("processed")

# ─── Màu sắc nhất quán ───────────────────────────────────────────────────────
C_RED    = "#D32F2F"
C_ORANGE = "#E65100"
C_YELLOW = "#F9A825"
C_GREEN  = "#2E7D32"
C_BLUE   = "#1565C0"
C_GRAY   = "#616161"
C_BG_RED    = "#FFEBEE"
C_BG_ORANGE = "#FFF3E0"
C_BG_GREEN  = "#E8F5E9"
C_BG_GRAY   = "#F5F5F5"

FORECAST_START = pd.Timestamp("2025-09-06")

# ─── Mapping ngôn ngữ kinh doanh ─────────────────────────────────────────────
ACTION_LABEL = {
    "Prioritize replenishment":  "🔴 Nhập hàng ngay",
    "Review with Sales":         "🟡 Cần xem xét",
    "Manual review required":    "🟡 Cần xem xét",
    "Monitor closely":           "🟢 Theo dõi",
    "Do not replenish":          "⚫ Không nhập thêm",
    "Check return/quality issue":"🟣 Kiểm tra hoàn hàng",
    "Review slow-moving stock":  "🔵 Hàng tồn chậm",
}
ACTION_PRIORITY = {
    "🔴 Nhập hàng ngay":      0,
    "🟡 Cần xem xét":         1,
    "🟣 Kiểm tra hoàn hàng":  2,
    "🔵 Hàng tồn chậm":       3,
    "🟢 Theo dõi":             4,
    "⚫ Không nhập thêm":      5,
}
DEMAND_LABEL = {
    "Frequent":      "Bán thường xuyên",
    "Active":        "Đang bán",
    "Intermittent":  "Bán gián đoạn",
    "Dormant":       "Không còn bán",
}
PROFIT_LABEL = {
    "High Profit":   "Lợi nhuận cao",
    "Medium Profit": "Lợi nhuận trung bình",
    "Low Profit":    "Lợi nhuận thấp",
}
STATUS_LABEL   = {True: "⚠️ Nguy cơ hết hàng", False: "✅ Đủ hàng"}
OVERSTOCK_LABEL = {True: "📦 Tồn dư", False: ""}


# ─── Data loaders ─────────────────────────────────────────────────────────────

@st.cache_data(show_spinner=False)
def load_sku() -> pd.DataFrame | None:
    p = PROC_DIR / "sku_summary.csv"
    if not p.exists():
        return None
    df = pd.read_csv(p, low_memory=False)
    df["last_sale_date"] = pd.to_datetime(df["last_sale_date"], errors="coerce")
    return df


@st.cache_data(show_spinner=False)
def load_train_daily() -> pd.DataFrame | None:
    p = DATA_DIR / "train.csv"
    if not p.exists():
        return None
    df = pd.read_csv(p, low_memory=False, usecols=["Date", "ItemCode", "Quantity"])
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df["Quantity"] = pd.to_numeric(df["Quantity"], errors="coerce").fillna(0)
    return df


@st.cache_data(show_spinner=False)
def load_forecast_file() -> pd.DataFrame | None:
    for fname in ["submission_v22.csv", "submission_v19.csv",
                  "submission_v6.csv", "submission_v2.csv"]:
        p = DATA_DIR / fname
        if p.exists():
            df = pd.read_csv(p)
            fcols = [c for c in df.columns if c.startswith("F")]
            df[fcols] = df[fcols].clip(lower=0)
            return df
    return None


def get_sku_forecast_series(fc_df: pd.DataFrame | None, sku: str) -> pd.Series:
    if fc_df is None:
        return pd.Series(dtype=float)
    fcols = [c for c in fc_df.columns if c.startswith("F")]
    val = fc_df[fc_df["id"] == f"{sku}_validation"]
    evl = fc_df[fc_df["id"] == f"{sku}_evaluation"]
    vals: list[float] = []
    if not val.empty:
        vals.extend(val[fcols].values[0].tolist())
    if not evl.empty:
        vals.extend(evl[fcols].values[0].tolist())
    if not vals:
        return pd.Series(dtype=float)
    idx = pd.date_range(FORECAST_START, periods=len(vals), freq="D")
    return pd.Series(np.clip(vals, 0, None), index=idx)


def build_display_df(raw: pd.DataFrame, lt: int, ss: int, cov: int) -> pd.DataFrame:
    """Tính toán tồn kho mô phỏng và thêm nhãn hiển thị."""
    df = raw.copy()

    # Tính tồn kho mô phỏng
    afpd = df["avg_forecast_per_day"].fillna(0)
    df["ton_kho_uoc_tinh"] = afpd * cov
    df["nhu_cau_lead_time"] = afpd * lt
    df["ton_kho_sau_lt"]    = df["ton_kho_uoc_tinh"] - df["nhu_cau_lead_time"]
    df["safety_stock"]      = afpd * ss
    df["nguy_co_het_hang"]  = df["ton_kho_sau_lt"] < df["safety_stock"]
    df["ton_du"]            = df["ton_kho_uoc_tinh"] > df["forecast_56d_total"] * 1.5
    df["so_luong_can_nhap"] = (
        df["nhu_cau_lead_time"] + df["safety_stock"] - df["ton_kho_uoc_tinh"]
    ).clip(lower=0)

    # Nhãn hiển thị
    df["hanh_dong"]   = df["recommended_action"].map(ACTION_LABEL).fillna("🟢 Theo dõi")
    df["xu_huong"]    = df["demand_class"].map(DEMAND_LABEL).fillna(df["demand_class"])
    df["phan_khuc"]   = df["profit_segment"].map(PROFIT_LABEL).fillna(df["profit_segment"])

    # Trạng thái tổng hợp
    def _status(row):
        if row["nguy_co_het_hang"]:
            return "⚠️ Nguy cơ hết hàng"
        if row["ton_du"]:
            return "📦 Tồn kho dư"
        return "✅ Bình thường"

    df["trang_thai"] = df.apply(_status, axis=1)

    # Thứ tự ưu tiên
    df["priority_order"] = df["hanh_dong"].map(ACTION_PRIORITY).fillna(99)

    return df


# ─── Sidebar ──────────────────────────────────────────────────────────────────

def render_sidebar() -> dict:
    with st.sidebar:
        st.markdown("## 🚗 AutoParts FIP")
        st.caption("Quản lý dự báo nhu cầu phụ tùng ô tô")
        st.divider()

        role = st.selectbox(
            "Vai trò của bạn",
            ["Quản lý", "Kinh doanh", "Kho vận"],
        )

        st.divider()
        st.markdown("**🔍 Lọc danh sách SKU**")

        trang_thai = st.multiselect(
            "Trạng thái tồn kho",
            ["⚠️ Nguy cơ hết hàng", "📦 Tồn kho dư", "✅ Bình thường"],
            default=[],
            placeholder="Tất cả",
        )
        hanh_dong_filter = st.multiselect(
            "Hành động",
            ["🔴 Nhập hàng ngay", "🟡 Cần xem xét", "🟣 Kiểm tra hoàn hàng",
             "🔵 Hàng tồn chậm", "🟢 Theo dõi", "⚫ Không nhập thêm"],
            default=[],
            placeholder="Tất cả",
        )
        phan_khuc = st.selectbox(
            "Phân khúc lợi nhuận",
            ["Tất cả", "Lợi nhuận cao", "Lợi nhuận trung bình", "Lợi nhuận thấp"],
        )
        xu_huong = st.selectbox(
            "Xu hướng bán",
            ["Tất cả", "Bán thường xuyên", "Đang bán", "Bán gián đoạn", "Không còn bán"],
        )
        search = st.text_input("🔎 Tìm mã SKU", placeholder="VD: SKU-09760")

        st.divider()
        st.markdown("**⚙️ Cài đặt tồn kho**")
        st.caption("Dùng để tính toán nhu cầu nhập hàng. Điều chỉnh theo thực tế kho của bạn.")
        lt  = st.slider("Thời gian chờ hàng (ngày)", 3, 60, 14,
                        help="Lead time từ khi đặt đến khi nhận hàng")
        ss  = st.slider("Dự phòng an toàn (ngày)",   0, 30,  7,
                        help="Số ngày tồn kho tối thiểu cần duy trì")
        cov = st.slider("Tồn kho hiện tại (ngày)",   0, 90, 21,
                        help="Ước tính tồn kho hiện tại = avg_ngày × số ngày này")

    return dict(
        role=role, trang_thai=trang_thai, hanh_dong_filter=hanh_dong_filter,
        phan_khuc=phan_khuc, xu_huong=xu_huong, search=search,
        lt=lt, ss=ss, cov=cov,
    )


def apply_filters(df: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    out = df.copy()
    if cfg["trang_thai"]:
        out = out[out["trang_thai"].isin(cfg["trang_thai"])]
    if cfg["hanh_dong_filter"]:
        out = out[out["hanh_dong"].isin(cfg["hanh_dong_filter"])]
    if cfg["phan_khuc"] != "Tất cả" and "phan_khuc" in out.columns:
        out = out[out["phan_khuc"] == cfg["phan_khuc"]]
    if cfg["xu_huong"] != "Tất cả" and "xu_huong" in out.columns:
        out = out[out["xu_huong"] == cfg["xu_huong"]]
    if cfg["search"] and "ItemCode" in out.columns:
        out = out[out["ItemCode"].str.contains(cfg["search"].strip().upper(), na=False)]
    return out


# ─── Tab 1: Tổng quan ─────────────────────────────────────────────────────────

def tab_tong_quan(df: pd.DataFrame, cfg: dict) -> None:
    role = cfg["role"]

    # ── KPI Cards ──
    if role == "Quản lý":
        c1, c2, c3, c4 = st.columns(4)
        c1.metric(
            "Tổng nhu cầu dự báo (56 ngày)",
            f"{df['forecast_56d_total'].sum():,.0f} units",
        )
        c2.metric(
            "Doanh thu lịch sử (tổng)",
            f"{df['revenue'].sum() / 1e9:,.1f} tỷ đồng",
        )
        c3.metric(
            "Lợi nhuận lịch sử (tổng)",
            f"{df['profit'].clip(lower=0).sum() / 1e9:,.1f} tỷ đồng",
        )
        n_urgent = (df["hanh_dong"] == "🔴 Nhập hàng ngay").sum()
        c4.metric(
            "SKU cần nhập hàng ngay",
            f"{n_urgent:,}",
            delta="Cần xử lý" if n_urgent > 0 else "Không có",
            delta_color="inverse" if n_urgent > 0 else "normal",
        )

    elif role == "Kinh doanh":
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Tổng nhu cầu 28 ngày tới",
                  f"{df['forecast_28d_validation'].sum():,.0f} units")
        c2.metric("Tổng nhu cầu 56 ngày tới",
                  f"{df['forecast_56d_total'].sum():,.0f} units")
        hp = (df["phan_khuc"] == "Lợi nhuận cao")
        c3.metric("SKU lợi nhuận cao",
                  f"{hp.sum():,}",
                  delta=f"Dự báo {df.loc[hp, 'forecast_56d_total'].sum():,.0f} units")
        c4.metric("SKU bán thường xuyên",
                  f"{(df['xu_huong'] == 'Bán thường xuyên').sum():,}")

    else:  # Kho vận
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("SKU nguy cơ hết hàng",
                  f"{df['nguy_co_het_hang'].sum():,}",
                  delta_color="inverse",
                  delta="Cần nhập hàng" if df["nguy_co_het_hang"].sum() > 0 else "")
        c2.metric("SKU tồn kho dư",
                  f"{df['ton_du'].sum():,}",
                  delta="Kiểm tra" if df["ton_du"].sum() > 0 else "")
        c3.metric("Tổng số lượng cần đặt hàng",
                  f"{df['so_luong_can_nhap'].sum():,.0f} units")
        c4.metric("SKU không còn bán",
                  f"{(df['xu_huong'] == 'Không còn bán').sum():,}")

    st.divider()

    # ── Biểu đồ hàng 1 ──
    col1, col2 = st.columns([3, 2])

    with col1:
        st.markdown("#### Top 15 SKU — Nhu cầu dự báo cao nhất (56 ngày)")
        top15 = df.nlargest(15, "forecast_56d_total")[
            ["ItemCode", "forecast_56d_total", "trang_thai", "hanh_dong"]
        ].copy()
        color_map = {
            "⚠️ Nguy cơ hết hàng": C_RED,
            "📦 Tồn kho dư":        C_BLUE,
            "✅ Bình thường":        C_GREEN,
        }
        colors = [color_map.get(s, C_GRAY) for s in top15["trang_thai"]]
        fig = go.Figure(go.Bar(
            x=top15["forecast_56d_total"],
            y=top15["ItemCode"],
            orientation="h",
            marker_color=colors,
            text=top15["forecast_56d_total"].map("{:,.0f}".format),
            textposition="outside",
            customdata=top15[["trang_thai", "hanh_dong"]].values,
            hovertemplate=(
                "<b>%{y}</b><br>"
                "Dự báo 56 ngày: %{x:,.0f} units<br>"
                "Trạng thái: %{customdata[0]}<br>"
                "Hành động: %{customdata[1]}<extra></extra>"
            ),
        ))
        fig.update_layout(
            template="plotly_white", height=420,
            xaxis_title="Số lượng dự báo (units)",
            yaxis=dict(autorange="reversed"),
            margin=dict(l=0, r=60, t=8, b=0),
        )
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.markdown("#### Phân bố trạng thái tồn kho")
        status_counts = df["trang_thai"].value_counts().reset_index()
        status_counts.columns = ["Trạng thái", "Số SKU"]
        fig2 = go.Figure(go.Pie(
            labels=status_counts["Trạng thái"],
            values=status_counts["Số SKU"],
            marker_colors=[color_map.get(s, C_GRAY) for s in status_counts["Trạng thái"]],
            hole=0.45,
            textinfo="label+percent",
            hovertemplate="%{label}<br>%{value:,} SKU (%{percent})<extra></extra>",
        ))
        fig2.update_layout(
            template="plotly_white", height=220,
            showlegend=False,
            margin=dict(l=0, r=0, t=8, b=0),
        )
        st.plotly_chart(fig2, use_container_width=True)

        st.markdown("#### Nhu cầu theo phân khúc lợi nhuận")
        seg = df.groupby("phan_khuc")["forecast_56d_total"].sum().reset_index()
        seg_color = {"Lợi nhuận cao": C_GREEN, "Lợi nhuận trung bình": C_ORANGE, "Lợi nhuận thấp": C_GRAY}
        fig3 = go.Figure(go.Bar(
            x=seg["phan_khuc"],
            y=seg["forecast_56d_total"],
            marker_color=[seg_color.get(s, C_GRAY) for s in seg["phan_khuc"]],
            text=seg["forecast_56d_total"].map("{:,.0f}".format),
            textposition="outside",
        ))
        fig3.update_layout(
            template="plotly_white", height=200,
            yaxis_title="Dự báo (units)", showlegend=False,
            margin=dict(l=0, r=0, t=8, b=0),
        )
        st.plotly_chart(fig3, use_container_width=True)

    # ── Xu hướng bán hàng lịch sử ──
    st.markdown("#### Xu hướng bán hàng theo tháng (2022–2025)")
    train = load_train_daily()
    if train is not None:
        monthly = (
            train[train["Quantity"] > 0]
            .assign(Tháng=lambda x: x["Date"].dt.to_period("M").dt.to_timestamp())
            .groupby("Tháng")["Quantity"]
            .sum()
            .reset_index()
        )
        monthly = monthly[monthly["Tháng"] >= pd.Timestamp("2022-01-01")]
        fig4 = go.Figure(go.Scatter(
            x=monthly["Tháng"], y=monthly["Quantity"],
            mode="lines+markers",
            line=dict(color=C_BLUE, width=2),
            marker=dict(size=4),
            fill="tozeroy",
            fillcolor="rgba(21,101,192,0.08)",
            hovertemplate="%{x|%m/%Y}: %{y:,.0f} units<extra></extra>",
        ))
        fig4.add_vrect(
            x0=FORECAST_START, x1=FORECAST_START + pd.Timedelta(days=56),
            fillcolor="rgba(211,47,47,0.07)", line_width=0,
            annotation_text="Kỳ dự báo", annotation_position="top left",
            annotation_font_size=11,
        )
        fig4.update_layout(
            template="plotly_white", height=220,
            xaxis_title="Tháng", yaxis_title="Số lượng bán",
            margin=dict(l=0, r=0, t=8, b=0),
        )
        st.plotly_chart(fig4, use_container_width=True)


# ─── Tab 2: Cảnh báo & Hành động ─────────────────────────────────────────────

def tab_canh_bao(df: pd.DataFrame, cfg: dict) -> None:
    # Chỉ show các SKU cần hành động (bỏ qua "Theo dõi" và "Không nhập thêm" nếu không filter)
    focus = df[df["hanh_dong"].isin([
        "🔴 Nhập hàng ngay",
        "🟡 Cần xem xét",
        "🟣 Kiểm tra hoàn hàng",
        "🔵 Hàng tồn chậm",
    ])].copy()

    if cfg["trang_thai"] or cfg["hanh_dong_filter"] or cfg["search"]:
        focus = apply_filters(df, cfg)

    focus = focus.sort_values("priority_order")

    # ── Summary ──
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Nhập hàng ngay",      f"{(focus['hanh_dong']=='🔴 Nhập hàng ngay').sum():,}",
              delta_color="inverse")
    c2.metric("Cần xem xét",         f"{(focus['hanh_dong']=='🟡 Cần xem xét').sum():,}")
    c3.metric("Kiểm tra hoàn hàng",  f"{(focus['hanh_dong']=='🟣 Kiểm tra hoàn hàng').sum():,}")
    c4.metric("Hàng tồn chậm",       f"{(focus['hanh_dong']=='🔵 Hàng tồn chậm').sum():,}")

    # ── Hướng dẫn màu sắc ──
    cols = st.columns(6)
    guide = [
        (C_BG_RED,    "🔴 Nhập hàng ngay"),
        (C_BG_ORANGE, "🟡 Cần xem xét"),
        ("#F3E5F5",   "🟣 Kiểm tra hoàn hàng"),
        ("#E3F2FD",   "🔵 Hàng tồn chậm"),
        (C_BG_GREEN,  "🟢 Theo dõi"),
        (C_BG_GRAY,   "⚫ Không nhập thêm"),
    ]
    for col, (bg, label) in zip(cols, guide):
        col.markdown(
            f"<div style='background:{bg};padding:4px 8px;border-radius:4px;"
            f"font-size:12px;text-align:center'>{label}</div>",
            unsafe_allow_html=True,
        )

    st.markdown("---")

    # ── Bảng ──
    COLS = {
        "ItemCode":               "Mã SKU",
        "phan_khuc":              "Phân khúc",
        "xu_huong":               "Xu hướng bán",
        "forecast_28d_validation":"Dự báo 28 ngày",
        "forecast_56d_total":     "Dự báo 56 ngày",
        "so_luong_can_nhap":      "Cần đặt thêm",
        "trang_thai":             "Trạng thái tồn kho",
        "hanh_dong":              "Hành động",
        "reason_codes":           "Lý do",
    }
    valid_cols = [c for c in COLS if c in focus.columns]
    disp = focus[valid_cols].rename(columns=COLS).copy()

    for col in ["Dự báo 28 ngày", "Dự báo 56 ngày", "Cần đặt thêm"]:
        if col in disp.columns:
            disp[col] = disp[col].map(lambda x: f"{x:,.0f}" if pd.notna(x) else "0")

    def _row_style(row):
        action = row.get("Hành động", "")
        if action == "🔴 Nhập hàng ngay":
            return [f"background-color:{C_BG_RED}"] * len(row)
        if action in ("🟡 Cần xem xét",):
            return [f"background-color:{C_BG_ORANGE}"] * len(row)
        if action == "🟣 Kiểm tra hoàn hàng":
            return ["background-color:#F3E5F5"] * len(row)
        if action == "🔵 Hàng tồn chậm":
            return ["background-color:#E3F2FD"] * len(row)
        return [""] * len(row)

    st.dataframe(
        disp.style.apply(_row_style, axis=1),
        use_container_width=True,
        hide_index=True,
        height=520,
    )

    st.download_button(
        "⬇️ Xuất danh sách Excel (CSV)",
        focus[valid_cols].rename(columns=COLS).to_csv(index=False).encode("utf-8"),
        file_name="canh_bao_ton_kho.csv",
        mime="text/csv",
    )


# ─── Tab 3: Danh sách SKU ─────────────────────────────────────────────────────

def tab_danh_sach(df: pd.DataFrame, cfg: dict) -> None:
    filtered = apply_filters(df, cfg).sort_values("priority_order")

    st.caption(f"Hiển thị **{len(filtered):,}** / {len(df):,} SKU")

    COLS = {
        "ItemCode":               "Mã SKU",
        "phan_khuc":              "Phân khúc",
        "xu_huong":               "Xu hướng bán",
        "sale_days_180":          "Ngày bán (180 ngày gần)",
        "days_since_last_sale":   "Ngày từ lần bán cuối",
        "forecast_28d_validation":"Dự báo 28 ngày",
        "forecast_56d_total":     "Dự báo 56 ngày",
        "so_luong_can_nhap":      "Cần đặt thêm",
        "trang_thai":             "Trạng thái",
        "hanh_dong":              "Hành động",
    }
    valid_cols = [c for c in COLS if c in filtered.columns]
    disp = filtered[valid_cols].rename(columns=COLS).copy()

    for col in ["Dự báo 28 ngày", "Dự báo 56 ngày", "Cần đặt thêm"]:
        if col in disp.columns:
            disp[col] = disp[col].map(lambda x: f"{x:,.1f}" if pd.notna(x) else "0")

    st.dataframe(disp, use_container_width=True, hide_index=True, height=560)

    st.download_button(
        "⬇️ Xuất danh sách (CSV)",
        filtered[valid_cols].rename(columns=COLS).to_csv(index=False).encode("utf-8"),
        file_name="danh_sach_sku.csv",
        mime="text/csv",
    )


# ─── Tab 4: Chi tiết SKU ──────────────────────────────────────────────────────

def tab_chi_tiet(df: pd.DataFrame, cfg: dict) -> None:
    all_skus = sorted(df["ItemCode"].tolist())
    default  = 0
    if cfg["search"]:
        hits = [i for i, s in enumerate(all_skus) if cfg["search"].strip().upper() in s]
        if hits:
            default = hits[0]

    selected = st.selectbox("Chọn mã SKU", all_skus, index=default)
    row = df[df["ItemCode"] == selected].iloc[0]

    # ── Trạng thái tổng hợp ──
    hanh_dong = row.get("hanh_dong", "🟢 Theo dõi")
    bg_color  = {
        "🔴 Nhập hàng ngay":     C_BG_RED,
        "🟡 Cần xem xét":        C_BG_ORANGE,
        "🟣 Kiểm tra hoàn hàng": "#F3E5F5",
        "🔵 Hàng tồn chậm":      "#E3F2FD",
    }.get(hanh_dong, C_BG_GREEN)

    st.markdown(
        f"<div style='padding:14px 20px;background:{bg_color};border-radius:8px;"
        f"font-size:18px;font-weight:bold;margin-bottom:12px'>"
        f"{hanh_dong} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<span style='font-size:14px;font-weight:normal'>{row.get('trang_thai','')}"
        f" &nbsp; {row.get('phan_khuc','')} &nbsp; {row.get('xu_huong','')}</span>"
        f"</div>",
        unsafe_allow_html=True,
    )

    # ── KPI Cards ──
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Dự báo 28 ngày tới",  f"{row.get('forecast_28d_validation', 0):,.1f} units")
    c2.metric("Dự báo 56 ngày tới",  f"{row.get('forecast_56d_total', 0):,.1f} units")
    c3.metric("Ngày bán (180 ngày)", f"{int(row.get('sale_days_180', 0))} ngày")
    c4.metric("Lần bán gần nhất",    f"{int(row.get('days_since_last_sale', 9999))} ngày trước")
    rr = row.get("return_ratio", 0)
    c5.metric("Tỷ lệ hoàn hàng",     f"{rr*100:.1f}%")

    c6, c7, c8 = st.columns(3)
    c6.metric("Doanh thu lịch sử",
              f"{row.get('revenue', 0)/1e6:,.0f} triệu đồng")
    c7.metric("Lợi nhuận lịch sử",
              f"{max(row.get('profit', 0), 0)/1e6:,.0f} triệu đồng")
    c8.metric("Tổng đã bán (net)",
              f"{row.get('net_qty', 0):,.0f} units")

    st.divider()

    # ── Biểu đồ lịch sử + dự báo ──
    col_chart, col_action = st.columns([3, 1])

    with col_chart:
        st.markdown("**Lịch sử bán hàng & Dự báo 56 ngày tới**")
        train = load_train_daily()
        fc_df = load_forecast_file()
        fc    = get_sku_forecast_series(fc_df, selected)

        fig = go.Figure()

        if train is not None:
            hist = (
                train[
                    (train["ItemCode"] == selected)
                    & (train["Quantity"] > 0)
                    & (train["Date"] >= pd.Timestamp("2024-01-01"))
                ]
                .groupby("Date")["Quantity"].sum()
                .reset_index()
            )
            if not hist.empty:
                fig.add_scatter(
                    x=hist["Date"], y=hist["Quantity"],
                    mode="lines+markers", name="Số lượng bán thực",
                    line=dict(color=C_BLUE, width=1.5),
                    marker=dict(size=3),
                    hovertemplate="%{x|%d/%m/%Y}: %{y:,.0f} units<extra></extra>",
                )
            else:
                st.caption("Không có lịch sử bán gần đây cho SKU này.")

        if not fc.empty:
            fig.add_scatter(
                x=fc.index, y=fc.values,
                mode="lines+markers", name="Dự báo",
                line=dict(color=C_RED, width=2, dash="dot"),
                marker=dict(size=4),
                hovertemplate="%{x|%d/%m/%Y}: %{y:,.1f} units (dự báo)<extra></extra>",
            )
            fig.add_vrect(
                x0=fc.index[0], x1=fc.index[-1],
                fillcolor="rgba(211,47,47,0.05)", line_width=0,
                annotation_text="Kỳ dự báo",
                annotation_position="top left",
                annotation_font_size=11,
            )

        fig.update_layout(
            template="plotly_white", height=300,
            xaxis_title="Ngày", yaxis_title="Số lượng (units)",
            legend=dict(orientation="h", yanchor="bottom", y=1.02),
            margin=dict(l=0, r=0, t=8, b=0),
        )
        st.plotly_chart(fig, use_container_width=True)

        # Dự báo theo tuần
        if not fc.empty:
            st.markdown("**Dự báo chi tiết theo tuần**")
            weekly = fc.resample("W").sum().reset_index()
            weekly.columns = ["Tuần bắt đầu", "Dự báo (units)"]
            weekly["Tuần bắt đầu"] = weekly["Tuần bắt đầu"].dt.strftime("%d/%m/%Y")
            weekly["Dự báo (units)"] = weekly["Dự báo (units)"].map("{:,.1f}".format)
            st.dataframe(weekly, hide_index=True, use_container_width=True)

    with col_action:
        st.markdown("**Đề xuất hành động**")
        st.markdown(
            f"<div style='padding:16px;background:{bg_color};border-radius:8px;"
            f"border-left:4px solid {C_BLUE};font-size:15px;font-weight:bold;"
            f"margin-bottom:12px'>{hanh_dong}</div>",
            unsafe_allow_html=True,
        )

        # Lý do đơn giản
        reasons = str(row.get("reason_codes", "")).split(" | ")
        vn_reasons = []
        for r in reasons:
            r = r.strip()
            if not r or r == "Normal SKU":
                continue
            if "sale days in last 180" in r:
                n = r.split("Only ")[-1].split(" sale")[0]
                vn_reasons.append(f"Chỉ bán {n} ngày trong 180 ngày qua")
            elif "Last sale was" in r:
                n = r.split("was ")[-1].split(" days")[0]
                vn_reasons.append(f"Lần bán cuối cách {n} ngày")
            elif "High return ratio" in r:
                pct = r.split(": ")[-1]
                vn_reasons.append(f"Tỷ lệ hoàn hàng cao: {pct}")
            elif "Dormant" in r:
                vn_reasons.append("Không có giao dịch trong 180 ngày qua")
            elif "Frequent recent sales" in r:
                vn_reasons.append("Bán hàng thường xuyên gần đây")
            elif "High profit" in r:
                vn_reasons.append("SKU lợi nhuận cao (top 10%)")
            elif "non-zero forecast" in r:
                vn_reasons.append("SKU không còn bán nhưng hệ thống vẫn dự báo nhu cầu")
            elif "Stable model" in r:
                vn_reasons.append("Dự báo ổn định, độ tin cậy cao")
            elif "disagreement" in r.lower():
                vn_reasons.append("Mức độ dự báo chưa ổn định — cần xác nhận")

        if vn_reasons:
            st.markdown("**Lý do:**")
            for vr in vn_reasons:
                st.markdown(f"• {vr}")
        else:
            st.markdown("• SKU hoạt động bình thường")

        st.divider()
        st.markdown("**Tính toán nhập hàng**")
        afpd      = float(row.get("avg_forecast_per_day", 0))
        est_stock = afpd * cfg["cov"]
        lt_need   = afpd * cfg["lt"]
        order_qty = max(0.0, lt_need + afpd * cfg["ss"] - est_stock)

        st.markdown(f"- Tồn kho ước tính: **{est_stock:,.1f}**")
        st.markdown(f"- Cần trong lead time: **{lt_need:,.1f}**")
        if order_qty > 0:
            st.markdown(
                f"<div style='padding:10px;background:{C_BG_RED};border-radius:6px;"
                f"font-weight:bold'>📦 Đặt thêm: {order_qty:,.0f} units</div>",
                unsafe_allow_html=True,
            )
        else:
            st.markdown(
                f"<div style='padding:10px;background:{C_BG_GREEN};border-radius:6px;'>"
                f"✅ Chưa cần đặt hàng</div>",
                unsafe_allow_html=True,
            )


# ─── Tab 5: Mô phỏng nhập hàng ───────────────────────────────────────────────

def tab_mo_phong(df: pd.DataFrame, cfg: dict) -> None:
    st.caption(
        "ℹ️ Công cụ này giúp bạn mô phỏng quyết định nhập hàng dựa trên dự báo nhu cầu. "
        "Nhập tồn kho thực tế của bạn để tính toán chính xác hơn."
    )

    all_skus = sorted(df["ItemCode"].tolist())
    default  = 0
    if cfg["search"]:
        hits = [i for i, s in enumerate(all_skus) if cfg["search"].strip().upper() in s]
        if hits:
            default = hits[0]

    col_in, col_out = st.columns([1, 2])

    with col_in:
        st.markdown("**⚙️ Thông số đầu vào**")
        sim_sku = st.selectbox("Mã SKU", all_skus, index=default, key="sim_sku")
        row     = df[df["ItemCode"] == sim_sku].iloc[0]
        afpd    = float(row.get("avg_forecast_per_day", 0))

        current_stock = st.number_input(
            "Tồn kho thực tế hiện tại (units)",
            min_value=0.0,
            value=max(0.0, round(afpd * cfg["cov"], 0)),
            step=1.0,
            help="Nhập số lượng tồn kho thực tế. Mặc định là ước tính từ cài đặt sidebar.",
        )
        lt_days = st.slider("Thời gian chờ hàng (ngày)", 1, 60, cfg["lt"], key="sim_lt")
        ss_days = st.slider("Dự phòng an toàn (ngày)",   0, 30, cfg["ss"], key="sim_ss")
        plan_period = st.selectbox("Kỳ lên kế hoạch",
                                   ["28 ngày (1 tháng)", "56 ngày (2 tháng)"])
        plan_days = 28 if "28" in plan_period else 56

        forecast_28 = float(row.get("forecast_28d_validation", 0))
        forecast_56 = float(row.get("forecast_56d_total", 0))
        forecast_plan = forecast_28 if plan_days == 28 else forecast_56

    with col_out:
        st.markdown("**📊 Kết quả tính toán**")

        lt_demand = afpd * lt_days
        ss_demand = afpd * ss_days
        proj      = current_stock - lt_demand
        stockout  = proj < ss_demand
        reorder   = max(0.0, lt_demand + ss_demand - current_stock)

        c1, c2, c3 = st.columns(3)
        c1.metric("Tồn kho hiện tại",           f"{current_stock:,.0f} units")
        c2.metric(f"Nhu cầu trong {lt_days} ngày", f"{lt_demand:,.1f} units")
        c3.metric("Dự phòng tối thiểu",          f"{ss_demand:,.1f} units")

        c4, c5 = st.columns(2)
        c4.metric(
            "Tồn kho sau khi đặt hàng về",
            f"{proj:,.1f} units",
            delta="⚠️ Sẽ thiếu hàng" if stockout else "✅ Đủ hàng",
            delta_color="inverse" if stockout else "normal",
        )
        c5.metric(
            f"Dự báo nhu cầu {plan_days} ngày",
            f"{forecast_plan:,.1f} units",
        )

        if reorder > 0:
            st.error(
                f"🚨 **Khuyến nghị đặt hàng: {reorder:,.0f} units**  \n"
                f"Tồn kho hiện tại không đủ để đáp ứng nhu cầu trong thời gian chờ hàng."
            )
        else:
            st.success(
                f"✅ **Chưa cần đặt hàng ngay.**  \n"
                f"Tồn kho hiện tại đủ đáp ứng nhu cầu trong {lt_days} ngày tới."
            )

        # Biểu đồ tồn kho dự kiến
        fc_df = load_forecast_file()
        fc    = get_sku_forecast_series(fc_df, sim_sku)

        if not fc.empty:
            cum_demand    = fc.cumsum()
            stock_project = (current_stock - cum_demand).clip(lower=0)
            reorder_line  = pd.Series(ss_demand, index=fc.index)

            fig = go.Figure()
            fig.add_scatter(
                x=fc.index, y=stock_project.values,
                mode="lines", name="Tồn kho dự kiến",
                fill="tozeroy", fillcolor="rgba(21,101,192,0.10)",
                line=dict(color=C_BLUE, width=2),
                hovertemplate="%{x|%d/%m/%Y}: %{y:,.1f} units<extra></extra>",
            )
            fig.add_scatter(
                x=fc.index, y=reorder_line.values,
                mode="lines", name="Ngưỡng dự phòng",
                line=dict(color=C_RED, dash="dash", width=1.5),
            )
            if stockout:
                # Tìm điểm hết hàng
                zero_cross = (current_stock - cum_demand)
                hit = zero_cross[zero_cross < ss_demand]
                if not hit.empty:
                    fig.add_vline(
                        x=hit.index[0].timestamp() * 1000,
                        line_color=C_RED, line_dash="dot",
                        annotation_text="⚠️ Dự kiến hết hàng",
                        annotation_font_color=C_RED,
                    )

            fig.update_layout(
                template="plotly_white", height=250,
                xaxis_title="Ngày", yaxis_title="Tồn kho (units)",
                legend=dict(orientation="h", yanchor="bottom", y=1.02),
                margin=dict(l=0, r=0, t=8, b=0),
            )
            st.plotly_chart(fig, use_container_width=True)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    st.markdown(
        "<h2 style='margin:0;color:#1565C0'>🚗 Quản lý Dự báo Nhu cầu Phụ tùng Ô tô</h2>"
        "<p style='color:#555;margin:2px 0 0 0;font-size:14px'>"
        "Theo dõi nhu cầu, cảnh báo tồn kho và kế hoạch nhập hàng tự động</p>",
        unsafe_allow_html=True,
    )
    st.divider()

    cfg = render_sidebar()

    # Load & build
    raw = load_sku()
    if raw is None:
        st.error("⚠️ Chưa có dữ liệu. Vui lòng chạy lệnh: `python prepare_data.py`")
        st.stop()

    df = build_display_df(raw, cfg["lt"], cfg["ss"], cfg["cov"])

    # Tabs
    t1, t2, t3, t4, t5 = st.tabs([
        "📊 Tổng quan",
        "🚨 Cảnh báo & Hành động",
        "📋 Danh sách SKU",
        "🔍 Chi tiết SKU",
        "📦 Mô phỏng nhập hàng",
    ])

    with t1: tab_tong_quan(df, cfg)
    with t2: tab_canh_bao(df, cfg)
    with t3: tab_danh_sach(df, cfg)
    with t4: tab_chi_tiet(df, cfg)
    with t5: tab_mo_phong(df, cfg)

    st.divider()
    st.caption(
        "Dữ liệu dự báo cập nhật theo chu kỳ. "
        "Tồn kho mô phỏng dựa trên tham số cài đặt — "
        "kết nối ERP/WMS để có số liệu chính xác hơn."
    )


if __name__ == "__main__":
    main()
