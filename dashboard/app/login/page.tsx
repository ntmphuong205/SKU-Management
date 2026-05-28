'use client'

import { useRouter } from 'next/navigation'
import { useRole } from '@/context/RoleContext'
import { ROLES, ROLE_ORDER } from '@/lib/roles'

export default function LoginPage() {
  const { setRole } = useRole()
  const router = useRouter()

  function choose(id: Parameters<typeof setRole>[0]) {
    setRole(id)
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div
          className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center"
          style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
        >
          <span className="text-white font-bold text-base">K</span>
        </div>
        <div>
          <p className="font-bold text-slate-900 text-lg leading-tight">AutoParts FIP</p>
          <p className="text-xs text-slate-400">Nền tảng Dự báo Thông minh</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-200/50 p-8 w-full max-w-lg">
        <h1 className="text-xl font-semibold text-slate-800 text-center">Chọn vai trò của bạn</h1>
        <p className="text-sm text-slate-400 text-center mt-1 mb-8">
          Hệ thống sẽ hiển thị dữ liệu phù hợp với vai trò bạn chọn
        </p>

        <div className="space-y-3">
          {ROLE_ORDER.map(id => {
            const meta = ROLES[id]
            return (
              <button
                key={id}
                onClick={() => choose(id)}
                className={`w-full text-left px-5 py-4 rounded-xl border-2 ${meta.bg} hover:shadow-sm transition-all duration-150 group`}
              >
                <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{meta.subtitle}</p>
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-6">
        Không có xác thực — chỉ dùng cho demo nội bộ
      </p>
    </div>
  )
}
