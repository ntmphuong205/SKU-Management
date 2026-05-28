'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, AlertCircle, AlertTriangle, Info, LogOut, RefreshCw } from 'lucide-react'
import { useRole } from '@/context/RoleContext'
import { ROLES } from '@/lib/roles'
import { useRouter } from 'next/navigation'

type SignalType = 'critical' | 'warning' | 'info'

interface Signal {
  id: number
  type: SignalType
  time: string
  title: string
  desc: string
}

const macroSignals: Signal[] = [
  {
    id: 1, type: 'critical', time: '10 phút trước',
    title: 'Cảng Hải Phòng ùn tắc cục bộ',
    desc: 'Thời gian giao hàng thực tế tăng thêm khoảng 5 ngày. Hệ thống đã tự động điều chỉnh ngưỡng cảnh báo tồn kho để giảm nguy cơ đứt hàng trong thời gian chờ.',
  },
  {
    id: 2, type: 'warning', time: '1 giờ trước',
    title: 'Tỷ giá USD/VND tăng 1,5%',
    desc: 'Chi phí nhập khẩu dự kiến đội lên theo. Nên kiểm tra lại biên lợi nhuận các mặt hàng nhập ngoại và cân nhắc chốt đơn đặt hàng trước khi tỷ giá tiếp tục tăng.',
  },
  {
    id: 3, type: 'info', time: '3 giờ trước',
    title: 'Thuế trước bạ ô tô tăng từ tháng tới',
    desc: 'Người dùng có xu hướng giữ xe cũ lâu hơn, nhu cầu bảo dưỡng và thay thế phụ tùng dự kiến tăng. Cân nhắc tăng dự trữ cho nhóm phụ tùng bảo dưỡng định kỳ.',
  },
  {
    id: 4, type: 'warning', time: 'Hôm qua',
    title: 'Giá thép nguyên liệu tăng 5%',
    desc: 'Giá nhập phụ tùng nhóm khung gầm và thân xe dự kiến tăng trong các lô hàng tháng tới. Nên theo dõi sát biên lợi nhuận và xem xét điều chỉnh giá bán kịp thời.',
  },
  {
    id: 5, type: 'info', time: 'Hôm qua',
    title: 'Một số đối thủ đang thiếu hàng diện rộng',
    desc: 'Khách hàng có thể chuyển sang mua tại các đại lý của chúng ta. Nhu cầu nhóm phụ tùng truyền động đang có dấu hiệu tăng — đây là cơ hội cần chuẩn bị hàng sẵn.',
  },
  {
    id: 6, type: 'critical', time: '2 ngày trước',
    title: 'Cước vận tải biển tăng đột biến 15%',
    desc: 'Chi phí nhập hàng bằng đường biển tăng mạnh. Khuyến nghị đẩy nhanh các đơn đặt hàng còn trong kế hoạch và tăng lượng dự trữ cho các mặt hàng nhập khẩu chủ lực.',
  },
  {
    id: 7, type: 'warning', time: '2 ngày trước',
    title: 'Đối tác Trung Quốc nghỉ lễ tuần tới',
    desc: 'Nhà máy và cảng biển bên đó nghỉ khoảng 7 ngày, chuỗi cung ứng có thể bị chậm. Các kho hiện đang tích trữ hàng trước — chưa cần lo ngại nếu thấy tồn kho tăng tạm thời.',
  },
  {
    id: 8, type: 'info', time: '3 ngày trước',
    title: 'Mùa mưa đến sớm hơn dự báo',
    desc: 'Nhu cầu thay thế gạt mưa, đèn sương mù và các phụ kiện liên quan có thể tăng đột biến trong vài tuần tới. Nên chuẩn bị thêm hàng cho nhóm phụ kiện mùa mưa.',
  },
]

const TYPE_CFG = {
  critical: {
    Icon: AlertCircle,
    dot:    'bg-red-500',
    border: 'border-l-red-500',
    text:   'text-red-600',
    label:  'bg-red-50 text-red-700',
  },
  warning: {
    Icon: AlertTriangle,
    dot:    'bg-amber-400',
    border: 'border-l-amber-400',
    text:   'text-amber-600',
    label:  'bg-amber-50 text-amber-700',
  },
  info: {
    Icon: Info,
    dot:    'bg-blue-500',
    border: 'border-l-blue-400',
    text:   'text-blue-600',
    label:  'bg-blue-50 text-blue-700',
  },
}

const PROFILE = {
  name:   'Nguyễn Anh Phong',
  initials: 'AP',
  email:  'a.phong@autoparts.vn',
  dept:   'AutoParts FIP · 2024',
}

export default function Topbar() {
  const [open, setOpen]             = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [readIds, setReadIds]       = useState<Set<number>>(new Set())
  const bellRef    = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const { role, setRole } = useRole()
  const roleMeta = role ? ROLES[role] : null
  const router = useRouter()

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (bellRef.current    && !bellRef.current.contains(e.target as Node))    setOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function handleLogout() {
    setRole(null)
    router.push('/login')
  }

  const unread = macroSignals.filter(s => !readIds.has(s.id)).length

  function markAllRead() {
    setReadIds(new Set(macroSignals.map(s => s.id)))
  }

  function markRead(id: number) {
    setReadIds(prev => new Set([...prev, id]))
  }

  return (
    <header className="fixed top-0 left-56 right-0 h-14 z-20 bg-white border-b border-slate-200 flex items-center justify-end px-6 gap-3">

      {/* Notification Bell */}
      <div className="relative" ref={bellRef}>
        <button
          onClick={() => setOpen(v => !v)}
          className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-500"
          aria-label="Thông báo"
        >
          <Bell size={17} strokeWidth={1.8} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-[9px] text-white font-bold px-0.5">
              {unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-11 w-[400px] bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-300/30 overflow-hidden">

            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <div>
                <p className="text-sm font-semibold text-slate-800">Tín hiệu thị trường</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {unread > 0 ? `${unread} chưa đọc` : 'Đã đọc tất cả'} · Cập nhật realtime
                </p>
              </div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Đánh dấu đã đọc
                </button>
              )}
            </div>

            {/* Signal list */}
            <div className="overflow-y-auto max-h-[480px] divide-y divide-slate-50">
              {macroSignals.map(signal => {
                const cfg  = TYPE_CFG[signal.type]
                const Icon = cfg.Icon
                const read = readIds.has(signal.id)
                return (
                  <div
                    key={signal.id}
                    onClick={() => markRead(signal.id)}
                    className={`
                      flex gap-3 px-4 py-3 border-l-2 cursor-pointer transition-colors
                      ${cfg.border}
                      ${read ? 'bg-white' : 'bg-white hover:bg-slate-50'}
                      ${read ? 'opacity-55' : ''}
                    `}
                  >
                    <Icon size={14} className={`${cfg.text} shrink-0 mt-0.5`} strokeWidth={2} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold leading-tight ${read ? 'text-slate-500' : 'text-slate-800'}`}>
                          {signal.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">{signal.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{signal.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        )}
      </div>

      {/* Role chip */}
      {roleMeta && (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${roleMeta.bg} ${roleMeta.color}`}>
          {roleMeta.label}
        </span>
      )}

      {/* Avatar + profile dropdown */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => setProfileOpen(v => !v)}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-semibold cursor-pointer select-none hover:opacity-90 transition-opacity"
        >
          {PROFILE.initials}
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-11 w-64 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-300/30 overflow-hidden">
            {/* Profile header */}
            <div className="px-4 py-4 bg-slate-50/60 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {PROFILE.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{PROFILE.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{PROFILE.email}</p>
                </div>
              </div>
            </div>

            {/* Profile fields */}
            <div className="px-4 py-3 space-y-2.5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Vai trò</span>
                {roleMeta && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${roleMeta.bg} ${roleMeta.color}`}>
                    {roleMeta.label}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Hệ thống</span>
                <span className="text-[11px] text-slate-600">{PROFILE.dept}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Trạng thái</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Đang hoạt động
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="px-2 py-2 space-y-0.5">
              <button
                onClick={() => { setProfileOpen(false); router.push('/login') }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <RefreshCw size={13} className="text-slate-400" />
                Đổi vai trò
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut size={13} className="text-red-400" />
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
