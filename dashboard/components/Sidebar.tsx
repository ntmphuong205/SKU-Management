'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, LogOut } from 'lucide-react'
import { useRole } from '@/context/RoleContext'
import { ROLES } from '@/lib/roles'

export default function Sidebar() {
  const pathname = usePathname()
  const { role, setRole } = useRole()
  const router = useRouter()

  const meta = role ? ROLES[role] : null
  const nav = meta?.nav ?? []

  function handleLogout() {
    setRole(null)
    router.push('/login')
  }

  return (
    <aside className="sidebar-bg fixed top-0 left-0 h-screen w-56 flex flex-col z-30 border-r border-slate-200">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0"
            style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
            <span className="text-white font-bold text-sm">K</span>
          </div>
          <span className="font-bold text-slate-900 text-base tracking-tight">AutoParts</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                active
                  ? 'text-blue-600 bg-blue-50 font-medium'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Icon
                size={16}
                strokeWidth={active ? 2.2 : 1.8}
                className={active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500 transition-colors'}
              />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Role badge + footer */}
      <div className="px-3 py-3 border-t border-slate-100 space-y-2">
        {meta && (
          <div className={`px-3 py-2 rounded-lg border text-xs ${meta.bg}`}>
            <p className={`font-semibold ${meta.color}`}>{meta.label}</p>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-slate-600 mt-0.5 underline text-[11px]"
            >
              Đổi vai trò
            </button>
          </div>
        )}
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors">
          <Settings size={16} strokeWidth={1.8} className="text-slate-400" />
          <span>Cài đặt</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
        >
          <LogOut size={16} strokeWidth={1.8} className="text-slate-400" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  )
}
