'use client'

import { useEffect, useState, useCallback } from 'react'
import { Download, ShieldCheck, BarChart3, AlertTriangle, Package, CheckCircle, XCircle, Clock, Database, RefreshCw, Wifi, WifiOff, Play } from 'lucide-react'
import { getProposals, updateProposal, type Proposal } from '@/lib/proposals'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts'
import type { KpiSummary } from '@/lib/types'

interface SegItem  { key: string; name: string; value: number }
interface ProfItem { key: string; name: string; count: number; revenue: number; profit: number }
interface Segments { demandClass: SegItem[]; profitSegment: ProfItem[]; reliability: SegItem[] }

const REL_COLORS: Record<string, string> = {
  'High Reliability':     '#22c55e',
  'Medium Reliability':   '#3b82f6',
  'Low Reliability':      '#f97316',
  'Insufficient History': '#94a3b8',
}

const DEMAND_COLORS: Record<string, string> = {
  Frequent:     '#22c55e',
  Active:       '#3b82f6',
  Intermittent: '#f59e0b',
  Dormant:      '#94a3b8',
}

function fmt(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)} triệu`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return n.toFixed(0)
}

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number
}) {
  if (percent < 0.06) return null
  const R = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + R * Math.cos(-midAngle * (Math.PI / 180))
  const y = cy + R * Math.sin(-midAngle * (Math.PI / 180))
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

async function exportCsv(params: URLSearchParams, filename: string, headers: string[], keys: string[]) {
  const data = await fetch(`/api/skus?${params}`).then(r => r.json())
  const rows = data.rows
  const esc = (v: unknown) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s }
  const csv = [headers.join(','), ...rows.map((r: Record<string, unknown>) => keys.map(k => esc(r[k])).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

interface IngestionStatus {
  source: 'live' | 'offline'
  total_records?: number
  total_skus?: number
  pending_files?: number
  next_scan?: string
  last_ingestion?: {
    filename: string; status: string; records_total: number
    records_inserted: number; records_duplicate: number; finished_at: string
  } | null
  history?: Array<{
    id: number; filename: string; status: string
    records_total: number; records_inserted: number; records_duplicate: number
    records_invalid: number; error_message: string | null; started_at: string; finished_at: string
  }>
  error?: string
}

function IngestionPanel() {
  const [data, setData]           = useState<IngestionStatus | null>(null)
  const [loading, setLoading]     = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ingestion-status')
      setData(await res.json())
    } catch {
      setData({ source: 'offline', error: 'Không kết nối được backend' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  async function triggerScan() {
    setTriggering(true)
    try {
      await fetch('/api/ingestion-trigger', { method: 'POST' })
      await reload()
    } finally {
      setTriggering(false)
    }
  }

  const isOffline = !data || data.source === 'offline'

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100 bg-blue-50/60">
        <div className="flex items-center gap-2">
          <Database size={15} className="text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Auto Data Ingestion</p>
            <p className="text-xs text-slate-500 mt-0.5">Pipeline tự động nạp CSV — cập nhật mỗi 5 phút</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOffline
            ? <span className="flex items-center gap-1 text-xs text-slate-400"><WifiOff size={12} /> Backend offline</span>
            : <span className="flex items-center gap-1 text-xs text-emerald-600"><Wifi size={12} /> Live</span>
          }
          <button onClick={reload} disabled={loading}
            className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500 disabled:opacity-40 transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={triggerScan} disabled={triggering || isOffline}
            className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors">
            <Play size={11} /> {triggering ? 'Đang quét...' : 'Quét ngay'}
          </button>
        </div>
      </div>

      {isOffline ? (
        <div className="px-5 py-8 text-center">
          <WifiOff size={24} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Backend chưa khởi động</p>
          <p className="text-xs text-slate-300 mt-1 font-mono">cd backend && python scheduler.py</p>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Tổng bản ghi', value: data?.total_records?.toLocaleString() ?? '—' },
              { label: 'Tổng SKU', value: data?.total_skus?.toLocaleString() ?? '—' },
              { label: 'File chờ xử lý', value: data?.pending_files?.toString() ?? '—' },
            ].map(c => (
              <div key={c.label} className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400">{c.label}</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Last ingestion */}
          {data?.last_ingestion && (
            <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3 text-xs">
              <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-slate-700">{data.last_ingestion.filename}</p>
                <p className="text-slate-400 mt-0.5">
                  {data.last_ingestion.records_inserted} bản ghi mới · {data.last_ingestion.records_duplicate} trùng · {fmtDate(data.last_ingestion.finished_at)}
                </p>
              </div>
              <span className={`ml-auto shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                data.last_ingestion.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                data.last_ingestion.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>{data.last_ingestion.status}</span>
            </div>
          )}

          {/* History toggle */}
          {(data?.history?.length ?? 0) > 0 && (
            <div>
              <button onClick={() => setShowHistory(v => !v)}
                className="text-xs text-blue-600 hover:underline">
                {showHistory ? 'Ẩn lịch sử' : `Xem lịch sử (${data?.history?.length} lần)`}
              </button>
              {showHistory && (
                <table className="w-full mt-2 text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['File', 'Trạng thái', 'Tổng', 'Mới', 'Trùng', 'Thời gian'].map((h, i) => (
                        <th key={i} className="py-1.5 pr-3 text-left font-semibold text-slate-400 uppercase text-[10px] tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data?.history?.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="py-1.5 pr-3 font-mono text-slate-600 max-w-[160px] truncate">{row.filename}</td>
                        <td className="py-1.5 pr-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            row.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                            row.status === 'partial'  ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>{row.status}</span>
                        </td>
                        <td className="py-1.5 pr-3 text-slate-500">{row.records_total}</td>
                        <td className="py-1.5 pr-3 text-emerald-600 font-medium">{row.records_inserted}</td>
                        <td className="py-1.5 pr-3 text-slate-400">{row.records_duplicate}</td>
                        <td className="py-1.5 text-slate-400 whitespace-nowrap">{fmtDate(row.finished_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProposalSection({
  proposals,
  onApprove,
  onReject,
}: {
  proposals: Proposal[]
  onApprove: (id: string) => void
  onReject:  (id: string) => void
}) {
  const pending = proposals.filter(p => p.status === 'pending')
  const history = proposals.filter(p => p.status !== 'pending')

  return (
    <div className="bg-white rounded-xl border-2 border-amber-200 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 bg-amber-50/60">
        <div>
          <p className="text-sm font-semibold text-slate-800">Đề xuất nhập hàng từ Kinh doanh</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Kinh doanh gửi đề xuất từ trang Cảnh báo thiếu hàng — Quản lý phê duyệt tại đây
          </p>
        </div>
        {pending.length > 0 && (
          <span className="text-sm font-bold text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">
            {pending.length} chờ duyệt
          </span>
        )}
      </div>

      {proposals.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Clock size={28} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Chưa có đề xuất nào</p>
          <p className="text-xs text-slate-300 mt-1">Khi Kinh doanh gửi đề xuất, chúng sẽ hiện ở đây</p>
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Mã SKU', 'Số lượng', 'Ghi chú', 'Ngày gửi', 'Trạng thái', 'Thao tác'].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pending.map(p => (
              <tr key={p.id} className="bg-amber-50/50 hover:bg-amber-50 transition-colors">
                <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">{p.sku}</td>
                <td className="px-4 py-3 text-sm text-slate-700 font-medium">{p.qty.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px]">{p.note || <span className="italic text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(p.submittedAt)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <Clock size={10} /> Chờ duyệt
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => onApprove(p.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition-colors">
                      <CheckCircle size={14} /> Phê duyệt
                    </button>
                    <button onClick={() => onReject(p.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors">
                      <XCircle size={14} /> Từ chối
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {history.map(p => (
              <tr key={p.id} className="opacity-55 hover:opacity-80 transition-opacity">
                <td className="px-4 py-3 font-mono text-sm text-slate-600">{p.sku}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{p.qty.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px]">{p.note || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(p.submittedAt)}</td>
                <td className="px-4 py-3">
                  {p.status === 'approved'
                    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle size={11} /> Đã duyệt</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-red-600"><XCircle size={11} /> Từ chối</span>
                  }
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 italic">{p.reviewNote ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function GovernancePage() {
  const [kpis, setKpis]         = useState<KpiSummary | null>(null)
  const [segments, setSegments] = useState<Segments | null>(null)
  const [riskCounts, setRiskCounts] = useState({ urgent: 0, review: 0, returns: 0, slow: 0 })
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [reviewModal, setReviewModal] = useState<{ id: string; type: 'approve' | 'reject' } | null>(null)
  const [reviewNote, setReviewNote] = useState('')

  function refreshProposals() { setProposals(getProposals()) }

  function handleReview() {
    if (!reviewModal) return
    updateProposal(reviewModal.id, {
      status:     reviewModal.type === 'approve' ? 'approved' : 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewNote: reviewNote.trim() || undefined,
    })
    refreshProposals()
    setReviewModal(null)
    setReviewNote('')
  }

  useEffect(() => {
    refreshProposals()
    fetch('/api/kpis').then(r => r.json()).then(setKpis)
    fetch('/api/segments').then(r => r.json()).then(setSegments)
    Promise.all([
      fetch('/api/skus?action=Prioritize+replenishment&limit=1').then(r => r.json()),
      fetch('/api/skus?action=Review+with+Sales&limit=1').then(r => r.json()),
      fetch('/api/skus?action=Check+return%2Fquality+issue&limit=1').then(r => r.json()),
      fetch('/api/skus?action=Review+slow-moving+stock&limit=1').then(r => r.json()),
    ]).then(([u, rv, ret, sl]) =>
      setRiskCounts({ urgent: u.total ?? 0, review: rv.total ?? 0, returns: ret.total ?? 0, slow: sl.total ?? 0 })
    )
  }, [])

  const reliabilityData = segments?.reliability ?? []
  const demandData      = segments?.demandClass ?? []

  const highRel  = reliabilityData.find(r => r.key === 'High Reliability')?.value ?? 0
  const totalRel = reliabilityData.reduce((s, r) => s + r.value, 0)
  const reliabilityScore = totalRel > 0 ? Math.round((highRel / totalRel) * 100) : 0

  function handleExportFull() {
    exportCsv(
      new URLSearchParams({ sort: 'forecast_56d_total', dir: 'desc', limit: '20000' }),
      `bao-cao-toan-bo-sku-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Mã SKU', 'Phân khúc lợi nhuận', 'Xu hướng bán', 'Dự báo 28 ngày', 'Dự báo 56 ngày', 'Tồn kho', 'Hành động đề xuất'],
      ['ItemCode', 'profit_segment', 'demand_class', 'forecast_28d_validation', 'forecast_56d_total', '_status', 'recommended_action'],
    )
  }

  function handleExportRisk() {
    exportCsv(
      new URLSearchParams({ sort: 'forecast_56d_total', dir: 'desc', limit: '10000', actionable: 'true' }),
      `bao-cao-rui-ro-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Mã SKU', 'Hành động', 'Phân khúc', 'Dự báo 28 ngày', 'Dự báo 56 ngày', 'Lý do'],
      ['ItemCode', 'recommended_action', 'profit_segment', 'forecast_28d_validation', 'forecast_56d_total', 'reason_codes'],
    )
  }

  function handleExportHighProfit() {
    exportCsv(
      new URLSearchParams({ sort: 'forecast_56d_total', dir: 'desc', limit: '10000', profit: 'High Profit' }),
      `bao-cao-sku-loi-nhuan-cao-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Mã SKU', 'Phân khúc lợi nhuận', 'Dự báo 28 ngày', 'Dự báo 56 ngày', 'Tồn kho', 'Hành động đề xuất'],
      ['ItemCode', 'profit_segment', 'forecast_28d_validation', 'forecast_56d_total', '_status', 'recommended_action'],
    )
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={18} className="text-emerald-600" />
          <h1 className="text-xl font-semibold text-slate-800">Governance Dashboard</h1>
        </div>
        <p className="text-sm text-slate-500">Tổng quan hệ thống · Hiệu suất mô hình dự báo · Xuất báo cáo</p>
      </div>

      {/* ── Ingestion pipeline ──────────────────────────────────── */}
      <IngestionPanel />

      {/* ── Proposals section ───────────────────────────────────── */}
      <ProposalSection
        proposals={proposals}
        onApprove={(id) => { setReviewNote(''); setReviewModal({ id, type: 'approve' }) }}
        onReject={(id)  => { setReviewNote(''); setReviewModal({ id, type: 'reject'  }) }}
      />

      {/* System KPIs */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Sức khỏe hệ thống</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Tổng SKU',
              value: kpis ? kpis.total_skus.toLocaleString() : '—',
              sub: `${kpis?.active_skus.toLocaleString() ?? '—'} đang bán`,
              color: 'text-slate-800',
              bg: 'bg-white',
            },
            {
              label: 'Độ tin cậy mô hình',
              value: `${reliabilityScore}%`,
              sub: `${highRel.toLocaleString()} SKU dự báo chính xác cao`,
              color: reliabilityScore >= 60 ? 'text-emerald-700' : 'text-amber-700',
              bg: 'bg-white',
            },
            {
              label: 'SKU rủi ro tồn kho',
              value: (riskCounts.urgent + riskCounts.review).toLocaleString(),
              sub: `${riskCounts.urgent} cần nhập ngay`,
              color: 'text-red-700',
              bg: 'bg-white',
            },
            {
              label: 'Biên lợi nhuận hệ thống',
              value: kpis && kpis.total_revenue > 0
                ? `${((kpis.total_profit / kpis.total_revenue) * 100).toFixed(1)}%`
                : '—',
              sub: kpis ? `${fmt(kpis.total_profit)} đ lợi nhuận` : '—',
              color: 'text-emerald-700',
              bg: 'bg-white',
            },
          ].map(card => (
            <div key={card.label} className={`${card.bg} rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-4`}>
              <p className="text-xs text-slate-400">{card.label}</p>
              <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk overview */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Theo dõi risk toàn hệ thống</h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Nhập hàng ngay',    count: riskCounts.urgent,  bg: 'bg-red-50 border-red-200 text-red-800',           icon: AlertTriangle },
            { label: 'Cần xem xét',        count: riskCounts.review,  bg: 'bg-blue-50 border-blue-200 text-blue-800',        icon: BarChart3     },
            { label: 'Kiểm tra hoàn hàng', count: riskCounts.returns, bg: 'bg-purple-50 border-purple-200 text-purple-800',  icon: Package       },
            { label: 'Hàng tồn chậm',      count: riskCounts.slow,    bg: 'bg-slate-50 border-slate-200 text-slate-700',     icon: Package       },
          ].map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.bg}`}>
                <p className="text-xs font-medium">{s.label}</p>
                <p className="text-2xl font-bold mt-0.5">{s.count.toLocaleString()}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Model performance charts */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">So sánh hiệu suất mô hình dự báo</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Reliability distribution */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Phân bố độ tin cậy dự báo</h3>
            <p className="text-xs text-slate-400 mb-4">Tỉ lệ SKU theo chất lượng dự báo của mô hình</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={reliabilityData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  labelLine={false}
                  label={PieLabel as never}
                >
                  {reliabilityData.map(entry => (
                    <Cell key={entry.key} fill={REL_COLORS[entry.key] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [`${Number(v).toLocaleString()} SKU`, n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 border-t border-slate-100 pt-3 grid grid-cols-2 gap-3">
              {reliabilityData.map(r => (
                <div key={r.key} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{r.name}</span>
                  <span className="font-semibold text-slate-700">{r.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Demand class — horizontal bar */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Phân bố xu hướng nhu cầu</h3>
            <p className="text-xs text-slate-400 mb-4">Số SKU theo từng nhóm nhu cầu — ảnh hưởng tới độ khó dự báo</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={demandData}
                layout="vertical"
                margin={{ left: 10, right: 48, top: 4, bottom: 4 }}
              >
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                <Tooltip formatter={v => [`${Number(v).toLocaleString()} SKU`, '']} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24} name="Số SKU">
                  {demandData.map(entry => (
                    <Cell key={entry.key} fill={DEMAND_COLORS[entry.key] ?? '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-slate-400 mt-3 border-t border-slate-100 pt-3">
              SKU <strong>Frequent</strong> và <strong>Active</strong> có độ tin cậy dự báo cao nhất.
              SKU <strong>Intermittent</strong> và <strong>Dormant</strong> nên được giám sát riêng.
            </p>
          </div>
        </div>
      </div>

      {/* Export section */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Xuất báo cáo</h2>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'Báo cáo toàn bộ SKU',
                desc: 'Tất cả SKU với dự báo, phân khúc, trạng thái tồn kho',
                action: handleExportFull,
              },
              {
                title: 'Báo cáo rủi ro tồn kho',
                desc: 'SKU cần hành động — nhập hàng, xem xét, kiểm tra hoàn hàng',
                action: handleExportRisk,
              },
              {
                title: 'Báo cáo SKU lợi nhuận cao',
                desc: 'Top 10% SKU theo biên lợi nhuận với trạng thái tồn kho',
                action: handleExportHighProfit,
              },
            ].map(e => (
              <div key={e.title} className="border border-slate-100 rounded-lg p-4 hover:border-slate-200 transition-colors">
                <p className="text-sm font-semibold text-slate-700">{e.title}</p>
                <p className="text-xs text-slate-400 mt-1 mb-3">{e.desc}</p>
                <button
                  onClick={e.action}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Download size={12} /> Tải CSV
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Review modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-1">
              {reviewModal.type === 'approve' ? 'Phê duyệt đề xuất' : 'Từ chối đề xuất'}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {reviewModal.type === 'approve'
                ? 'Xác nhận phê duyệt đề xuất nhập hàng từ bộ phận Kinh doanh.'
                : 'Nhập lý do từ chối để Kinh doanh biết và điều chỉnh.'}
            </p>
            <div>
              <label className="text-xs text-slate-500 block mb-1">
                {reviewModal.type === 'approve' ? 'Ghi chú phê duyệt (tuỳ chọn)' : 'Lý do từ chối'}
              </label>
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                rows={2}
                placeholder={reviewModal.type === 'approve' ? 'Ví dụ: ưu tiên nhập trong tuần này...' : 'Ví dụ: tồn kho hiện đủ 30 ngày...'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setReviewModal(null)}
                className="flex-1 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleReview}
                className={`flex-1 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  reviewModal.type === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {reviewModal.type === 'approve' ? 'Phê duyệt' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
