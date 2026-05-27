'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import StatusBadge, { IntelBadges } from '@/components/StatusBadge'
import KpiCard from '@/components/KpiCard'
import { RELIABILITY_LABEL } from '@/lib/types'
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

function ChiTietContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const skuParam = searchParams.get('sku') ?? ''

  const [searchInput, setSearchInput] = useState(skuParam)
  const [sku, setSku] = useState<SkuDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  function doSearch(id: string) {
    if (!id) return
    router.replace(`/chi-tiet?sku=${id}`)
    setLoading(true); setNotFound(false)
    fetch(`/api/sku/${encodeURIComponent(id)}`).then(r => {
      if (!r.ok) { setNotFound(true); setLoading(false); return null }
      return r.json()
    }).then(d => { if (d) { setSku(d); setLoading(false) } })
  }

  useEffect(() => { if (skuParam) { setSearchInput(skuParam); doSearch(skuParam) } }, [skuParam])

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
            placeholder="Nhập mã SKU và Enter"
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

          {/* KPI row 1 — Dự báo */}
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Dự báo nhu cầu</h2>
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Dự báo 28 ngày tới (F1–F28)"  value={fmt(sku.forecast_28d_validation, ' units')} variant="info" />
              <KpiCard label="Dự báo 28 ngày tiếp (F29–F56)" value={fmt(sku.forecast_28d_evaluation, ' units')} />
              <KpiCard label="Tổng dự báo 56 ngày"           value={fmt(sku.forecast_56d_total, ' units')} variant="info" />
            </div>
          </div>

          {/* KPI row 2 — Tồn kho */}
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Tồn kho mô phỏng</h2>
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Tồn kho ước tính (hiện tại)"      value={fmt(sku._stock, ' units')} />
              <KpiCard label="Nhu cầu trong thời gian chờ hàng" value={fmt(sku._ltDemand, ' units')} variant={sku._status === 'stockout' ? 'warning' : 'default'} />
              <KpiCard label="Số lượng cần đặt thêm"            value={sku._reorder > 0 ? fmt(sku._reorder, ' units') : 'Chưa cần đặt'} variant={sku._reorder > 0 ? 'danger' : 'success'} />
            </div>
          </div>

          {/* KPI row 3 — Lịch sử */}
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Lịch sử kinh doanh</h2>
            <div className="grid grid-cols-4 gap-3">
              <KpiCard label="Số ngày bán (180 ngày gần nhất)" value={`${sku.sale_days_180} ngày`} />
              <KpiCard label="Giao dịch cuối cách đây"          value={sku.days_since_last_sale > 9000 ? 'Chưa có dữ liệu' : `${sku.days_since_last_sale} ngày`} />
              <KpiCard label="Tỷ lệ hoàn hàng"                  value={`${(sku.return_ratio * 100).toFixed(1)}%`} variant={sku.return_ratio > 0.05 ? 'warning' : 'default'} />
              <KpiCard label="Tổng đã bán (sau hoàn trả)"       value={`${sku.net_qty.toLocaleString(undefined,{maximumFractionDigits:0})} units`} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {/* Forecast chart */}
            <div className="col-span-2 bg-white rounded-lg border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Dự báo theo tuần — 56 ngày tới</h3>
              <p className="text-xs text-slate-400 mb-4">
                Tháng đầu (F1–F28): {sku?.forecast_28d_validation.toLocaleString(undefined,{maximumFractionDigits:0})} units &nbsp;·&nbsp;
                Tháng tiếp (F29–F56): {sku?.forecast_28d_evaluation.toLocaleString(undefined,{maximumFractionDigits:0})} units
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyForecast} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="tuần" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(0)} units`, '']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Tháng đầu (F1–F28)" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Tháng tiếp (F29–F56)" fill="#0891b2" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Reason codes + revenue */}
            <div className="space-y-4">
              <div className="bg-white rounded-lg border border-slate-200 p-4">
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

              <div className="bg-white rounded-lg border border-slate-200 p-4">
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
                    <span className="font-medium">{sku.net_qty.toLocaleString(undefined,{maximumFractionDigits:0})} units</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!sku && !loading && !notFound && (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <Search size={40} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 text-sm">Nhập mã SKU (VD: SKU-09760) để xem chi tiết</p>
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
