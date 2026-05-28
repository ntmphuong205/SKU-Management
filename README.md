# AutoParts FIP — Nền tảng Dự báo Nhu cầu

**Nền tảng hỗ trợ ra quyết định vận hành dành cho doanh nghiệp phân phối phụ tùng ô tô**

HBAAC Final Round — Data Product Demo

---

## Tổng quan

AutoParts FIP chuyển hóa kết quả dự báo nhu cầu SKU-level thành **hành động vận hành cụ thể** cho ba bộ phận: Kinh doanh, Logistics và Quản lý. Hệ thống không chỉ trả lời *"sản phẩm sẽ bán bao nhiêu?"* mà còn trả lời *"nên làm gì tiếp theo?"*

---

## Kiến trúc hệ thống

```
Frontend (Next.js)          Backend (FastAPI)
┌─────────────────┐         ┌──────────────────┐
│  Dashboard      │         │  Ingestion API   │
│  Risk Monitor   │ ──────► │  APScheduler     │
│  AI Chatbot     │         │  SQLite (WAL)    │
│  Simulator      │         │  Drift Detection │
└─────────────────┘         └──────────────────┘
        │
        ▼
   Gemini API / VnExpress RSS
```

| Tầng | Công nghệ |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4 |
| Biểu đồ | Recharts |
| Backend | FastAPI, APScheduler, SQLite |
| AI | Google Gemini API |
| Dữ liệu ngoại vi | VnExpress RSS |
| Triển khai | Vercel (frontend) + Railway (backend) |

---

## Phân quyền người dùng

| Vai trò | Chức năng |
|---|---|
| **Kinh doanh** | Dashboard bán hàng, dự báo doanh số, cảnh báo thiếu hàng (chỉ xem + gửi đề xuất nhập), trợ lý AI |
| **Logistics** | Giám sát rủi ro toàn hệ thống, danh sách tồn kho, mô phỏng tồn kho, trợ lý AI |
| **Quản lý** | Toàn bộ hệ thống — quản trị, phê duyệt đề xuất, xuất báo cáo, phát hiện drift |

---

## Chức năng chính

### Dashboard tổng quan
KPI theo vai trò: tổng dự báo 28/56 ngày, SKU rủi ro, biên lợi nhuận, phân bổ nhu cầu và độ tin cậy mô hình. Tích hợp tín hiệu thị trường thời gian thực từ VnExpress RSS, tự động làm mới mỗi 10 phút.

### Giám sát rủi ro tồn kho
Phân loại SKU thành 4 nhóm: **Nhập hàng ngay / Cần xem xét / Kiểm tra hoàn hàng / Hàng tồn chậm** — dựa trên dự báo, tồn kho và thời gian chờ nhập.

### Luồng đề xuất nhập hàng
Kinh doanh gửi đề xuất → Quản lý phê duyệt/từ chối kèm ghi chú → kết quả hiển thị ngay về phía Kinh doanh.

### Phân tích dự báo chi tiết SKU
Dự báo F1–F28 và F29–F56, biểu đồ theo tuần, số lượng cần đặt thêm và **giải thích AI tự động** bằng tiếng Việt cho từng SKU.

### Mô phỏng tồn kho
Điều chỉnh hệ số nhu cầu, tồn kho hiện tại, thời gian chờ, dự phòng an toàn và mức dịch vụ (95%/90%/80%). Hệ thống tính khuyến nghị đặt hàng và vẽ biểu đồ dự kiến tồn kho 56 ngày.

### Quản trị hệ thống
Sức khỏe hệ thống, phân bổ độ tin cậy mô hình, phê duyệt đề xuất nhập hàng, xuất 3 loại báo cáo CSV.

### Trợ lý AI
Hỏi đáp ngôn ngữ tự nhiên bằng tiếng Việt — trả lời kèm biểu đồ minh họa khi cần.

### Auto Data Ingestion
Backend tự động quét thư mục `incoming/` mỗi 5 phút, kiểm tra và nạp CSV vào SQLite, chống trùng lặp, ghi log và phân loại file lỗi.

### Phát hiện Concept Drift
So sánh nhu cầu trung bình 30 ngày gần nhất với 30 ngày trước. SKU thay đổi >60% → drift mạnh, 30–60% → drift vừa. Hiển thị tại Governance Dashboard.

---

## Cài đặt & Chạy

### 1. Frontend

```bash
cd dashboard
npm install
npm run dev
```

Truy cập: `http://localhost:3000`

### 2. Backend

```bash
cd backend
pip3 install -r requirements.txt
python3 scheduler.py
```

API chạy tại: `http://localhost:8000`

### 3. Tạo dữ liệu mẫu (tuỳ chọn)

```bash
cd backend
python3 generate_sample.py --files 3 --rows 500
```

---

## Cấu trúc thư mục

```
HBAC/
├── dashboard/               # Next.js frontend
│   ├── app/
│   │   ├── page.tsx         # Dashboard tổng quan
│   │   ├── canh-bao/        # Giám sát rủi ro
│   │   ├── danh-sach/       # Danh sách SKU
│   │   ├── chi-tiet/        # Phân tích chi tiết SKU
│   │   ├── mo-phong/        # Mô phỏng tồn kho
│   │   ├── governance/      # Quản trị hệ thống
│   │   ├── tro-ly/          # Trợ lý AI
│   │   └── api/             # Next.js API routes (proxy)
│   ├── components/          # Sidebar, Topbar, StatusBadge...
│   ├── lib/                 # roles, proposals, types
│   └── context/             # RoleContext
│
├── backend/                 # Python backend
│   ├── api/main.py          # FastAPI app + endpoints
│   ├── ingestion/           # Validator + Pipeline
│   ├── db/                  # SQLite schema
│   ├── scheduler.py         # Entry point
│   ├── generate_sample.py   # Tạo CSV mẫu
│   └── data/
│       ├── incoming/        # Thả CSV vào đây
│       ├── processed/       # File đã xử lý thành công
│       └── failed/          # File lỗi
│
├── pipeline/                # Scripts huấn luyện mô hình
└── archive/                 # Ensemble blending scripts
```

---

## Biến môi trường

Tạo file `dashboard/.env.local`:

```
GEMINI_API_KEY=your_key_here
INGESTION_API_URL=https://your-railway-url.railway.app
```

---

## Bối cảnh cuộc thi

- **Dữ liệu:** 2020-11-17 → 2025-09-05, ~15.972 SKU, ~712K giao dịch
- **Horizon dự báo:** 56 ngày (F1–F56)
- **Metric:** WRMSSE

| Phiên bản | Public WRMSSE | Private WRMSSE |
|---|---|---|
| v19 (Best Public) | 0.48881 | 0.53214 |
| v22 (Best Overall) | **0.48881** | **0.52073** |

Chiến lược: Public horizon (F1–F28) dùng model champion (v19); Private horizon (F29–F56) dùng robust ensemble (70% v6 + 30% v2).
