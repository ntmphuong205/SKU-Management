'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package, TrendingUp, AlertTriangle,
  ShoppingCart, BarChart3, Activity,
} from 'lucide-react'
import KpiCard from '@/components/KpiCard'
import StatusBadge from '@/components/StatusBadge'
import { useRole } from '@/context/RoleContext'
import type { KpiSummary, MonthlyTrend } from '@/lib/types'
import {
  ComposedChart, Bar, Line,
  PieChart, Pie, Cell,
  BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

const DEMAND_COLORS: Record<string, string> = {
  Frequent:     '#22c55e',
  Active:       '#3b82f6',
  Intermittent: '#f59e0b',
  Dormant:      '#94a3b8',
}
const REL_COLORS: Record<string, string> = {
  'High Reliability':     '#22c55e',
  'Medium Reliability':   '#3b82f6',
  'Low Reliability':      '#f97316',
  'Insufficient History': '#94a3b8',
}
const PROFIT_COLORS: Record<string, string> = {
  'High Profit':   '#2563eb',
  'Medium Profit': '#60a5fa',
  'Low Profit':    '#bfdbfe',
}

interface SegItem  { key: string; name: string; value: number }
interface ProfItem { key: string; name: string; count: number; revenue: number; profit: number }
interface Segments { demandClass: SegItem[]; profitSegment: ProfItem[]; reliability: SegItem[] }

function fmt(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)} triệu`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return n.toFixed(0)
}

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number
}) {
  if (percent < 0.05) return null
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

export default function TongQuan() {
  const { role } = useRole()
  const router = useRouter()

  const [kpis, setKpis]         = useState<KpiSummary | null>(null)
  const [monthly, setMonthly]   = useState<MonthlyTrend[]>([])
  const [segments, setSegments] = useState<Segments | null>(null)
  const [topSkus, setTopSkus]   = useState<{
    ItemCode: string; forecast_56d_total: number; _status: string; recommended_action: string
  }[]>([])

  useEffect(() => {
    if (role === 'logistics') { router.replace('/canh-bao'); return }
    fetch('/api/kpis').then(r => r.json()).then(setKpis)
    fetch('/api/segments').then(r => r.json()).then(setSegments)
    fetch('/api/monthly').then(r => r.json()).then((d: MonthlyTrend[]) =>
      setMonthly(d.filter(m => m.month >= '2022-01'))
    )
    fetch('/api/skus?sort=forecast_56d_total&dir=desc&limit=10')
      .then(r => r.json())
      .then(d => setTopSkus(d.rows))
  }, [role, router])

  if (role === 'logistics') return null

  const monthlyChart = monthly.map(m => ({
    name: m.month.slice(2),
    'Số lượng bán': Math.round(m.total_qty),
    'Doanh thu (triệu)': Math.round(m.total_revenue / 1_000_000),
  }))

  const profitChart = (segments?.profitSegment ?? []).map(p => ({
    name: p.name, key: p.key,
    'Doanh thu': Math.round(p.revenue / 1_000_000),
    'Lợi nhuận': Math.round(p.profit / 1_000_000),
  }))

  const isSales   = role === 'sales'
  const isManager = role === 'manager'

  return (
    <div className="space-y-6">

      {/* ── Hero banner ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-8 pt-8 pb-6">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(99,179,237,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.15) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute top-0 left-1/3 w-96 h-32 bg-blue-600/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-500/20 rounded-full px-3 py-1 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-blue-300">Dự báo đang chạy · F1–F56</span>
            </div>
            <h1 className="text-2xl font-bold text-white leading-tight">
              {isSales ? 'Dashboard bán hàng' : 'Hệ thống Dự báo Nhu cầu'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {isSales
                ? `Dự báo doanh số · ${kpis?.active_skus.toLocaleString() ?? '—'} SKU đang bán · Cập nhật hàng ngày`
                : 'Phụ tùng ô tô · 15,972 SKU · Dữ liệu 2020–2025'}
            </p>
          </div>

          <div className="flex gap-6 flex-wrap">
            {(isSales ? [
              { label: 'Dự báo 56 ngày',    value: kpis ? fmt(kpis.total_forecast_56d) : '—', unit: 'đv', color: 'text-blue-300' },
              { label: 'SKU đang bán',       value: kpis ? kpis.active_skus.toLocaleString() : '—', unit: 'SKU', color: 'text-emerald-400' },
              { label: 'SKU lợi nhuận cao',  value: kpis ? kpis.high_profit_skus.toLocaleString() : '—', unit: 'top 10%', color: 'text-amber-300' },
            ] : [
              { label: 'Dự báo 56 ngày',    value: kpis ? fmt(kpis.total_forecast_56d) : '—', unit: 'đv', color: 'text-blue-300' },
              { label: 'SKU cần nhập ngay',  value: kpis ? kpis.action_urgent.toString() : '—', unit: 'SKU', color: 'text-red-400' },
              { label: 'SKU đang hoạt động', value: kpis ? kpis.active_skus.toLocaleString() : '—', unit: 'SKU', color: 'text-emerald-400' },
            ]).map(k => (
              <div key={k.label} className="text-right">
                <p className={`text-3xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{k.unit} · {k.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 space-y-6 pb-8">

        {/* KPI Row 1 — Dự báo (all roles) */}
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Dự báo nhu cầu</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Tổng nhu cầu 28 ngày tới" value={kpis ? fmt(kpis.total_forecast_28d) + ' units' : '—'}
              sub="F1–F28" icon={TrendingUp} variant="info" />
            <KpiCard label="Tổng nhu cầu 56 ngày tới" value={kpis ? fmt(kpis.total_forecast_56d) + ' units' : '—'}
              sub="F1–F56" icon={BarChart3} />
            <KpiCard label="SKU đang hoạt động" value={kpis ? kpis.active_skus.toLocaleString() : '—'}
              sub={`/ ${kpis?.total_skus.toLocaleString() ?? '—'} tổng SKU`} icon={Activity} variant="success" />
            <KpiCard label="SKU không còn bán" value={kpis ? kpis.dormant_skus.toLocaleString() : '—'}
              sub="Không giao dịch 180 ngày" icon={Package} />
          </div>
        </div>

        {/* KPI Row 2 — Tồn kho (manager only) */}
        {isManager && (
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Tình trạng tồn kho (mô phỏng)
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="SKU cần nhập hàng ngay" value={kpis ? kpis.action_urgent.toLocaleString() : '—'}
                sub="Nguy cơ hết hàng trong lead time" icon={AlertTriangle} variant="danger" />
              <KpiCard label="SKU nguy cơ hết hàng" value={kpis ? kpis.stockout_risk_skus.toLocaleString() : '—'}
                sub="Tồn kho dưới mức an toàn" icon={AlertTriangle} variant="warning" />
              <KpiCard label="SKU tồn kho dư" value={kpis ? kpis.overstock_skus.toLocaleString() : '—'}
                sub="Tồn kho > 1.5× nhu cầu 56 ngày" icon={Package} variant="info" />
              <KpiCard label="SKU cần xem xét" value={kpis ? kpis.action_review.toLocaleString() : '—'}
                sub="Review với bộ phận Kinh doanh" icon={ShoppingCart} />
            </div>
          </div>
        )}

        {/* Chart row: Monthly trend + Top SKU */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Xu hướng bán hàng theo tháng</h3>
            <p className="text-xs text-slate-400 mb-4">Số lượng bán (cột) và doanh thu (đường)</p>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={monthlyChart} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={2} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }}
                  tickFormatter={v => `${v}M`} />
                <Tooltip
                  formatter={(v, name) =>
                    name === 'Doanh thu (triệu)'
                      ? [`${Number(v).toLocaleString()} triệu đ`, 'Doanh thu']
                      : [`${Number(v).toLocaleString()} units`, 'Số lượng bán']
                  }
                  labelFormatter={l => `Tháng ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="Số lượng bán" fill="#2563eb" fillOpacity={0.75}
                  radius={[2, 2, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="Doanh thu (triệu)"
                  stroke="#10b981" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Top 10 SKU — Nhu cầu cao nhất</h3>
            <p className="text-xs text-slate-400 mb-4">Dự báo 56 ngày tới</p>
            <div className="space-y-2">
              {topSkus.map((s, i) => (
                <div key={s.ItemCode} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 w-4 shrink-0">{i + 1}</span>
                  <span className="text-xs font-mono font-medium text-slate-700 w-24 shrink-0 truncate">
                    {s.ItemCode}
                  </span>
                  <div className="flex-1">
                    <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          s._status === 'stockout' ? 'bg-red-400' :
                          s._status === 'overstock' ? 'bg-blue-400' : 'bg-emerald-400'
                        }`}
                        style={{
                          width: topSkus[0]
                            ? `${(s.forecast_56d_total / topSkus[0].forecast_56d_total) * 100}%`
                            : '0%',
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 w-14 text-right shrink-0">
                    {s.forecast_56d_total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart row 2: Distribution charts */}
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Phân bố danh mục SKU
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Xu hướng nhu cầu</h3>
              <p className="text-xs text-slate-400 mb-2">Tỉ lệ SKU theo loại nhu cầu</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={segments?.demandClass ?? []}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    labelLine={false}
                    label={PieLabel as never}
                  >
                    {(segments?.demandClass ?? []).map(entry => (
                      <Cell key={entry.key} fill={DEMAND_COLORS[entry.key] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${Number(v).toLocaleString()} SKU`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Doanh thu theo phân khúc</h3>
              <p className="text-xs text-slate-400 mb-2">Doanh thu & lợi nhuận (triệu đồng)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={profitChart}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 4, bottom: 4 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10 }}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}B` : `${v}M`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip formatter={v => [`${Number(v).toLocaleString()} triệu đ`, '']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                  <Bar dataKey="Doanh thu" radius={[0, 3, 3, 0]} maxBarSize={16}>
                    {profitChart.map(entry => (
                      <Cell key={entry.key} fill={PROFIT_COLORS[entry.key] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                  <Bar dataKey="Lợi nhuận" fill="#10b981" radius={[0, 3, 3, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Đặc điểm nhu cầu SKU</h3>
              <p className="text-xs text-slate-400 mb-2">Phân bố theo mức độ ổn định nhu cầu</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={segments?.reliability ?? []}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 4, bottom: 4 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={v => [`${Number(v).toLocaleString()} SKU`, '']} />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={20} name="Số SKU">
                    {(segments?.reliability ?? []).map(entry => (
                      <Cell key={entry.key} fill={REL_COLORS[entry.key] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Business summary — manager only */}
        {isManager && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Hiệu quả kinh doanh lịch sử</h3>
            <p className="text-xs text-slate-400 mb-4">Tổng hợp từ dữ liệu giao dịch 2020–2025</p>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-slate-400">Tổng doanh thu</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5">{kpis ? fmt(kpis.total_revenue) + ' đ' : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Tổng lợi nhuận</p>
                <p className="text-xl font-bold text-emerald-700 mt-0.5">{kpis ? fmt(kpis.total_profit) + ' đ' : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Biên lợi nhuận</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5">
                  {kpis && kpis.total_revenue > 0
                    ? `${((kpis.total_profit / kpis.total_revenue) * 100).toFixed(1)}%`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">SKU lợi nhuận cao (top 10%)</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5">{kpis ? kpis.high_profit_skus.toLocaleString() : '—'} SKU</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
