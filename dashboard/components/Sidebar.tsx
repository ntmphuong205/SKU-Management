'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, AlertTriangle, List,
  Search, PackageCheck, Sparkles,
} from 'lucide-react'

const NAV = [
  { href: '/',          label: 'Tổng quan',            icon: LayoutDashboard },
  { href: '/canh-bao',  label: 'Cảnh báo & Hành động', icon: AlertTriangle   },
  { href: '/danh-sach', label: 'Danh sách SKU',         icon: List            },
  { href: '/chi-tiet',  label: 'Chi tiết SKU',          icon: Search          },
  { href: '/mo-phong',  label: 'Mô phỏng nhập hàng',   icon: PackageCheck    },
  { href: '/tro-ly',    label: 'Trợ lý AI',             icon: Sparkles        },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sidebar-bg fixed top-0 left-0 h-screen w-56 flex flex-col z-30 border-r border-white/5">

      {/* ── Logo ─────────────────────────────────────────────── */}
      <div className="px-4 py-5 border-b border-white/8">
        <div className="flex items-center gap-3">
          {/* Icon mark */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40 shrink-0">
            <Sparkles size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight tracking-tight">AutoParts FIP</p>
            <p className="text-slate-500 text-[10px] leading-tight mt-0.5">Demand Forecast Platform</p>
          </div>
        </div>
      </div>

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
          Menu
        </p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                active
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium shadow-lg shadow-blue-900/30'
                  : 'text-slate-400 hover:bg-white/6 hover:text-white'
              }`}
            >
              <Icon
                size={15}
                strokeWidth={active ? 2.5 : 1.8}
                className={active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300 transition-colors'}
              />
              <span className="truncate">{label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-200/70 shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ───────────────────────────────────────────── */}
      <div className="px-4 py-4 border-t border-white/8">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[11px] text-slate-400 font-medium">15,972 SKU · Live</span>
        </div>
        <p className="text-[10px] text-slate-600 leading-relaxed">
          Dữ liệu 2020–2025<br />
          Dự báo horizon: 56 ngày
        </p>
      </div>
    </aside>
  )
}
