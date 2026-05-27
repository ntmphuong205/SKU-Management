'use client'

import { Bell, Search } from 'lucide-react'

export default function Topbar() {
  return (
    <header className="fixed top-0 left-56 right-0 h-14 z-20 bg-white border-b border-slate-200 flex items-center px-6 gap-4">

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm SKU, sản phẩm, đơn hàng…"
          className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors placeholder:text-slate-400"
        />
      </div>

      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Bell */}
        <button className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-500">
          <Bell size={17} strokeWidth={1.8} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 border-2 border-white" />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-semibold cursor-pointer select-none">
          AP
        </div>
      </div>
    </header>
  )
}
