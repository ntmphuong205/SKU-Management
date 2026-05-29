'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, Sparkles, Calculator, CheckCircle2, Trash2 } from 'lucide-react'
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
  const [override, setOverride]     = useState<SkuOverride | null>(null)
  const [inputPrice, setInputPrice] = useState('')   // giá nhập/đv
  const [sellPrice, setSellPrice]   = useState('')   // giá bán/đv
  const [planQty, setPlanQty]       = useState('')   // số lượng kế hoạch
  const [noteInput, setNoteInput]   = useState('')
  const [savedAnim, setSavedAnim]   = useState(false)

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

  // Load override whenever SKU changes; pre-fill sell price from revenue estimate
  useEffect(() => {
    if (!sku) return
    const ov = getOverride(sku.ItemCode)
    setOverride(ov)
    if (ov) {
      setInputPrice(ov.inputPrice != null ? String(ov.inputPrice) : '')
      setSellPrice(ov.sellPrice != null ? String(ov.sellPrice) : '')
      setPlanQty(String(ov.planQty))
      setNoteInput(ov.note)
    } else {
      const est = sku.total_sales_qty > 0 ? Math.round(sku.revenue / sku.total_sales_qty) : 0
      setInputPrice('')
      setSellPrice(est > 0 ? String(est) : '')
      setPlanQty(sku._reorder > 0 ? String(sku._reorder) : '')
      setNoteInput('')
    }
  }, [sku?.ItemCode])

  function handleSaveOverride() {
    if (!sku) return
    const ov: SkuOverride = {
      sku: sku.ItemCode,
      inputPrice: inputPrice ? parseFloat(inputPrice) : null,
      sellPrice:  sellPrice  ? parseFloat(sellPrice)  : null,
      planQty:    parseInt(planQty) || 0,
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
    const est = sku.total_sales_qty > 0 ? Math.round(sku.revenue / sku.total_sales_qty) : 0
    setInputPrice('')
    setSellPrice(est > 0 ? String(est) : '')
    setPlanQty(sku._reorder > 0 ? String(sku._reorder) : '')
    setNoteInput('')
  }

  // Financial simulation computed values
  const estimatedSell = sku && sku.total_sales_qty > 0 ? Math.round(sku.revenue / sku.total_sales_qty) : 0
  const ipNum = parseFloat(inputPrice) || 0
  const spNum = parseFloat(sellPrice)  || 0
  const pqNum = parseInt(planQty)      || 0
  const f28   = sku?.forecast_28d_validation ?? 0
  const chiPhiVon  = ipNum * pqNum
  const doanhThuDK = spNum * f28
  const loiNhuanDK = (spNum - ipNum) * f28
  const marginPct  = spNum > 0 && ipNum > 0 ? (spNum - ipNum) / spNum * 100 : null
  const hasCalc    = ipNum > 0 || spNum > 0

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
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Dự báo nhu cầu</h2>
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Dự báo 28 ngày tới (F1–F28)"  value={fmt(sku.forecast_28d_validation, ' đv')} variant="info" />
              <KpiCard label="Dự báo 28 ngày tiếp (F29–F56)" value={fmt(sku.forecast_28d_evaluation, ' đv')} />
              <KpiCard label="Tổng dự báo 56 ngày"           value={fmt(sku.forecast_56d_total, ' đv')} variant="info" />
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
          {/* ── Tái đánh giá tài chính — chỉ Logistics / Quản lý ── */}
          {canOverride && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Calculator size={15} className="text-emerald-600" />
                  <h3 className="text-sm font-semibold text-emerald-800">Tái đánh giá tài chính</h3>
                  <span className="text-[11px] text-slate-400">(mô phỏng — giá đơn vị không có trong tập dữ liệu)</span>
                </div>
                {override && (
                  <span className="text-[11px] text-slate-500">
                    Lưu lúc {new Date(override.updatedAt).toLocaleString('vi-VN')} · <b>{override.updatedBy}</b>
                  </span>
                )}
              </div>

              {/* 3 input fields */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Giá nhập/đv (đ)</label>
                  <input
                    type="number" min={0}
                    value={inputPrice}
                    onChange={e => setInputPrice(e.target.value)}
                    placeholder="Nhập tay"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  />
                  <p className="text-[10px] text-slate-400">VD: giá mua từ nhà cung cấp</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Giá bán/đv (đ)
                    {estimatedSell > 0 && (
                      <span className="ml-1 text-emerald-600 font-normal">(ước tính từ lịch sử)</span>
                    )}
                  </label>
                  <input
                    type="number" min={0}
                    value={sellPrice}
                    onChange={e => setSellPrice(e.target.value)}
                    placeholder={estimatedSell > 0 ? `≈ ${estimatedSell.toLocaleString()}` : 'Nhập tay'}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  />
                  {estimatedSell > 0 && (
                    <p className="text-[10px] text-slate-400">Ước tính: {estimatedSell.toLocaleString()} đ/đv</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">SL kế hoạch đặt (đv)</label>
                  <input
                    type="number" min={0}
                    value={planQty}
                    onChange={e => setPlanQty(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  />
                  {sku._reorder > 0 && (
                    <p className="text-[10px] text-slate-400">Đề xuất hệ thống: {sku._reorder.toLocaleString()} đv</p>
                  )}
                </div>
              </div>

              {/* Live calculation */}
              {hasCalc && (
                <div className="bg-white rounded-lg border border-emerald-100 p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Dự tính tài chính — dựa trên dự báo 28 ngày ({f28.toLocaleString(undefined,{maximumFractionDigits:0})} đv)
                  </p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Chi phí vốn kế hoạch</span>
                      <span className="font-semibold text-slate-800">
                        {ipNum > 0 && pqNum > 0 ? fmt(chiPhiVon, ' đ') : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Doanh thu dự kiến</span>
                      <span className="font-semibold text-slate-800">
                        {spNum > 0 ? fmt(doanhThuDK, ' đ') : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Lợi nhuận dự kiến</span>
                      <span className={`font-semibold ${
                        ipNum > 0 && spNum > 0
                          ? loiNhuanDK >= 0 ? 'text-emerald-700' : 'text-red-600'
                          : 'text-slate-400'
                      }`}>
                        {ipNum > 0 && spNum > 0
                          ? `${loiNhuanDK >= 0 ? '+' : ''}${fmt(loiNhuanDK, ' đ')}`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Biên lợi nhuận</span>
                      <span className={`font-bold ${
                        marginPct === null ? 'text-slate-400'
                        : marginPct >= 20 ? 'text-emerald-700'
                        : marginPct >= 0  ? 'text-amber-600'
                        : 'text-red-600'
                      }`}>
                        {marginPct !== null ? `${marginPct.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  </div>
                  {ipNum > 0 && spNum > 0 && spNum < ipNum && (
                    <p className="mt-3 text-xs text-red-600 font-medium">
                      Giá bán thấp hơn giá nhập — kinh doanh bị lỗ trên SKU này.
                    </p>
                  )}
                </div>
              )}

              {/* Note */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Ghi chú</label>
                <textarea
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="VD: Giá nhập tăng 3× từ tháng 6 do nhà cung cấp điều chỉnh. Biên LN giảm còn ~15%, cần xem xét điều chỉnh giá bán."
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleSaveOverride}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    savedAnim ? 'bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {savedAnim ? <><CheckCircle2 size={14} /> Đã lưu</> : 'Lưu đánh giá'}
                </button>
                {override && (
                  <button
                    onClick={handleRemoveOverride}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={13} /> Xóa
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
