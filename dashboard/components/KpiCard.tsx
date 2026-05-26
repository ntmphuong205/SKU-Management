import { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  sub?: string
  icon?: LucideIcon
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'info'
}

const VARIANTS = {
  default: 'bg-white border-slate-200',
  danger:  'bg-red-50  border-red-200',
  warning: 'bg-amber-50 border-amber-200',
  success: 'bg-green-50 border-green-200',
  info:    'bg-blue-50  border-blue-200',
}
const ICON_COLORS = {
  default: 'text-slate-400',
  danger:  'text-red-400',
  warning: 'text-amber-500',
  success: 'text-green-600',
  info:    'text-blue-500',
}
const VALUE_COLORS = {
  default: 'text-slate-800',
  danger:  'text-red-700',
  warning: 'text-amber-700',
  success: 'text-green-700',
  info:    'text-blue-700',
}

export default function KpiCard({
  label, value, sub, icon: Icon, variant = 'default',
}: Props) {
  return (
    <div className={`rounded-lg border p-4 ${VARIANTS[variant]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide truncate">
            {label}
          </p>
          <p className={`text-2xl font-bold mt-1 ${VALUE_COLORS[variant]}`}>
            {value}
          </p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {Icon && (
          <Icon size={20} className={`mt-1 shrink-0 ${ICON_COLORS[variant]}`} />
        )}
      </div>
    </div>
  )
}
