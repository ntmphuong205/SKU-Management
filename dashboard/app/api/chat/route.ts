import { NextRequest, NextResponse } from 'next/server'
import { getSkuData, getKpiSummary, enrichSku } from '@/lib/data'

export const maxDuration = 60

// ── Response cache ────────────────────────────────────────────
interface CacheEntry { reply: string; chartData: ChartPayload | null; expiresAt: number }
const responseCache = new Map<string, CacheEntry>()
const CACHE_TTL = 10 * 60 * 1000
const CACHE_MAX = 50

function cacheKey(msg: string) { return msg.toLowerCase().trim().replace(/\s+/g, ' ') }

function getCached(msg: string): CacheEntry | null {
  const e = responseCache.get(cacheKey(msg))
  if (!e) return null
  if (Date.now() > e.expiresAt) { responseCache.delete(cacheKey(msg)); return null }
  return e
}

function setCache(msg: string, reply: string, chartData: ChartPayload | null) {
  if (responseCache.size >= CACHE_MAX) {
    const first = responseCache.keys().next().value
    if (first) responseCache.delete(first)
  }
  responseCache.set(cacheKey(msg), { reply, chartData, expiresAt: Date.now() + CACHE_TTL })
}


const MIMO_KEY = process.env.MIMO_API_KEY
const MIMO_BASE = 'https://api.xiaomimimo.com/v1'
const MIMO_MODEL = 'mimo-v2.5-pro'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChartItem { label: string; value: number; color?: string }
export interface ChartPayload { title: string; unit: string; items: ChartItem[] }

function buildChartData(message: string, skus: ReturnType<typeof getSkuData>): ChartPayload | null {
  const lower = message.toLowerCase()

  // ── Top nhu cầu cao nhất ──────────────────────────────────────
  if (lower.includes('top') || lower.includes('nhiều nhất') ||
      lower.includes('cao nhất') || lower.includes('bán chạy') ||
      lower.includes('nhu cầu lớn')) {
    const top = [...skus]
      .sort((a, b) => b.forecast_56d_total - a.forecast_56d_total)
      .slice(0, 10)
    return {
      title: 'Top 10 SKU — Nhu cầu cao nhất (56 ngày)',
      unit: 'units',
      items: top.map(s => ({ label: s.ItemCode, value: Math.round(s.forecast_56d_total) })),
    }
  }

  // ── Nhập hàng ngay ────────────────────────────────────────────
  if (lower.includes('nhập hàng') || lower.includes('hết hàng') ||
      lower.includes('nhập gấp') || lower.includes('ưu tiên') || lower.includes('cần đặt')) {
    const urgent = skus
      .map(s => enrichSku(s, 14, 7, 21))
      .filter(s => s.recommended_action === 'Prioritize replenishment')
      .sort((a, b) => (b.profit || 0) - (a.profit || 0))
      .slice(0, 8)
    return {
      title: 'SKU cần nhập ngay (theo lợi nhuận)',
      unit: 'units cần đặt',
      items: urgent.map(s => ({ label: s.ItemCode, value: Math.round(s._reorder), color: '#ef4444' })),
    }
  }

  // ── Demand spike ──────────────────────────────────────────────
  if (lower.includes('spike') || lower.includes('đột biến') || lower.includes('tăng mạnh')) {
    const spiked = skus
      .filter(s => {
        const hist = s.avg_daily_sales_180 || 0
        const fore = s.avg_forecast_per_day || 0
        return hist > 0 && fore / hist >= 1.5
      })
      .sort((a, b) => {
        const ra = (a.avg_forecast_per_day || 0) / (a.avg_daily_sales_180 || 1)
        const rb = (b.avg_forecast_per_day || 0) / (b.avg_daily_sales_180 || 1)
        return rb - ra
      })
      .slice(0, 8)
    return {
      title: 'SKU Demand Spike — dự báo / lịch sử (×)',
      unit: 'lần',
      items: spiked.map(s => ({
        label: s.ItemCode,
        value: Math.round(((s.avg_forecast_per_day || 0) / (s.avg_daily_sales_180 || 1)) * 10) / 10,
        color: '#f97316',
      })),
    }
  }

  // ── Rủi ro cao ────────────────────────────────────────────────
  if (lower.includes('rủi ro') || lower.includes('risk') || lower.includes('khẩn cấp') || lower.includes('p1')) {
    const risky = skus
      .map(s => enrichSku(s, 14, 7, 21))
      .filter(s => s.priority_level === 'P1 — Urgent Review' || s.risk_level === 'High Risk')
      .sort((a, b) => (b.profit || 0) - (a.profit || 0))
      .slice(0, 8)
    return {
      title: 'SKU rủi ro cao — Dự báo 56 ngày',
      unit: 'units',
      items: risky.map(s => ({ label: s.ItemCode, value: Math.round(s.forecast_56d_total), color: '#dc2626' })),
    }
  }

  // ── Tồn kho dư ───────────────────────────────────────────────
  if (lower.includes('tồn kho dư') || lower.includes('dư hàng') ||
      lower.includes('dư thừa') || lower.includes('giải phóng')) {
    const over = skus
      .map(s => enrichSku(s, 14, 7, 21))
      .filter(s => s._overstock)
      .sort((a, b) => b._stock - a._stock)
      .slice(0, 8)
    return {
      title: 'SKU tồn kho dư — Tồn ước tính',
      unit: 'units',
      items: over.map(s => ({ label: s.ItemCode, value: Math.round(s._stock), color: '#0891b2' })),
    }
  }

  // ── Lợi nhuận cao ─────────────────────────────────────────────
  if (lower.includes('lợi nhuận') || lower.includes('high profit')) {
    const hp = skus
      .filter(s => s.profit_segment === 'High Profit')
      .sort((a, b) => (b.profit || 0) - (a.profit || 0))
      .slice(0, 8)
    return {
      title: 'Top SKU lợi nhuận cao',
      unit: 'triệu đ',
      items: hp.map(s => ({ label: s.ItemCode, value: Math.round((s.profit || 0) / 1_000_000), color: '#22c55e' })),
    }
  }

  return null
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
    lower.includes('thiếu hàng') || lower.includes('cảnh báo') || lower.includes('nhập gấp')

  if (needsUrgent || skuCodes.length === 0) {
    const urgent = skus
      .map(s => enrichSku(s, 14, 7, 21))
      .filter(s => s.recommended_action === 'Prioritize replenishment')
      .sort((a, b) => (b.profit || 0) - (a.profit || 0))
      .slice(0, 8)
    if (urgent.length > 0) {
      ctx += `\n[TOP SKU CẦN NHẬP HÀNG NGAY (sắp xếp theo lợi nhuận)]\n`
      urgent.forEach((s, i) => {
        ctx += `${i + 1}. ${s.ItemCode} — Lợi nhuận: ${(s.profit / 1e6).toFixed(0)}M đ | Cần đặt: ${s._reorder.toFixed(0)} units | ${s.profit_segment} | Độ tin cậy: ${s.reliability_tag}\n`
      })
    }
  }

  // ── Rủi ro cao / P1 ──
  const needsRisk = lower.includes('rủi ro') || lower.includes('risk') || lower.includes('nguy hiểm') ||
    lower.includes('p1') || lower.includes('khẩn cấp')

  if (needsRisk) {
    const risky = skus
      .map(s => enrichSku(s, 14, 7, 21))
      .filter(s => s.priority_level === 'P1 — Urgent Review' || s.risk_level === 'High Risk')
      .sort((a, b) => (b.profit || 0) - (a.profit || 0))
      .slice(0, 10)
    ctx += `\n[TOP SKU RỦI RO CAO (P1 / High Risk)]\n`
    risky.forEach((s, i) => {
      ctx += `${i + 1}. ${s.ItemCode} — ${s.risk_level} | ${s.profit_segment} | Độ tin cậy: ${s.reliability_tag} | ${s.recommended_action}\n`
    })
  }

  // ── Forecast Reliability thấp ──
  const needsReliability = lower.includes('reliability') || lower.includes('tin cậy') ||
    lower.includes('không đáng tin') || lower.includes('low reliability') || lower.includes('thiếu lịch sử')

  if (needsReliability) {
    const lowRel = skus
      .filter(s => s.reliability_tag === 'Low Reliability' || s.reliability_tag === 'Insufficient History')
      .filter(s => s.forecast_56d_total > 0)
      .sort((a, b) => b.forecast_56d_total - a.forecast_56d_total)
      .slice(0, 10)
    ctx += `\n[TOP SKU FORECAST RELIABILITY THẤP (có dự báo nhưng kém tin cậy)]\n`
    lowRel.forEach((s, i) => {
      ctx += `${i + 1}. ${s.ItemCode} — ${s.reliability_tag} | Dự báo: ${s.forecast_56d_total.toFixed(0)} units | ${s.demand_class} | Lý do: ${s.reason_codes?.split(' | ')[0]}\n`
    })
  }

  // ── Demand Spike ──
  const needsSpike = lower.includes('spike') || lower.includes('đột biến') ||
    lower.includes('tăng mạnh') || lower.includes('tăng đột') || lower.includes('emerging')

  if (needsSpike) {
    const spiked = skus
      .filter(s => {
        const hist = s.avg_daily_sales_180 || 0
        const fore = s.avg_forecast_per_day || 0
        return hist > 0 && fore / hist >= 1.5
      })
      .sort((a, b) => {
        const ratioA = (a.avg_forecast_per_day || 0) / (a.avg_daily_sales_180 || 1)
        const ratioB = (b.avg_forecast_per_day || 0) / (b.avg_daily_sales_180 || 1)
        return ratioB - ratioA
      })
      .slice(0, 10)
    ctx += `\n[TOP SKU DEMAND SPIKE (dự báo > 1.5× lịch sử gần nhất)]\n`
    spiked.forEach((s, i) => {
      const ratio = ((s.avg_forecast_per_day || 0) / (s.avg_daily_sales_180 || 1)).toFixed(1)
      ctx += `${i + 1}. ${s.ItemCode} — Ratio: ×${ratio} | Dự báo: ${s.forecast_56d_total.toFixed(0)} units | ${s.profit_segment} | ${s.demand_class}\n`
    })
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
      ctx += `${i + 1}. ${s.ItemCode} — ${s.forecast_56d_total.toFixed(0)} units | ${s.profit_segment} | ${s.demand_class} | Tin cậy: ${s.reliability_tag}\n`
    })
  }

  // ── Tồn kho dư ──
  if (lower.includes('tồn kho dư') || lower.includes('over') || lower.includes('dư hàng') ||
      lower.includes('ứ đọng') || lower.includes('dư thừa') || lower.includes('giải phóng')) {
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
  const { message, history = [] }: { message: string; history: ChatMessage[] } = await req.json()
  if (!message?.trim()) return NextResponse.json({ reply: '' })

  const skus = getSkuData()
  const chartData = buildChartData(message, skus)

  // ── Cache hit ─────────────────────────────────────────────────
  const cached = getCached(message)
  if (cached) {
    return NextResponse.json({ reply: cached.reply, chartData: cached.chartData ?? undefined })
  }

  if (!MIMO_KEY) {
    return NextResponse.json({ reply: '⚠️ Chưa cấu hình MIMO_API_KEY.' })
  }

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

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history as ChatMessage[]).slice(-8).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message },
  ]

  try {
    const res = await fetch(`${MIMO_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MIMO_KEY}`,
      },
      body: JSON.stringify({
        model: MIMO_MODEL,
        messages,
        temperature: 0.2,
        max_completion_tokens: 1024,
        stream: true,
      }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      return NextResponse.json({ reply: `❌ Lỗi API (${res.status}): ${errData?.error?.message ?? 'Unknown'}` })
    }

    // Stream text chunks về client
    let fullReply = ''
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const raw = line.slice(6).trim()
              if (raw === '[DONE]') continue
              try {
                const json = JSON.parse(raw)
                const text: string = json.choices?.[0]?.delta?.content ?? ''
                if (text) {
                  fullReply += text
                  controller.enqueue(encoder.encode(text))
                }
              } catch { /* ignore parse errors */ }
            }
          }
        } finally {
          setCache(message, fullReply, chartData)
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Chart-Data': chartData ? JSON.stringify(chartData) : '',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ reply: '❌ Lỗi kết nối đến AI. Vui lòng thử lại.' })
  }
}
