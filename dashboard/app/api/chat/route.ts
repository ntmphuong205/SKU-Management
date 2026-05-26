import { NextRequest, NextResponse } from 'next/server'
import { getSkuData, getKpiSummary, enrichSku } from '@/lib/data'

const GEMINI_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function buildContext(message: string) {
  const skus = getSkuData()
  const kpis = getKpiSummary(skus)
  const lower = message.toLowerCase()
  let ctx = ''

  // ── Tổng quan KPI ──
  ctx += `\n[TỔNG QUAN HỆ THỐNG]\n`
  ctx += `Tổng SKU: ${kpis.total_skus.toLocaleString()}\n`
  ctx += `SKU đang bán: ${kpis.active_skus.toLocaleString()}\n`
  ctx += `SKU không còn bán (dormant): ${kpis.dormant_skus.toLocaleString()}\n`
  ctx += `Tổng nhu cầu 28 ngày tới: ${Math.round(kpis.total_forecast_28d).toLocaleString()} units\n`
  ctx += `Tổng nhu cầu 56 ngày tới: ${Math.round(kpis.total_forecast_56d).toLocaleString()} units\n`
  ctx += `SKU nguy cơ hết hàng: ${kpis.stockout_risk_skus}\n`
  ctx += `SKU cần nhập hàng ngay: ${kpis.action_urgent}\n`
  ctx += `SKU tồn kho dư: ${kpis.overstock_skus}\n`
  ctx += `SKU cần xem xét với Sales: ${kpis.action_review}\n`
  ctx += `Tổng doanh thu lịch sử: ${(kpis.total_revenue / 1e9).toFixed(1)} tỷ đồng\n`
  ctx += `Tổng lợi nhuận lịch sử: ${(kpis.total_profit / 1e9).toFixed(1)} tỷ đồng\n`
  ctx += `SKU lợi nhuận cao (top 10%): ${kpis.high_profit_skus}\n`

  // ── SKU cụ thể được hỏi ──
  const skuCodes = [...new Set((message.match(/SKU-\d{4,6}/gi) ?? []).map(s => s.toUpperCase()))]
  if (skuCodes.length > 0) {
    ctx += `\n[CHI TIẾT SKU ĐƯỢC HỎI]\n`
    for (const code of skuCodes.slice(0, 3)) {
      const found = skus.find(s => s.ItemCode.toUpperCase() === code)
      if (!found) { ctx += `${code}: Không tìm thấy trong hệ thống\n`; continue }
      const e = enrichSku(found, 14, 7, 21)
      ctx += `
SKU: ${e.ItemCode}
  Phân khúc lợi nhuận: ${e.profit_segment}
  Xu hướng bán: ${e.demand_class}
  Doanh thu lịch sử: ${(e.revenue / 1e6).toFixed(0)} triệu đồng
  Lợi nhuận: ${(e.profit / 1e6).toFixed(0)} triệu đồng
  Ngày bán trong 180 ngày gần nhất: ${e.sale_days_180} ngày
  Giao dịch cuối cách đây: ${e.days_since_last_sale > 9000 ? 'Chưa có dữ liệu' : e.days_since_last_sale + ' ngày'}
  Tỷ lệ hoàn hàng: ${(e.return_ratio * 100).toFixed(1)}%
  Dự báo 28 ngày tới: ${e.forecast_28d_validation.toFixed(0)} units
  Dự báo 28 ngày tiếp: ${e.forecast_28d_evaluation.toFixed(0)} units
  Tổng dự báo 56 ngày: ${e.forecast_56d_total.toFixed(0)} units
  Nhu cầu bình quân/ngày: ${e.avg_forecast_per_day.toFixed(2)} units
  Tồn kho ước tính: ${e._stock.toFixed(0)} units
  Nhu cầu trong lead time (14 ngày): ${e._ltDemand.toFixed(0)} units
  Trạng thái tồn kho: ${e._status === 'stockout' ? 'Nguy cơ hết hàng' : e._status === 'overstock' ? 'Tồn kho dư' : 'Bình thường'}
  Số lượng cần đặt thêm: ${e._reorder > 0 ? e._reorder.toFixed(0) + ' units' : 'Chưa cần đặt'}
  Hành động đề xuất: ${e.recommended_action}
  Lý do: ${e.reason_codes}
`
    }
  }

  // ── Top SKU cần nhập ngay ──
  const needsUrgent = lower.includes('hết hàng') || lower.includes('nhập hàng') ||
    lower.includes('khẩn') || lower.includes('ưu tiên') || lower.includes('cần đặt') ||
    lower.includes('thiếu hàng') || lower.includes('cảnh báo')

  if (needsUrgent || skuCodes.length === 0) {
    const urgent = skus
      .map(s => enrichSku(s, 14, 7, 21))
      .filter(s => s.recommended_action === 'Prioritize replenishment')
      .sort((a, b) => (b.profit || 0) - (a.profit || 0))
      .slice(0, 8)
    if (urgent.length > 0) {
      ctx += `\n[TOP SKU CẦN NHẬP HÀNG NGAY (sắp xếp theo lợi nhuận)]\n`
      urgent.forEach((s, i) => {
        ctx += `${i + 1}. ${s.ItemCode} — Lợi nhuận: ${(s.profit / 1e6).toFixed(0)}M đ | Cần đặt: ${s._reorder.toFixed(0)} units | ${s.profit_segment}\n`
      })
    }
  }

  // ── Top nhu cầu cao nhất ──
  const needsTop = lower.includes('top') || lower.includes('nhiều nhất') ||
    lower.includes('cao nhất') || lower.includes('nhu cầu lớn') || lower.includes('bán chạy')

  if (needsTop) {
    const top = [...skus]
      .sort((a, b) => b.forecast_56d_total - a.forecast_56d_total)
      .slice(0, 10)
    ctx += `\n[TOP 10 SKU NHU CẦU CAO NHẤT (56 ngày)]\n`
    top.forEach((s, i) => {
      ctx += `${i + 1}. ${s.ItemCode} — ${s.forecast_56d_total.toFixed(0)} units | ${s.profit_segment} | ${s.demand_class}\n`
    })
  }

  // ── Tồn kho dư ──
  if (lower.includes('tồn kho dư') || lower.includes('over') || lower.includes('dư hàng') || lower.includes('ứ đọng')) {
    const over = skus
      .map(s => enrichSku(s, 14, 7, 21))
      .filter(s => s._overstock)
      .sort((a, b) => (b.profit || 0) - (a.profit || 0))
      .slice(0, 8)
    ctx += `\n[TOP SKU TỒN KHO DƯ]\n`
    over.forEach((s, i) => {
      ctx += `${i + 1}. ${s.ItemCode} — Tồn ước tính: ${s._stock.toFixed(0)} units | Dự báo 56 ngày: ${s.forecast_56d_total.toFixed(0)} units | ${s.profit_segment}\n`
    })
  }

  // ── Lợi nhuận cao ──
  if (lower.includes('lợi nhuận') || lower.includes('high profit') || lower.includes('doanh thu')) {
    const hp = skus
      .filter(s => s.profit_segment === 'High Profit')
      .sort((a, b) => (b.profit || 0) - (a.profit || 0))
      .slice(0, 8)
    ctx += `\n[TOP SKU LỢI NHUẬN CAO]\n`
    hp.forEach((s, i) => {
      ctx += `${i + 1}. ${s.ItemCode} — Lợi nhuận: ${(s.profit / 1e6).toFixed(0)}M đ | Doanh thu: ${(s.revenue / 1e6).toFixed(0)}M đ | ${s.demand_class}\n`
    })
  }

  return ctx
}

export async function POST(req: NextRequest) {
  if (!GEMINI_KEY) {
    return NextResponse.json({
      reply: '⚠️ Chưa cấu hình GEMINI_API_KEY. Vui lòng thêm vào biến môi trường (.env.local hoặc Vercel Settings).',
    })
  }

  const { message, history = [] }: { message: string; history: ChatMessage[] } = await req.json()
  if (!message?.trim()) return NextResponse.json({ reply: '' })

  const contextData = buildContext(message)

  const systemPrompt = `Bạn là trợ lý phân tích kinh doanh AI cho hệ thống quản lý phụ tùng ô tô.
Nhiệm vụ: Giúp nhân viên kinh doanh và logistics truy vấn dữ liệu dự báo nhu cầu và tồn kho một cách nhanh chóng.

NGUYÊN TẮC TRẢ LỜI:
- Trả lời BẰNG TIẾNG VIỆT, ngắn gọn và có thể ra quyết định ngay
- Đưa ra khuyến nghị cụ thể, KHÔNG chỉ mô tả lại số liệu
- Dùng emoji để dễ đọc: 🔴 khẩn cấp, 🟡 cần xem xét, 🟢 ổn định, 📦 tồn kho, 📈 tăng, 📉 giảm
- Khi nhắc SKU, luôn kèm theo tên mã và số liệu quan trọng nhất
- Làm tròn số cho dễ đọc (triệu đồng, không dùng số quá dài)
- Nếu không có dữ liệu → nói rõ, đừng bịa

MÔ TẢ HỆ THỐNG:
Đây là hệ thống dự báo nhu cầu phụ tùng ô tô với 15,972 SKU, dữ liệu lịch sử 2020–2025.
Dự báo horizon: 56 ngày tới (F1–F56).
Tồn kho mô phỏng: assumed_stock = avg_forecast_per_day × 21 ngày (lead time mặc định 14 ngày, safety stock 7 ngày).

DỮ LIỆU THỰC TẾ (cập nhật real-time):
${contextData}`

  const contents = [
    ...(history as ChatMessage[]).slice(-8).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Gemini error:', data)
      return NextResponse.json({ reply: `Lỗi API (${res.status}): ${data?.error?.message ?? 'Unknown'}` })
    }

    const reply: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Xin lỗi, không nhận được phản hồi từ AI.'

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ reply: '❌ Lỗi kết nối đến AI. Vui lòng thử lại.' })
  }
}
