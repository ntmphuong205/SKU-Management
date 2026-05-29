'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, Download, Lock, Send, CheckCircle, XCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import StatusBadge, { IntelBadges } from '@/components/StatusBadge'
import { ACTION_LABEL } from '@/lib/types'
import { useRole } from '@/context/RoleContext'
import { getProposals, saveProposal, type Proposal } from '@/lib/proposals'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'

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
  const { role } = useRole()
  const isSalesReadonly = role === 'sales'

  const [rows, setRows]   = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage]   = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [totalCounts, setTotalCounts] = useState({ urgent: 0, review: 0, returns: 0, slow: 0 })
  const [countsLoaded, setCountsLoaded] = useState(false)
  const LIMIT = 30

  // For sales, always lock to stockout-only
  const effectiveFilter = isSalesReadonly ? 'Prioritize replenishment' : actionFilter

  // Proposal states (sales only)
  const [proposalModal, setProposalModal] = useState<{ sku: string; forecast: number } | null>(null)
  const [proposalQty, setProposalQty]     = useState(0)
  const [proposalNote, setProposalNote]   = useState('')
  const [proposedSkus, setProposedSkus]   = useState<Set<string>>(new Set())
  const [myProposals, setMyProposals]     = useState<Proposal[]>([])

  function refreshProposals() {
    const all = getProposals()
    setMyProposals(all)
    setProposedSkus(new Set(all.filter(p => p.status === 'pending').map(p => p.sku)))
  }

  useEffect(() => {
    if (isSalesReadonly) refreshProposals()
  }, [isSalesReadonly])

  function openProposal(sku: string, forecast: number) {
    setProposalQty(Math.max(1, Math.ceil(forecast)))
    setProposalNote('')
    setProposalModal({ sku, forecast })
  }

  function submitProposal() {
    if (!proposalModal || proposalQty <= 0) return
    saveProposal({ sku: proposalModal.sku, qty: proposalQty, note: proposalNote })
    setProposalModal(null)
    refreshProposals()
  }

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
    if (effectiveFilter) params.set('action', effectiveFilter)

    fetch(`/api/skus?${params}`)
      .then(r => r.json())
      .then(d => {
        setRows(d.rows)
        setTotal(d.total)
        setLoading(false)
      })
  }, [page, effectiveFilter])

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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-800">
              {isSalesReadonly ? 'Cảnh báo thiếu hàng' : 'Phân tích rủi ro tồn kho'}
            </h1>
            {isSalesReadonly && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                <Lock size={10} /> Chỉ xem
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {isSalesReadonly
              ? 'Danh sách SKU có nguy cơ hết hàng — dữ liệu chỉ xem'
              : 'Phát hiện sớm rủi ro · Dự báo nhu cầu · Đề xuất hành động tối ưu'}
          </p>
        </div>
        {!isSalesReadonly && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download size={13} /> Xuất CSV
          </button>
        )}
      </div>

      {/* Proposal status panel — sales only */}
      {isSalesReadonly && myProposals.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Đề xuất nhập hàng của tôi</p>
            <span className="text-[11px] text-slate-400">{myProposals.filter(p => p.status === 'pending').length} chờ duyệt · {myProposals.filter(p => p.status !== 'pending').length} đã xử lý</span>
          </div>
          <div className="divide-y divide-slate-50">
            {myProposals.slice().reverse().map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                {p.status === 'pending'  && <Clock       size={15} className="text-amber-400 shrink-0" />}
                {p.status === 'approved' && <CheckCircle size={15} className="text-emerald-500 shrink-0" />}
                {p.status === 'rejected' && <XCircle     size={15} className="text-red-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-800">{p.sku}</span>
                    <span className="text-xs text-slate-400">· {p.qty.toLocaleString()} đơn vị</span>
                    {p.note && <span className="text-xs text-slate-400 truncate max-w-[160px]">· {p.note}</span>}
                  </div>
                  {p.status === 'approved' && (
                    <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                      Đã được phê duyệt{p.reviewNote ? ` · ${p.reviewNote}` : ''}
                    </p>
                  )}
                  {p.status === 'rejected' && (
                    <p className="text-xs text-red-500 mt-0.5 font-medium">
                      Bị từ chối{p.reviewNote ? ` · ${p.reviewNote}` : ''}
                    </p>
                  )}
                  {p.status === 'pending' && (
                    <p className="text-xs text-slate-400 mt-0.5">Đang chờ Quản lý phê duyệt</p>
                  )}
                </div>
                <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  p.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                  p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {p.status === 'pending' ? 'Chờ duyệt' : p.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary counts */}
      {isSalesReadonly ? (
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-lg border px-4 py-3 bg-red-50 border-red-200 text-red-800">
            <p className="text-xs font-medium">SKU có nguy cơ hết hàng</p>
            <p className="text-2xl font-bold mt-0.5">{countsLoaded ? totalCounts.urgent : '…'}</p>
            <p className="text-xs text-red-600 mt-0.5">Cần kiểm tra với Logistics để đặt hàng kịp thời</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '🔴 Nhập hàng ngay',      count: totalCounts.urgent,   bg: 'bg-red-50 border-red-200 text-red-800',           action: 'Prioritize replenishment'   },
            { label: '🔵 Cần xem xét',          count: totalCounts.review,   bg: 'bg-blue-50 border-blue-200 text-blue-800',        action: 'Review with Sales'          },
            { label: '🟣 Kiểm tra hoàn hàng',   count: totalCounts.returns,  bg: 'bg-purple-50 border-purple-200 text-purple-800',  action: 'Check return/quality issue' },
            { label: '⚪ Hàng tồn chậm',        count: totalCounts.slow,     bg: 'bg-slate-50 border-slate-200 text-slate-700',     action: 'Review slow-moving stock'   },
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
      )}

      {/* Risk distribution chart */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Phân bố rủi ro theo loại</h2>
        <p className="text-xs text-slate-400 mb-4">Số lượng SKU cần xử lý theo từng nhóm rủi ro — được phân tích tự động từ dữ liệu dự báo</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            layout="vertical"
            data={[
              { name: 'Nhập hàng ngay',     count: totalCounts.urgent,  fill: '#ef4444' },
              { name: 'Cần xem xét',         count: totalCounts.review,  fill: '#3b82f6' },
              { name: 'Kiểm tra hoàn hàng',  count: totalCounts.returns, fill: '#a855f7' },
              { name: 'Hàng tồn chậm',       count: totalCounts.slow,    fill: '#94a3b8' },
            ]}
            margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
          >
            <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={130} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} SKU`, 'Số lượng']} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {[
                { fill: '#ef4444' },
                { fill: '#3b82f6' },
                { fill: '#a855f7' },
                { fill: '#94a3b8' },
              ].map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.85} />)}
              <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filter bar — hidden for sales read-only */}
      {!isSalesReadonly && (
        <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 px-4 py-3">
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
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 inline-block border border-red-200"/>Nhập hàng ngay</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 inline-block border border-blue-200"/>Cần xem xét</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-100 inline-block border border-purple-200"/>Kiểm tra hoàn hàng</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 inline-block border border-slate-200"/>Hàng tồn chậm</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {[
                  'Mã SKU', 'Hành động',
                  'Dự báo 28 ngày', 'Dự báo 56 ngày',
                  ...(!isSalesReadonly ? ['Đề xuất đặt'] : []),
                  'Độ tin cậy', 'Lý do vận hành',
                  ...(isSalesReadonly ? [''] : []),
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={isSalesReadonly ? 7 : 7} className="px-4 py-8 text-center text-sm text-slate-400">Đang tải…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={isSalesReadonly ? 7 : 7} className="px-4 py-8 text-center text-sm text-slate-400">Không có dữ liệu</td></tr>
              ) : rows.map(r => (
                <tr key={r.ItemCode} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm font-medium text-slate-800">
                    <Link href={`/chi-tiet?sku=${r.ItemCode}`} className="text-blue-600 hover:underline">
                      {r.ItemCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge value={r.recommended_action} type="action" />
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">
                    {r.forecast_28d_validation?.toLocaleString(undefined,{maximumFractionDigits:1})}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">
                    {r.forecast_56d_total?.toLocaleString(undefined,{maximumFractionDigits:1})}
                  </td>
                  {!isSalesReadonly && (
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {r.forecast_28d_validation > 0 &&
                       ['Prioritize replenishment', 'Review with Sales', 'Manual review required'].includes(r.recommended_action)
                        ? <span className={r.recommended_action === 'Prioritize replenishment' ? 'text-red-700' : 'text-blue-700'}>
                            {r.forecast_28d_validation.toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge value={r.reliability_tag} type="reliability" />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px]">
                    {r.reason_codes?.split(' | ')
                      .filter(rc => !rc.startsWith('High profit') && rc !== 'Frequent recent sales' && rc !== 'Stable model agreement')
                      .slice(0, 2)
                      .map(reasonVN)
                      .join(' · ') || <span className="italic text-slate-300">—</span>}
                  </td>
                  {isSalesReadonly && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {proposedSkus.has(r.ItemCode) ? (
                        <span className="text-[11px] text-slate-400 italic">Đã đề xuất</span>
                      ) : (
                        <button
                          onClick={() => openProposal(r.ItemCode, r.forecast_28d_validation)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          <Send size={11} /> Đề xuất
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
          <span className="text-xs text-slate-500">
            {total.toLocaleString()} SKU · trang {page}
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

      {/* Proposal modal */}
      {proposalModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-0.5">Đề xuất nhập hàng</h2>
            <p className="text-sm text-slate-500 mb-4">
              SKU: <span className="font-mono font-semibold text-slate-700">{proposalModal.sku}</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Số lượng đề xuất nhập</label>
                <input
                  type="number"
                  min={1}
                  value={proposalQty}
                  onChange={e => setProposalQty(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Dự báo 28 ngày: {proposalModal.forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Ghi chú (tuỳ chọn)</label>
                <textarea
                  value={proposalNote}
                  onChange={e => setProposalNote(e.target.value)}
                  rows={2}
                  placeholder="Lý do đề xuất, thông tin thêm từ khách hàng..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setProposalModal(null)}
                className="flex-1 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={submitProposal}
                disabled={proposalQty <= 0}
                className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                Gửi đề xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
