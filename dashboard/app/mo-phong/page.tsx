'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import KpiCard from '@/components/KpiCard'
import StatusBadge from '@/components/StatusBadge'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface SkuBasic {
  ItemCode: string
  forecast_56d_total: number
  avg_forecast_per_day: number
  recommended_action: string
  _status: string
}

function MoPhongContent() {
  const searchParams = useSearchParams()
  const initSku = searchParams.get('sku') ?? ''

  const [skuList, setSkuList]           = useState<SkuBasic[]>([])
  const [selectedSku, setSelectedSku]   = useState(initSku)
  const [currentStock, setCurrentStock] = useState(0)
  const [leadTime, setLeadTime]         = useState(14)
  const [safetyDays, setSafetyDays]     = useState(7)
  const [coverageDays, setCoverage]     = useState(21)
  const [serviceLevel, setServiceLevel] = useState<'conservative'|'balanced'|'aggressive'>('balanced')

  const slMultiplier = { conservative: 1.65, balanced: 1.28, aggressive: 0.84 }[serviceLevel]

  // Load SKU list (top 200 by demand for the selector)
  useEffect(() => {
    fetch('/api/skus?sort=forecast_56d_total&dir=desc&limit=200')
      .then(r => r.json()).then(d => {
        setSkuList(d.rows)
        if (!initSku && d.rows.length > 0) setSelectedSku(d.rows[0].ItemCode)
      })
  }, [initSku])

  const skuData = skuList.find(s => s.ItemCode === selectedSku)
  const afpd    = skuData?.avg_forecast_per_day ?? 0

  // Set default current stock when SKU changes
  useEffect(() => {
    if (afpd > 0) setCurrentStock(Math.round(afpd * coverageDays))
  }, [selectedSku, afpd, coverageDays])

  const ltDemand  = afpd * leadTime
  const ssDemand  = afpd * safetyDays * slMultiplier
  const projStock = currentStock - ltDemand
  const stockout  = projStock < ssDemand
  const reorder   = Math.max(0, ltDemand + ssDemand - currentStock)

  // Build 56-day projection chart
  const chartData = Array.from({ length: 56 }, (_, i) => {
    const cumDemand = afpd * (i + 1)
    return {
      day: `Ngày ${i + 1}`,
      'Tồn kho dự kiến': Math.max(0, currentStock - cumDemand),
    }
  })
  const ssLine = afpd * safetyDays * slMultiplier

  return (
    <div className="p-6 space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-semibold text-slate-800">Mô phỏng nhập hàng</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Tính toán thời điểm và số lượng cần đặt hàng dựa trên dự báo nhu cầu
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800">
        ℹ️ <b>Lưu ý:</b> Tồn kho mô phỏng dựa trên tham số bạn nhập. Kết nối ERP/WMS để có số liệu chính xác hơn.
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Controls */}
        <div className="space-y-5">
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Chọn mã SKU</h3>
            <select
              value={selectedSku}
              onChange={e => setSelectedSku(e.target.value)}
              className="w-full py-2 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            >
              {skuList.map(s => (
                <option key={s.ItemCode} value={s.ItemCode}>{s.ItemCode}</option>
              ))}
            </select>
            {skuData && (
              <div className="mt-3 flex gap-2 flex-wrap">
                <StatusBadge value={skuData.recommended_action} type="action" />
                <StatusBadge value={skuData._status} type="status" />
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Tham số tồn kho</h3>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Tồn kho thực tế hiện tại (units)</label>
              <input
                type="number" min={0} value={currentStock}
                onChange={e => setCurrentStock(Number(e.target.value))}
                className="w-full py-2 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Thời gian chờ hàng: <b>{leadTime} ngày</b>
              </label>
              <input type="range" min={1} max={60} value={leadTime}
                onChange={e => setLeadTime(Number(e.target.value))}
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-[10px] text-slate-400"><span>1</span><span>60</span></div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Dự phòng an toàn: <b>{safetyDays} ngày</b>
              </label>
              <input type="range" min={0} max={30} value={safetyDays}
                onChange={e => setSafetyDays(Number(e.target.value))}
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-[10px] text-slate-400"><span>0</span><span>30</span></div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-2">Mức dịch vụ</label>
              <div className="flex rounded-md overflow-hidden border border-slate-200 text-xs">
                {(['conservative','balanced','aggressive'] as const).map(sl => (
                  <button key={sl} onClick={() => setServiceLevel(sl)}
                    className={`flex-1 py-1.5 font-medium transition-colors ${
                      serviceLevel === sl ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}>
                    {sl === 'conservative' ? 'An toàn (95%)' : sl === 'balanced' ? 'Cân bằng (90%)' : 'Tối ưu (80%)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="col-span-2 space-y-4">
          {/* Result KPIs */}
          <div className={`rounded-lg border-2 px-5 py-4 ${stockout ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kết quả</p>
                {stockout ? (
                  <p className="text-lg font-bold text-red-700 mt-0.5">
                    🚨 Khuyến nghị đặt hàng: <span className="text-2xl">{Math.ceil(reorder).toLocaleString()} units</span>
                  </p>
                ) : (
                  <p className="text-lg font-bold text-green-700 mt-0.5">
                    ✅ Tồn kho đủ — chưa cần đặt hàng ngay
                  </p>
                )}
              </div>
              {afpd > 0 && (
                <div className="text-right text-sm text-slate-500">
                  <p>Avg {afpd.toFixed(2)} units/ngày</p>
                  <p>Dự báo 56 ngày: {skuData?.forecast_56d_total.toLocaleString(undefined,{maximumFractionDigits:0})}</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Tồn kho hiện tại"         value={currentStock.toLocaleString()} />
            <KpiCard label={`Nhu cầu ${leadTime} ngày`} value={ltDemand.toFixed(0)} variant={stockout ? 'warning' : 'default'} />
            <KpiCard label="Safety stock tối thiểu"   value={ssDemand.toFixed(0)} />
            <KpiCard label="Tồn kho sau lead time"    value={projStock.toFixed(0)} variant={stockout ? 'danger' : 'success'} />
          </div>

          {/* Projection chart */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Dự kiến tồn kho 56 ngày tới
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={6} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} units`, 'Tồn kho dự kiến']} />
                <ReferenceLine y={ssLine} stroke="#ef4444" strokeDasharray="4 4"
                  label={{ value: `Safety stock (${ssLine.toFixed(0)})`, position: 'insideTopRight', fontSize: 11, fill: '#ef4444' }} />
                <Area type="monotone" dataKey="Tồn kho dự kiến"
                  stroke="#2563eb" strokeWidth={2} fill="url(#stockGrad)" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              Đường đỏ đứt = ngưỡng safety stock. Khi tồn kho dự kiến xuống dưới ngưỡng này → cần đặt hàng.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MoPhong() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Đang tải…</div>}>
      <MoPhongContent />
    </Suspense>
  )
}
