'use client'

import { usePathname } from 'next/navigation'
import { Calendar, Database } from 'lucide-react'

const ROUTE_META: Record<string, { title: string; desc: string }> = {
  '/':          { title: 'Tổng quan',            desc: 'Bảng điều khiển & thống kê toàn danh mục' },
  '/canh-bao':  { title: 'Cảnh báo & Hành động', desc: 'SKU cần xử lý, sắp xếp theo mức độ ưu tiên' },
  '/danh-sach': { title: 'Danh sách SKU',         desc: 'Toàn bộ danh mục — tìm kiếm, lọc và sắp xếp' },
  '/chi-tiet':  { title: 'Chi tiết SKU',          desc: 'Phân tích chuyên sâu và dự báo từng mã hàng' },
  '/mo-phong':  { title: 'Mô phỏng nhập hàng',   desc: 'Tính toán số lượng cần đặt theo kịch bản' },
  '/tro-ly':    { title: 'Trợ lý AI',             desc: 'Hỏi đáp tự nhiên về SKU và tồn kho' },
}

export default function Topbar() {
  const pathname = usePathname()

  // Match route — strip trailing slash and match prefix
  const meta =
    ROUTE_META[pathname] ??
    Object.entries(ROUTE_META)
      .filter(([k]) => k !== '/')
      .find(([k]) => pathname.startsWith(k))?.[1] ??
    { title: 'AutoParts FIP', desc: '' }

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <header className="fixed top-0 left-56 right-0 h-14 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 flex items-center px-6 gap-4">

      {/* Page title + breadcrumb */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-slate-900 leading-none">{meta.title}</h1>
        {meta.desc && (
          <p className="text-xs text-slate-400 mt-0.5 leading-none truncate">{meta.desc}</p>
        )}
      </div>

      {/* Right side — status chips */}
      <div className="flex items-center gap-3 shrink-0">

        {/* Data status */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
          <Database size={12} className="text-slate-400" />
          <span>HBAAC · 2020–2025</span>
        </div>

        <div className="w-px h-4 bg-slate-200" />

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          15,972 SKU
        </div>

        {/* Date */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
          <Calendar size={12} className="text-slate-400" />
          <span>{today}</span>
        </div>
      </div>
    </header>
  )
}
