'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, Sparkles, SlidersHorizontal, CheckCircle2, Trash2 } from 'lucide-react'
import StatusBadge, { IntelBadges } from '@/components/StatusBadge'
import KpiCard from '@/components/KpiCard'
import { RELIABILITY_LABEL } from '@/lib/types'
import { useRole } from '@/context/RoleContext'
import { getOverride, saveOverride, removeOverride, type SkuOverride } from '@/lib/overrides'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface SkuDetail {
  ItemCode: string
  profit_segment: string
  demand_class: string
  sale_days_180: number
  sale_days_365: number
  days_since_last_sale: number
  return_ratio: number
  revenue: number
  profit: number
  net_qty: number
  total_sales_qty: number
  forecast_28d_validation: number
  forecast_28d_evaluation: number
  forecast_56d_total: number
  avg_forecast_per_day: number
  avg_daily_sales_180: number
  recommended_action: string
  reason_codes: string
  reliability_tag: string
  _status: string
  _reorder: number
  _stock: number
  _ltDemand: number
  _badges: string[]
}

const REASON_MAP: Record<string, string> = {
  'Only ': 'Chỉ ',
  ' sale days in last 180 days': ' ngày bán trong 180 ngày qua',
  'Last sale was ': 'Bán cuối cách ',
  ' days ago': ' ngày',
  'High return ratio:': 'Tỷ lệ hoàn hàng cao:',
  'Dormant SKU — no sale in last 180 days': 'Không phát sinh giao dịch trong 180 ngày qua',
  'Frequent recent sales': 'Bán hàng thường xuyên gần đây',
  'Stable model agreement': 'Dự báo ổn định — các mô hình đồng thuận',
  'High profit SKU: top 10%': 'SKU lợi nhuận cao (top 10%)',
  'disagreement': 'Các mô hình dự báo chưa đồng thuận — cần xác nhận',
  'Intermittent demand': 'Nhu cầu gián đoạn',
}

function translateReason(raw: string): string {
  let s = raw
  for (const [en, vn] of Object.entries(REASON_MAP)) {
    s = s.replaceAll(en, vn)
  }
  return s
}

function fmt(n: number, unit = '') {
  if (n >= 1_000_000_000) return `${(n / 1e9).toFixed(1)} tỷ${unit}`
  if (n >= 1_000_000)     return `${(n / 1e6).toFixed(0)} triệu${unit}`
  if (n >= 1_000)         return `${(n / 1e3).toFixed(0)}K${unit}`
  return `${n.toLocaleString(undefined,{maximumFractionDigits:1})}${unit}`
}

function TypingDots() {
  return (
    <span className="flex gap-1 items-center h-4">
      {[0, 150, 300].map(delay => (
        <span key={delay} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
          style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  )
}

function ChiTietContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const skuParam = searchParams.get('sku') ?? ''
  const { role } = useRole()
  const canOverride = role === 'logistics' || role === 'manager'

  const [searchInput, setSearchInput] = useState(skuParam)
  const [sku, setSku] = useState<SkuDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  // ── Override states ───────────────────────────────────────────
  const [override, setOverride]   = useState<SkuOverride | null>(null)
  const [multInput, setMultInput] = useState(1.0)
  const [noteInput, setNoteInput] = useState('')
  const [savedAnim, setSavedAnim] = useState(false)

  // ── AI explanation ────────────────────────────────────────────
  const [aiText, setAiText]       = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  function normalizeSku(raw: string): string {
    const v = raw.trim()
    if (/^\d+$/.test(v)) return `SKU-${v}`
    const m = v.match(/^sku[\s-]?(\d+)$/i)
    if (m) return `SKU-${m[1]}`
    return v.toUpperCase()
  }

  function doSearch(id: string) {
    if (!id.trim()) return
    const normalized = normalizeSku(id)
    setSearchInput(normalized)
    router.replace(`/chi-tiet?sku=${normalized}`)
    setLoading(true); setNotFound(false); setAiText(null)
    fetch(`/api/sku/${encodeURIComponent(normalized)}`).then(r => {
      if (!r.ok) { setNotFound(true); setLoading(false); return null }
      return r.json()
    }).then(d => { if (d) { setSku(d); setLoading(false) } })
  }

  useEffect(() => { if (skuParam) { setSearchInput(skuParam); doSearch(skuParam) } }, [skuParam])

  // Load override whenever SKU changes
  useEffect(() => {
    if (!sku) return
    const ov = getOverride(sku.ItemCode)
    setOverride(ov)
    setMultInput(ov?.multiplier ?? 1.0)
    setNoteInput(ov?.note ?? '')
  }, [sku?.ItemCode])

  function handleSaveOverride() {
    if (!sku) return
    const ov: SkuOverride = {
      sku: sku.ItemCode,
      multiplier: multInput,
      note: noteInput,
      updatedAt: new Date().toISOString(),
      updatedBy: role ?? 'logistics',
    }
    saveOverride(ov)
    setOverride(ov)
    setSavedAnim(true)
    setTimeout(() => setSavedAnim(false), 2000)
  }

  function handleRemoveOverride() {
    if (!sku) return
    removeOverride(sku.ItemCode)
    setOverride(null)
    setMultInput(1.0)
    setNoteInput('')
  }

  // Adjusted forecast values (apply multiplier if override exists)
  const mult = override?.multiplier ?? 1
  const adjF28  = sku ? Math.round(sku.forecast_28d_validation * mult) : 0
  const adjF29  = sku ? Math.round(sku.forecast_28d_evaluation * mult) : 0
  const adjF56  = sku ? Math.round(sku.forecast_56d_total * mult) : 0

  // Auto AI explanation when SKU changes
  useEffect(() => {
    if (!sku) { setAiText(null); return }
    setAiLoading(true); setAiText(null)

    const trendRatio = (sku.avg_daily_sales_180 > 0 && sku.avg_forecast_per_day > 0)
      ? sku.avg_forecast_per_day / sku.avg_daily_sales_180 : 1
    const trendNote = trendRatio >= 1.3 ? ', xu hướng tăng mạnh so với lịch sử'
      : trendRatio <= 0.7 ? ', xu hướng giảm so với lịch sử' : ''

    const prompt =
      `Phân tích ngắn cho ${sku.ItemCode} (${sku.demand_class}, ${sku.profit_segment}): ` +
      `dự báo 56 ngày là ${sku.forecast_56d_total.toFixed(0)} đv${trendNote}. ` +
      `Hành động: ${sku.recommended_action}. ` +
      `Viết 2–3 câu bằng tiếng Việt — chỉ giải thích ý nghĩa kinh doanh và khuyến nghị quan trọng nhất, không liệt kê số liệu thô.`

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt, history: [] }),
    })
      .then(r => r.json())
      .then(d => { setAiText(d.reply ?? null); setAiLoading(false) })
      .catch(() => setAiLoading(false))
  }, [sku?.ItemCode])

  // Build 56-day forecast chart: weeks 1-4 from validation (F1-F28), weeks 5-8 from evaluation (F29-F56)
  const weeklyForecast = sku ? Array.from({ length: 8 }, (_, i) => ({
    tuần: `T${i + 1}`,
    'Tháng đầu (F1–F28)': i < 4 ? Math.round(sku.forecast_28d_validation / 4) : null,
    'Tháng tiếp (F29–F56)': i >= 4 ? Math.round(sku.forecast_28d_evaluation / 4) : null,
  })) : []

  const actionBg = {
    'Prioritize replenishment': 'bg-red-50 border-red-300 text-red-800',
    'Review with Sales': 'bg-amber-50 border-amber-300 text-amber-800',
    'Manual review required': 'bg-amber-50 border-amber-300 text-amber-800',
    'Check return/quality issue': 'bg-purple-50 border-purple-300 text-purple-800',
    'Review slow-moving stock': 'bg-sky-50 border-sky-300 text-sky-800',
    'Do not replenish': 'bg-slate-50 border-slate-300 text-slate-600',
  } as Record<string, string>

  return (
    <div className="p-6 space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-semibold text-slate-800">Chi tiết SKU</h1>
        <p className="text-sm text-slate-500 mt-0.5">Xem phân tích chi tiết và dự báo cho từng mã hàng</p>
      </div>

      {/* Search */}
      <div className="flex gap-3 items-center">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch(searchInput)}
            placeholder="VD: 08063 hoặc SKU-08063"
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => doSearch(searchInput)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Tìm kiếm
        </button>
      </div>

      {loading && <div className="text-sm text-slate-400">Đang tải…</div>}
      {notFound && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">Không tìm thấy SKU: <b>{searchInput}</b></div>}

      {sku && (
        <div className="space-y-5">
          {/* Action banner */}
          <div className={`rounded-lg border-2 px-5 py-4 ${actionBg[sku.recommended_action] ?? 'bg-green-50 border-green-300 text-green-800'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Hành động đề xuất</p>
                <p className="text-lg font-bold mt-0.5">
                  <StatusBadge value={sku.recommended_action} type="action" />
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <StatusBadge value={sku.profit_segment} type="profit" />
                <StatusBadge value={sku.demand_class}   type="demand" />
                <StatusBadge value={sku._status}        type="status" />
              </div>
            </div>

            {/* Forecast Intelligence row */}
            <div className="mt-3 pt-3 border-t border-black/10 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold opacity-60 uppercase tracking-wide">Đặc điểm nhu cầu</span>
                <StatusBadge value={sku.reliability_tag} type="reliability" />
              </div>
              {sku._badges?.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold opacity-60 uppercase tracking-wide">Tín hiệu</span>
                  <IntelBadges badges={sku._badges} />
                </div>
              )}
            </div>
          </div>

          {/* ── AI Explanation ──────────────────────────────── */}
          {(aiLoading || aiText) && (
            <div className="rounded-lg border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-blue-600 shrink-0" />
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Phân tích AI — {sku.ItemCode}
                </span>
              </div>
              {aiLoading
                ? <TypingDots />
                : <p className="text-sm text-slate-700 leading-relaxed">{aiText}</p>
              }
            </div>
          )}

          {/* KPI row 1 — Dự báo */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Dự báo nhu cầu</h2>
              {override && mult !== 1 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <SlidersHorizontal size={10} /> Đã điều chỉnh ×{mult.toFixed(1)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label={`Dự báo 28 ngày tới (F1–F28)${override && mult !== 1 ? ' — đã điều chỉnh' : ''}`}  value={fmt(adjF28, ' đv')} variant="info" />
              <KpiCard label={`Dự báo 28 ngày tiếp (F29–F56)${override && mult !== 1 ? ' — đã điều chỉnh' : ''}`} value={fmt(adjF29, ' đv')} />
              <KpiCard label={`Tổng dự báo 56 ngày${override && mult !== 1 ? ' — đã điều chỉnh' : ''}`}           value={fmt(adjF56, ' đv')} variant="info" />
            </div>
          </div>

          {/* KPI row 2 — Tồn kho */}
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Tồn kho mô phỏng</h2>
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Tồn kho ước tính (hiện tại)"      value={fmt(sku._stock, ' đv')} />
              <KpiCard label="Nhu cầu trong thời gian chờ hàng" value={fmt(sku._ltDemand, ' đv')} variant={sku._status === 'stockout' ? 'warning' : 'default'} />
              <KpiCard label="Số lượng cần đặt thêm"            value={sku._reorder > 0 ? fmt(sku._reorder, ' đv') : 'Chưa cần đặt'} variant={sku._reorder > 0 ? 'danger' : 'success'} />
            </div>
          </div>

          {/* KPI row 3 — Lịch sử */}
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Lịch sử kinh doanh</h2>
            <div className="grid grid-cols-4 gap-3">
              <KpiCard label="Số ngày bán (180 ngày gần nhất)" value={`${sku.sale_days_180} ngày`} />
              <KpiCard label="Giao dịch cuối cách đây"          value={sku.days_since_last_sale > 9000 ? 'Chưa có dữ liệu' : `${sku.days_since_last_sale} ngày`} />
              <KpiCard label="Tỷ lệ hoàn hàng"                  value={`${(sku.return_ratio * 100).toFixed(1)}%`} variant={sku.return_ratio > 0.05 ? 'warning' : 'default'} />
              <KpiCard label="Tổng đã bán (sau hoàn trả)"       value={`${sku.net_qty.toLocaleString(undefined,{maximumFractionDigits:0})} đv`} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {/* Forecast chart */}
            <div className="col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Dự báo theo tuần — 56 ngày tới</h3>
              <p className="text-xs text-slate-400 mb-4">
                Tháng đầu (F1–F28): {sku?.forecast_28d_validation.toLocaleString(undefined,{maximumFractionDigits:0})} đv &nbsp;·&nbsp;
                Tháng tiếp (F29–F56): {sku?.forecast_28d_evaluation.toLocaleString(undefined,{maximumFractionDigits:0})} đv
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyForecast} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="tuần" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(0)} đv`, '']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Tháng đầu (F1–F28)" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Tháng tiếp (F29–F56)" fill="#0891b2" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Reason codes + revenue */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Lý do đánh giá</h3>
                <ul className="space-y-1.5">
                  {(sku.reason_codes ?? '').split(' | ').filter(Boolean).map((rc, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                      <span className="text-slate-300 shrink-0">•</span>
                      {translateReason(rc)}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Hiệu quả kinh doanh</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tổng doanh thu</span>
                    <span className="font-medium">{fmt(sku.revenue, ' đ')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Lợi nhuận gộp</span>
                    <span className={`font-medium ${sku.profit > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmt(Math.abs(sku.profit), ' đ')}{sku.profit < 0 ? ' (lỗ)' : ''}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Đã bán (net, sau hoàn)</span>
                    <span className="font-medium">{sku.net_qty.toLocaleString(undefined,{maximumFractionDigits:0})} đv</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* ── Override panel — chỉ Logistics / Quản lý ──────── */}
          {canOverride && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={15} className="text-amber-600" />
                  <h3 className="text-sm font-semibold text-amber-800">Điều chỉnh thông số dự báo</h3>
                </div>
                {override && (
                  <span className="text-[11px] text-slate-500">
                    Cập nhật lần cuối: {new Date(override.updatedAt).toLocaleString('vi-VN')} bởi <b>{override.updatedBy}</b>
                  </span>
                )}
              </div>

              {/* Multiplier slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-700 font-medium">
                    Hệ số điều chỉnh dự báo
                  </label>
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                    multInput < 0.9 ? 'bg-red-100 text-red-700'
                    : multInput > 1.1 ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
                  }`}>×{multInput.toFixed(1)}</span>
                </div>
                <input
                  type="range" min={0.1} max={3.0} step={0.1}
                  value={multInput}
                  onChange={e => setMultInput(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>×0.1 (giảm 90%)</span>
                  <span>×1.0 (giữ nguyên)</span>
                  <span>×3.0 (tăng gấp 3)</span>
                </div>
                <p className="text-xs text-slate-500">
                  Dự báo điều chỉnh: <b>{fmt(Math.round(sku.forecast_56d_total * multInput), ' đv')}</b> trong 56 ngày
                  {multInput !== 1 && <span className="ml-1 text-slate-400">(gốc: {fmt(sku.forecast_56d_total, ' đv')})</span>}
                </p>
              </div>

              {/* Note */}
              <div className="space-y-1">
                <label className="text-sm text-slate-700 font-medium">Lý do điều chỉnh</label>
                <textarea
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="VD: Nhà cung cấp tăng giá đầu vào 2×, dự kiến cầu giảm. Chờ xác nhận từ phía Kinh doanh."
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleSaveOverride}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    savedAnim
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {savedAnim ? <><CheckCircle2 size={14} /> Đã lưu</> : 'Lưu điều chỉnh'}
                </button>
                {override && (
                  <button
                    onClick={handleRemoveOverride}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={13} /> Xóa điều chỉnh
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!sku && !loading && !notFound && (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <Search size={40} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 text-sm">Nhập số (VD: 09760) hoặc mã đầy đủ (SKU-09760) rồi nhấn Enter</p>
        </div>
      )}
    </div>
  )
}

export default function ChiTiet() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Đang tải…</div>}>
      <ChiTietContent />
    </Suspense>
  )
}
