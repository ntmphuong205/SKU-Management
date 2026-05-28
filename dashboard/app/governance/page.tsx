'use client'

import { useEffect, useState } from 'react'
import { Download, ShieldCheck, BarChart3, AlertTriangle, Package } from 'lucide-react'
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

export default function GovernancePage() {
  const [kpis, setKpis]         = useState<KpiSummary | null>(null)
  const [segments, setSegments] = useState<Segments | null>(null)
  const [riskCounts, setRiskCounts] = useState({ urgent: 0, review: 0, returns: 0, slow: 0 })

  useEffect(() => {
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

    </div>
  )
}
