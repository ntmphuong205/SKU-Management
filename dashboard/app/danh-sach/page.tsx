'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Download } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'

interface Row {
  ItemCode: string
  profit_segment: string
  demand_class: string
  sale_days_180: number
  days_since_last_sale: number
  forecast_28d_validation: number
  forecast_56d_total: number
  _reorder: number
  _status: string
  recommended_action: string
}

const LIMIT = 50

export default function DanhSach() {
  const [rows, setRows]     = useState<Row[]>([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [profit, setProfit] = useState('')
  const [demand, setDemand] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort]     = useState('forecast_56d_total')
  const [dir, setDir]       = useState<'asc'|'desc'>('desc')
  const [page, setPage]     = useState(1)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ sort, dir, limit: String(LIMIT), page: String(page) })
    if (search) params.set('search', search)
    if (profit) params.set('profit', profit)
    if (demand) params.set('demand', demand)
    if (status) params.set('status', status)
    fetch(`/api/skus?${params}`).then(r => r.json()).then(d => {
      setRows(d.rows); setTotal(d.total); setLoading(false)
    })
  }, [search, profit, demand, status, sort, dir, page])

  useEffect(() => { setPage(1) }, [search, profit, demand, status, sort, dir])
  useEffect(() => { load() }, [load])

  async function handleExport() {
    const params = new URLSearchParams({ sort, dir, limit: '10000' })
    if (search) params.set('search', search)
    if (profit) params.set('profit', profit)
    if (demand) params.set('demand', demand)
    if (status) params.set('status', status)
    const data = await fetch(`/api/skus?${params}`).then(r => r.json())
    const exportRows: Row[] = data.rows

    const headers = ['Mã SKU', 'Phân khúc lợi nhuận', 'Xu hướng bán', 'Ngày bán (180 ngày)',
      'Bán cuối cách (ngày)', 'Dự báo 28 ngày', 'Dự báo 56 ngày', 'Cần đặt thêm', 'Trạng thái tồn kho', 'Hành động đề xuất']
    const keys: (keyof Row)[] = ['ItemCode', 'profit_segment', 'demand_class', 'sale_days_180',
      'days_since_last_sale', 'forecast_28d_validation', 'forecast_56d_total', '_reorder', '_status', 'recommended_action']

    const esc = (v: unknown) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s }
    const csv = [headers.join(','), ...exportRows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n')

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `danh-sach-sku-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function toggleSort(col: string) {
    if (sort === col) setDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSort(col); setDir('desc') }
  }

  const SortBtn = ({ col, label }: { col: string; label: string }) => (
    <button
      onClick={() => toggleSort(col)}
      className={`flex items-center gap-0.5 hover:text-slate-700 ${sort === col ? 'text-slate-700' : 'text-slate-400'}`}
    >
      {label}
      <span className="text-[10px]">{sort === col ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}</span>
    </button>
  )

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="p-6 space-y-5">
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Danh sách SKU</h1>
          <p className="text-sm text-slate-500 mt-0.5">Toàn bộ {total.toLocaleString()} SKU — tìm kiếm, lọc và sắp xếp</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Download size={13} /> Xuất CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm mã SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md w-44 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <select
          value={profit} onChange={e => setProfit(e.target.value)}
          className="py-1.5 px-2.5 text-sm border border-slate-200 rounded-md text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Tất cả phân khúc</option>
          <option value="High Profit">Lợi nhuận cao</option>
          <option value="Medium Profit">Lợi nhuận trung bình</option>
          <option value="Low Profit">Lợi nhuận thấp</option>
        </select>

        <select
          value={demand} onChange={e => setDemand(e.target.value)}
          className="py-1.5 px-2.5 text-sm border border-slate-200 rounded-md text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Tất cả xu hướng</option>
          <option value="Frequent">Bán thường xuyên</option>
          <option value="Active">Đang bán</option>
          <option value="Intermittent">Bán gián đoạn</option>
          <option value="Dormant">Không còn bán</option>
        </select>

        <select
          value={status} onChange={e => setStatus(e.target.value)}
          className="py-1.5 px-2.5 text-sm border border-slate-200 rounded-md text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="stockout">Nguy cơ hết hàng</option>
          <option value="overstock">Tồn kho dư</option>
          <option value="normal">Bình thường</option>
        </select>

        {(search || profit || demand || status) && (
          <button
            onClick={() => { setSearch(''); setProfit(''); setDemand(''); setStatus('') }}
            className="text-xs text-slate-400 hover:text-slate-700 underline"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500">Mã SKU</th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500">Phân khúc</th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500">Xu hướng bán</th>
                <th className="px-3 py-2.5 text-[11px] text-slate-500">
                  <SortBtn col="sale_days_180" label="Ngày bán (180 ngày)" />
                </th>
                <th className="px-3 py-2.5 text-[11px] text-slate-500">
                  <SortBtn col="days_since_last_sale" label="Bán cuối cách" />
                </th>
                <th className="px-3 py-2.5 text-[11px] text-slate-500">
                  <SortBtn col="forecast_28d_validation" label="DB 28 ngày" />
                </th>
                <th className="px-3 py-2.5 text-[11px] text-slate-500">
                  <SortBtn col="forecast_56d_total" label="DB 56 ngày" />
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500">Trạng thái</th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500">Hành động</th>
                <th className="px-3 py-2.5 text-[11px] text-slate-500">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-400">Đang tải…</td></tr>
              ) : rows.map(r => (
                <tr key={r.ItemCode} className="hover:bg-slate-50 text-sm transition-colors">
                  <td className="px-3 py-2.5 font-mono font-medium text-slate-800 whitespace-nowrap">
                    {r.ItemCode}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusBadge value={r.profit_segment} type="profit" />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusBadge value={r.demand_class} type="demand" />
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-600">
                    {r.sale_days_180}
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-600">
                    {r.days_since_last_sale > 999 ? '—' : `${r.days_since_last_sale} ngày`}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-slate-700">
                    {r.forecast_28d_validation?.toLocaleString(undefined,{maximumFractionDigits:1})}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-slate-700">
                    {r.forecast_56d_total?.toLocaleString(undefined,{maximumFractionDigits:1})}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusBadge value={r._status} type="status" />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusBadge value={r.recommended_action} type="action" />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Link
                      href={`/chi-tiet?sku=${r.ItemCode}`}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Xem →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
          <span className="text-xs text-slate-500">
            {total.toLocaleString()} SKU — trang {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-white disabled:opacity-40">«</button>
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-white disabled:opacity-40">‹ Trước</button>
            <span className="px-3 py-1 text-xs bg-white border border-slate-200 rounded font-medium">{page}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-white disabled:opacity-40">Sau ›</button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-white disabled:opacity-40">»</button>
          </div>
        </div>
      </div>
    </div>
  )
}
