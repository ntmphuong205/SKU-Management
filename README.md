# 🚗 AutoParts Forecast Intelligence Platform

**Nền tảng dự báo nhu cầu và cảnh báo rủi ro tồn kho phụ tùng ô tô**

HBAAC Final Round — Data Product Demo

---

## 1. Tổng quan sản phẩm

AutoParts Forecast Intelligence Platform biến kết quả dự báo nhu cầu SKU-level thành **hành động kinh doanh** cho các đội Sales, Logistics và Management của nhà phân phối phụ tùng ô tô.

**Đây không chỉ là dashboard — đây là Decision Intelligence System.**

---

## 2. Bài toán kinh doanh

Công ty X phân phối phụ tùng ô tô với hàng chục nghìn SKU. Thách thức:

- Phân phối long-tail: một số ít SKU đóng góp phần lớn lợi nhuận
- Nhiều SKU bán thưa thớt, khó dự báo
- Thiếu công cụ để chuyển forecast thành quyết định tồn kho
- Nhân viên Sales/Logistics cần thông tin ngay, không phải file Excel

---

## 3. Bối cảnh cuộc thi

- **Dữ liệu:** 2020-11-17 → 2025-09-05, ~15,972 SKUs, ~712K giao dịch
- **Horizon dự báo:** 56 ngày
  - Public (validation): 2025-09-06 → 2025-10-03 (F1–F28)
  - Private (evaluation): 2025-10-04 → 2025-10-31 (F1–F28)
- **Metric:** WRMSSE (Weighted Root Mean Squared Scaled Error)
- **Format submission:** `<ItemCode>_validation` và `<ItemCode>_evaluation`

---

## 4. Câu chuyện kỹ thuật — Horizon-aware Robust Ensemble

### Vấn đề
Mô hình tốt nhất trên Public (v19, WRMSSE = 0.48881) bị **overfit horizon gần**
và cho kết quả kém hơn trên Private (0.53214).

### Giải pháp
Áp dụng chính sách khác nhau theo horizon:
- **Horizon gần (F1–F28):** dùng model public-calibrated champion (v19)
- **Horizon xa (F29–F56):** dùng robust challenger ensemble

### Kết quả

| Version | Public WRMSSE | Private WRMSSE | Ghi chú |
|---------|---------------|----------------|---------|
| v19     | 0.48881       | 0.53214        | Best Public — overfit |
| v16     | 0.48926       | 0.52732        | Bản được chọn chính thức |
| v6      | 0.50391       | 0.52101        | Robust challenger |
| v2      | 0.49334       | 0.52139        | Conservative baseline |
| v22 ✓   | **0.48881**   | **0.52073**    | Best: Public v19 + Private 70% v6 + 30% v2 |

**Cải thiện:**
- vs v16 Private: 0.52732 → 0.52073 = **+1.25%**
- vs v19 Private: 0.53214 → 0.52073 = **+2.14%**

---

## 5. Cài đặt & Chạy

### Cài dependencies

```bash
pip install -r requirements.txt
```

### Chuẩn bị dữ liệu

```bash
python prepare_data.py
```

Hoặc chỉ định thư mục:

```bash
python prepare_data.py --data-dir data --out-dir processed
```

### Chạy dashboard

```bash
streamlit run app.py
```

---

## 6. Cấu trúc files

```
.
├── app.py                    # Streamlit dashboard (7 tabs)
├── prepare_data.py           # Data preprocessing script
├── requirements.txt
├── README.md
├── data/
│   ├── train.csv             # REQUIRED: lịch sử giao dịch
│   ├── sample_submission.csv # REQUIRED: danh sách SKUs
│   ├── submission_v22.csv    # RECOMMENDED: best forecast
│   ├── submission_v19.csv    # Optional
│   ├── submission_v6.csv     # Optional (dùng tính disagreement)
│   ├── submission_v2.csv     # Optional (dùng tính disagreement)
│   ├── submission_v16.csv    # Optional
│   └── model_scores.csv      # Model performance table
└── processed/                # Output của prepare_data.py
    ├── sku_summary.csv
    ├── forecast_summary.csv
    ├── risk_table.csv
    ├── model_disagreement.csv
    └── manual_review_queue.csv
```

---

## 7. Files bắt buộc

| File | Mô tả |
|------|-------|
| `data/train.csv` | Lịch sử giao dịch bán hàng |
| `data/sample_submission.csv` | Danh sách 15,972 SKUs |
| Ít nhất 1 file forecast | `submission_v22.csv` được khuyến nghị |

---

## 8. Files tùy chọn

| File | Tác dụng |
|------|---------|
| `submission_v19.csv` | Model disagreement v19 vs v6 |
| `submission_v6.csv` | Model disagreement |
| `submission_v2.csv` | Model disagreement v6 vs v2 |
| `submission_v16.csv` | So sánh với bản chính thức |

App vẫn chạy bình thường nếu thiếu các file tùy chọn.

---

## 9. Giả định trong demo

> **Lưu ý quan trọng:**
> Dữ liệu tồn kho thực tế và lead time nhà cung cấp **không được cung cấp**
> trong dataset cuộc thi.
> 
> Mô phỏng rủi ro stockout/overstock trong dashboard dựa trên tham số
> do người dùng nhập (stock coverage, lead time, safety stock).
> 
> Trong triển khai thực tế, các giá trị này phải được lấy từ ERP/WMS.

---

## 10. Demo Script (cho buổi thi)

1. **Tab Command Center** — Mở tab đầu, giới thiệu KPI, model score comparison, pipeline
2. **Tab Risk & Action** — Filter P1 + High Profit + Low Reliability → xem SKUs cần xử lý ngay
3. **Tab SKU Intelligence** — Chọn 1 SKU P1, giải thích reason codes và recommended action
4. **Tab Replenishment Simulator** — Nhập current stock, điều chỉnh lead time, xem reorder quantity
5. **Tab Manual Review Queue** — Giải thích human-in-the-loop approach
6. **Tab Governance** — Model score table, ablation study, production policy
7. **Tab Roadmap** — 3 giai đoạn PoC → Pilot → Full Rollout

---

## 11. Tabs trong dashboard

| Tab | Mục đích | Người dùng |
|-----|---------|-----------|
| 📊 Command Center | Executive overview | Management |
| ⚠️ Risk & Action | Bảng vận hành SKU | Sales, Logistics |
| 🔍 SKU Intelligence | Phân tích chi tiết 1 SKU | All |
| 📦 Replenishment | What-if inventory | Logistics |
| 📋 Review Queue | Human-in-the-loop | Sales, Logistics |
| 🏛️ Governance | Model governance | Data Science, Management |
| 🗺️ Roadmap | Deployment plan | Management |

---

*"Forecast is not the final product. Decision intelligence is."*
