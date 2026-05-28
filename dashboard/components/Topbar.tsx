'use client'

import { Bell } from 'lucide-react'

export default function Topbar() {
  return (
    <header className="fixed top-0 left-56 right-0 h-14 z-20 bg-white border-b border-slate-200 flex items-center justify-end px-6 gap-3">

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
