'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, AlertCircle, AlertTriangle, Info } from 'lucide-react'

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
    desc: 'Lead time thực tế tăng +5 ngày. Ngưỡng cảnh báo Stockout trên UI đã tự động nới rộng để khớp với Lead time mới.',
  },
  {
    id: 2, type: 'warning', time: '1 giờ trước',
    title: 'Tỷ giá USD/VND biến động (+1.5%)',
    desc: 'Cost Amount nhập khẩu dự kiến tăng. Cập nhật lại rank profit_pct. Model v89 đã rút trọng số dự báo các mã rớt khỏi top 30% LN.',
  },
  {
    id: 3, type: 'info', time: '3 giờ trước',
    title: 'Chính sách thuế xe mới tăng',
    desc: 'Người dân có xu hướng giữ xe cũ. Đề xuất: Dùng tính năng Mô phỏng để tăng tay hệ số dự báo (+10%) cho cụm SKU "Bảo dưỡng định kỳ".',
  },
  {
    id: 4, type: 'warning', time: 'Hôm qua',
    title: 'Giá nguyên liệu Thép tăng 5%',
    desc: 'Cảnh báo Unit Cost của nhóm phụ tùng khung gầm sẽ tăng vào lô hàng tháng sau. Chú ý theo dõi Biên lợi nhuận gộp.',
  },
  {
    id: 5, type: 'info', time: 'Hôm qua',
    title: 'Đối thủ X đứt hàng diện rộng',
    desc: 'Cầu dịch chuyển. Biến trend (Nhu cầu 28 ngày / 84 ngày) của nhóm truyền động tăng vọt > 1.2. Mô hình v85 đã tự động tăng dự báo.',
  },
  {
    id: 6, type: 'critical', time: '2 ngày trước',
    title: 'Cước vận tải biển tăng vọt',
    desc: 'Chi phí Logistics tăng 15%. Hệ thống gợi ý: Tạm khóa dự báo dài hạn và tăng Safety Stock thêm 20% cho nhóm hàng chủ lực.',
  },
  {
    id: 7, type: 'warning', time: '2 ngày trước',
    title: 'Sắp tới kỳ nghỉ lễ đối tác (Trung Quốc)',
    desc: 'Gián đoạn chuỗi cung ứng 7 ngày. Đã tạm ẩn các cảnh báo "Overstock" trong tuần tới do các kho đang chủ động dồn hàng dự trữ.',
  },
  {
    id: 8, type: 'info', time: '3 ngày trước',
    title: 'Bản tin Thời tiết: Mùa mưa đến sớm',
    desc: 'Dự báo nhu cầu thay thế cần gạt mưa và đèn sương mù tăng. Trọng số dow_factor cuối tuần đang được điều chỉnh tăng.',
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

export default function Topbar() {
  const [open, setOpen]       = useState(false)
  const [readIds, setReadIds] = useState<Set<number>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

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
      <div className="relative" ref={ref}>
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

      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-semibold cursor-pointer select-none">
        AP
      </div>
    </header>
  )
}
