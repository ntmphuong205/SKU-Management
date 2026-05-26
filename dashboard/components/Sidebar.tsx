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
    <aside className="fixed top-0 left-0 h-screen w-56 bg-slate-900 flex flex-col z-30">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚗</span>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">AutoParts FIP</p>
            <p className="text-slate-400 text-[11px] leading-tight">Quản lý dự báo nhu cầu</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700">
        <p className="text-slate-500 text-[10px]">Dữ liệu: 2020–2025</p>
        <p className="text-slate-500 text-[10px]">Dự báo: 56 ngày tới</p>
      </div>
    </aside>
  )
}
