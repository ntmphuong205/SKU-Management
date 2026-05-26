'use client'

import { useEffect, useState } from 'react'
import {
  Package, TrendingUp, AlertTriangle,
  ShoppingCart, BarChart3, Activity,
} from 'lucide-react'
import KpiCard from '@/components/KpiCard'
import StatusBadge from '@/components/StatusBadge'
import type { KpiSummary, MonthlyTrend } from '@/lib/types'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const PAGE_HEADER = {
  title: 'Tổng quan',
  desc: 'Tình trạng nhu cầu và tồn kho toàn bộ danh mục SKU',
}

function fmt(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)} triệu`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return n.toFixed(0)
}

export default function TongQuan() {
  const [kpis, setKpis] = useState<KpiSummary | null>(null)
  const [monthly, setMonthly] = useState<MonthlyTrend[]>([])
  const [topSkus, setTopSkus] = useState<{ ItemCode: string; forecast_56d_total: number; _status: string; recommended_action: string }[]>([])

  useEffect(() => {
    fetch('/api/kpis').then(r => r.json()).then(setKpis)
    fetch('/api/monthly').then(r => r.json()).then((d: MonthlyTrend[]) =>
      setMonthly(d.filter(m => m.month >= '2022-01'))
    )
    fetch('/api/skus?sort=forecast_56d_total&dir=desc&limit=10')
      .then(r => r.json())
      .then(d => setTopSkus(d.rows))
  }, [])

  const chartData = monthly.map(m => ({
    name: m.month.slice(2), // "22-01"
    'Số lượng bán': Math.round(m.total_qty),
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-semibold text-slate-800">{PAGE_HEADER.title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{PAGE_HEADER.desc}</p>
      </div>

      {/* KPI Row 1 — Dự báo */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Dự báo nhu cầu
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Tổng nhu cầu 28 ngày tới"
            value={kpis ? fmt(kpis.total_forecast_28d) + ' units' : '—'}
            sub="Tháng 9–10/2025"
            icon={TrendingUp}
            variant="info"
          />
          <KpiCard
            label="Tổng nhu cầu 56 ngày tới"
            value={kpis ? fmt(kpis.total_forecast_56d) + ' units' : '—'}
            sub="Tháng 9–10/2025"
            icon={BarChart3}
          />
          <KpiCard
            label="SKU đang hoạt động"
            value={kpis ? kpis.active_skus.toLocaleString() : '—'}
            sub={`/ ${kpis?.total_skus.toLocaleString() ?? '—'} tổng SKU`}
            icon={Activity}
            variant="success"
          />
          <KpiCard
            label="SKU không còn bán"
            value={kpis ? kpis.dormant_skus.toLocaleString() : '—'}
            sub="Không có giao dịch 180 ngày"
            icon={Package}
          />
        </div>
      </div>

      {/* KPI Row 2 — Tồn kho */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Tình trạng tồn kho (mô phỏng)
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="SKU cần nhập hàng ngay"
            value={kpis ? kpis.action_urgent.toLocaleString() : '—'}
            sub="Nguy cơ hết hàng trong lead time"
            icon={AlertTriangle}
            variant="danger"
          />
          <KpiCard
            label="SKU nguy cơ hết hàng"
            value={kpis ? kpis.stockout_risk_skus.toLocaleString() : '—'}
            sub="Tồn kho < safety stock"
            icon={AlertTriangle}
            variant="warning"
          />
          <KpiCard
            label="SKU tồn kho dư"
            value={kpis ? kpis.overstock_skus.toLocaleString() : '—'}
            sub="Tồn kho > 1.5× nhu cầu 56 ngày"
            icon={Package}
            variant="info"
          />
          <KpiCard
            label="SKU cần xem xét"
            value={kpis ? kpis.action_review.toLocaleString() : '—'}
            sub="Review với bộ phận Kinh doanh"
            icon={ShoppingCart}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Monthly trend */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Xu hướng bán hàng theo tháng
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="qty" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip
                formatter={(v) => [`${Number(v).toLocaleString()} units`, 'Số lượng bán']}
                labelFormatter={l => `Tháng ${l}`}
              />
              <Area
                type="monotone" dataKey="Số lượng bán"
                stroke="#2563eb" strokeWidth={2}
                fill="url(#qty)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top 10 SKUs */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Top 10 SKU — Nhu cầu cao nhất (56 ngày)
          </h3>
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

      {/* Doanh thu / Lợi nhuận lịch sử */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Hiệu quả kinh doanh lịch sử</h3>
        <p className="text-xs text-slate-400 mb-4">Tổng hợp từ dữ liệu giao dịch 2020–2025</p>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-slate-400">Tổng doanh thu</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">
              {kpis ? fmt(kpis.total_revenue) + ' đ' : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Tổng lợi nhuận</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">
              {kpis ? fmt(kpis.total_profit) + ' đ' : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">SKU lợi nhuận cao (top 10%)</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">
              {kpis ? kpis.high_profit_skus.toLocaleString() : '—'} SKU
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
