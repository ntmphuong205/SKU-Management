import { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  sub?: string
  icon?: LucideIcon
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'info'
}

// Top accent gradient (3px bar)
const ACCENT: Record<string, string> = {
  default: 'from-slate-300 to-slate-400',
  danger:  'from-red-400 to-rose-500',
  warning: 'from-amber-400 to-orange-400',
  success: 'from-emerald-400 to-green-500',
  info:    'from-blue-500 to-indigo-500',
}

// Icon wrapper background
const ICON_BG: Record<string, string> = {
  default: 'bg-slate-100 text-slate-500',
  danger:  'bg-red-50 text-red-500',
  warning: 'bg-amber-50 text-amber-500',
  success: 'bg-emerald-50 text-emerald-600',
  info:    'bg-blue-50 text-blue-600',
}

// Value text color
const VALUE_COLOR: Record<string, string> = {
  default: 'text-slate-900',
  danger:  'text-red-600',
  warning: 'text-amber-600',
  success: 'text-emerald-700',
  info:    'text-blue-700',
}

export default function KpiCard({
  label, value, sub, icon: Icon, variant = 'default',
}: Props) {
  return (
    <div className="relative bg-white rounded-xl border border-slate-100 shadow-sm shadow-slate-200/60 overflow-hidden hover:shadow-md hover:shadow-slate-200/80 transition-shadow duration-200">

      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${ACCENT[variant]}`} />

      <div className="px-4 pt-4 pb-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider leading-none truncate">
            {label}
          </p>
          <p className={`text-2xl font-bold mt-2 leading-none tabular-nums ${VALUE_COLOR[variant]}`}>
            {value}
          </p>
          {sub && (
            <p className="text-xs text-slate-400 mt-1.5 leading-snug">{sub}</p>
          )}
        </div>

        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ICON_BG[variant]}`}>
            <Icon size={17} strokeWidth={1.8} />
          </div>
        )}
      </div>
    </div>
  )
}
