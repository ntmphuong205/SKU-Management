'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import Link from 'next/link'
import StatusBadge, { IntelBadges } from '@/components/StatusBadge'
import { ACTION_LABEL } from '@/lib/types'

interface Row {
  ItemCode: string
  profit_segment: string
  demand_class: string
  forecast_28d_validation: number
  forecast_56d_total: number
  _status: string
  _reorder: number
  reorder_qty: number
  recommended_action: string
  reason_codes: string
  days_since_last_sale: number
  return_ratio: number
  reliability_tag: string
  _badges: string[]
}

const URGENT_ACTIONS = [
  'Prioritize replenishment',
  'Review with Sales',
  'Manual review required',
  'Check return/quality issue',
  'Review slow-moving stock',
]

export default function CanhBao() {
  const [rows, setRows]   = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage]   = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [totalCounts, setTotalCounts] = useState({ urgent: 0, review: 0, returns: 0, slow: 0 })
  const [countsLoaded, setCountsLoaded] = useState(false)
  const LIMIT = 30

  useEffect(() => {
    async function fetchCounts() {
      const [urgentRes, reviewRes, returnsRes, slowRes] = await Promise.all([
        fetch('/api/skus?action=Prioritize+replenishment&limit=1').then(r => r.json()),
        fetch('/api/skus?action=Review+with+Sales&limit=1').then(r => r.json()),
        fetch('/api/skus?action=Check+return%2Fquality+issue&limit=1').then(r => r.json()),
        fetch('/api/skus?action=Review+slow-moving+stock&limit=1').then(r => r.json()),
      ])
      setTotalCounts({
        urgent:  urgentRes.total  ?? 0,
        review:  reviewRes.total  ?? 0,
        returns: returnsRes.total ?? 0,
        slow:    slowRes.total    ?? 0,
      })
      setCountsLoaded(true)
    }
    fetchCounts()
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      sort: 'forecast_56d_total', dir: 'desc',
      limit: String(LIMIT), page: String(page),
      actionable: 'true',
    })
    if (actionFilter) params.set('action', actionFilter)

    fetch(`/api/skus?${params}`)
      .then(r => r.json())
      .then(d => {
        setRows(d.rows)
        setTotal(d.total)
        setLoading(false)
      })
  }, [page, actionFilter])

  useEffect(() => { load() }, [load])

  const actionOptions = [
    { value: '',                             label: 'Tất cả hành động' },
    { value: 'Prioritize replenishment',     label: 'Nhập hàng ngay' },
    { value: 'Review with Sales',            label: 'Cần xem xét' },
    { value: 'Check return/quality issue',   label: 'Kiểm tra hoàn hàng' },
    { value: 'Review slow-moving stock',     label: 'Hàng tồn chậm' },
  ]

  async function handleExport() {
    const params = new URLSearchParams({ sort: 'forecast_56d_total', dir: 'desc', limit: '10000', actionable: 'true' })
    if (actionFilter) params.set('action', actionFilter)
    const data = await fetch(`/api/skus?${params}`).then(r => r.json())
    const exportRows: Row[] = data.rows as Row[]

    const headers = ['Mã SKU', 'Phân khúc lợi nhuận', 'Xu hướng bán', 'Dự báo 28 ngày', 'Dự báo 56 ngày',
      'Đề xuất đặt (28 ngày)', 'Độ tin cậy', 'Trạng thái tồn kho', 'Hành động đề xuất', 'Lý do']
    const keys: (keyof Row)[] = ['ItemCode', 'profit_segment', 'demand_class',
      'forecast_28d_validation', 'forecast_56d_total', 'forecast_28d_validation',
      'reliability_tag', '_status', 'recommended_action', 'reason_codes']

    const esc = (v: unknown) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s }
    const csv = [headers.join(','), ...exportRows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n')

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `canh-bao-sku-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function rowBg(r: Row) {
    if (r.recommended_action === 'Prioritize replenishment') return 'bg-red-50 hover:bg-red-100'
    if (['Review with Sales','Manual review required'].includes(r.recommended_action)) return 'bg-amber-50 hover:bg-amber-100'
    if (r.recommended_action === 'Check return/quality issue') return 'bg-purple-50 hover:bg-purple-100'
    if (r.recommended_action === 'Review slow-moving stock') return 'bg-sky-50 hover:bg-sky-100'
    return 'hover:bg-slate-50'
  }

  function reasonVN(raw: string): string {
    return raw
      .replace('Only ', 'Chỉ ').replace(' sale days in last 180 days', ' ngày bán trong 180 ngày qua')
      .replace('Last sale was ', 'Bán cuối cách ').replace(' days ago', ' ngày')
      .replace('High return ratio:', 'Tỷ lệ hoàn hàng:')
      .replace('Dormant SKU — no sale in last 180 days', 'Không giao dịch 180 ngày qua')
      .replace('Frequent recent sales', 'Bán thường xuyên').replace('Stable model agreement', 'Dự báo ổn định')
      .replace('High profit SKU: top 10%', 'SKU lợi nhuận cao (top 10%)')
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Cảnh báo & Hành động</h1>
          <p className="text-sm text-slate-500 mt-0.5">Danh sách SKU cần xử lý — sắp xếp theo mức độ ưu tiên</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Download size={13} /> Xuất CSV
        </button>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '🔴 Nhập hàng ngay',      count: totalCounts.urgent,   bg: 'bg-red-50 border-red-200 text-red-800',           action: 'Prioritize replenishment'   },
          { label: '🟡 Cần xem xét',          count: totalCounts.review,   bg: 'bg-amber-50 border-amber-200 text-amber-800',     action: 'Review with Sales'          },
          { label: '🟣 Kiểm tra hoàn hàng',   count: totalCounts.returns,  bg: 'bg-purple-50 border-purple-200 text-purple-800',  action: 'Check return/quality issue' },
          { label: '🔵 Hàng tồn chậm',        count: totalCounts.slow,     bg: 'bg-sky-50 border-sky-200 text-sky-800',           action: 'Review slow-moving stock'   },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => { setActionFilter(s.action === actionFilter ? '' : s.action); setPage(1) }}
            className={`rounded-lg border px-4 py-3 text-left transition-all ${s.bg} ${actionFilter === s.action ? 'ring-2 ring-offset-1 ring-slate-400' : 'hover:opacity-80'}`}
          >
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-0.5">{countsLoaded ? s.count : '…'}</p>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 px-4 py-3">
        <AlertTriangle size={15} className="text-slate-400 shrink-0" />
        <span className="text-sm text-slate-500 shrink-0">Lọc theo hành động:</span>
        <div className="flex gap-2 flex-wrap">
          {actionOptions.map(o => (
            <button
              key={o.value}
              onClick={() => { setActionFilter(o.value); setPage(1) }}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                actionFilter === o.value
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 inline-block border border-red-200"/>Nhập hàng ngay</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 inline-block border border-amber-200"/>Cần xem xét</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-100 inline-block border border-purple-200"/>Kiểm tra hoàn hàng</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-100 inline-block border border-sky-200"/>Hàng tồn chậm</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-28" />   {/* Mã SKU */}
              <col className="w-32" />   {/* Phân khúc */}
              <col className="w-28" />   {/* DB 28 ngày */}
              <col className="w-28" />   {/* DB 56 ngày */}
              <col className="w-28" />   {/* Đề xuất đặt */}
              <col className="w-36" />   {/* Độ tin cậy */}
              <col className="w-36" />   {/* Hành động */}
              <col />                    {/* Tín hiệu / Lý do */}
            </colgroup>
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  'Mã SKU', 'Phân khúc',
                  'Dự báo 28 ngày', 'Dự báo 56 ngày', 'Đề xuất đặt (28 ngày)',
                  'Độ tin cậy', 'Hành động', 'Tín hiệu & Lý do',
                ].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">Đang tải…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">Không có dữ liệu</td></tr>
              ) : rows.map(r => (
                <tr key={r.ItemCode} className={`text-sm transition-colors ${rowBg(r)}`}>
                  <td className="px-3 py-2.5 font-mono font-medium">
                    <Link href={`/chi-tiet?sku=${r.ItemCode}`} className="text-blue-700 hover:underline">
                      {r.ItemCode}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <StatusBadge value={r.profit_segment} type="profit" />
                      <StatusBadge value={r.demand_class} type="demand" />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-slate-700">
                    {r.forecast_28d_validation?.toLocaleString(undefined,{maximumFractionDigits:1})}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-slate-700">
                    {r.forecast_56d_total?.toLocaleString(undefined,{maximumFractionDigits:1})}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">
                    {r.forecast_28d_validation > 0 &&
                     ['Prioritize replenishment', 'Review with Sales', 'Manual review required'].includes(r.recommended_action)
                      ? <span className={r.recommended_action === 'Prioritize replenishment' ? 'text-red-700' : 'text-amber-600'}>
                          {r.forecast_28d_validation.toLocaleString(undefined, {maximumFractionDigits: 0})}
                        </span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge value={r.reliability_tag} type="reliability" />
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge value={r.recommended_action} type="action" />
                  </td>
                  <td className="px-3 py-2.5">
                    {/* Intelligence badges */}
                    {r._badges?.length > 0 && (
                      <div className="mb-1.5">
                        <IntelBadges badges={r._badges} />
                      </div>
                    )}
                    {/* Reason text */}
                    <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                      {r.reason_codes?.split(' | ').map((rc, i) => (
                        <span key={i}>• {reasonVN(rc)}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
          <span className="text-xs text-slate-500">
            Hiển thị {rows.length} / {total} SKU cần hành động
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-white disabled:opacity-40">
              ← Trước
            </button>
            <span className="px-3 py-1 text-xs bg-white border border-slate-200 rounded font-medium">
              {page}
            </span>
            <button onClick={() => setPage(p => p+1)} disabled={rows.length < LIMIT}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-white disabled:opacity-40">
              Sau →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
