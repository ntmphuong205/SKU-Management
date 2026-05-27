import { ACTION_LABEL, DEMAND_LABEL, PROFIT_LABEL, RELIABILITY_LABEL, BADGE_CONFIG } from '@/lib/types'

type BadgeVariant = 'action' | 'demand' | 'profit' | 'status' | 'reliability' | 'raw'

interface Props {
  value: string
  type?: BadgeVariant
}

function getActionStyle(raw: string) {
  switch (raw) {
    case 'Prioritize replenishment':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'Review with Sales':
    case 'Manual review required':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'Do not replenish':
      return 'bg-slate-100 text-slate-600 border-slate-200'
    case 'Check return/quality issue':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'Review slow-moving stock':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    default:
      return 'bg-green-100 text-green-800 border-green-200'
  }
}

function getStatusStyle(status: string) {
  if (status === 'stockout' || status === '⚠️ Nguy cơ hết hàng')
    return 'bg-red-100 text-red-800 border-red-200'
  if (status === 'overstock' || status === '📦 Tồn kho dư')
    return 'bg-blue-100 text-blue-700 border-blue-200'
  return 'bg-green-100 text-green-800 border-green-200'
}

function getDemandStyle(d: string) {
  if (d === 'Dormant')      return 'bg-slate-100 text-slate-600 border-slate-200'
  if (d === 'Intermittent') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (d === 'Frequent')     return 'bg-green-100 text-green-700 border-green-200'
  return 'bg-sky-100 text-sky-700 border-sky-200'
}

function getProfitStyle(p: string) {
  if (p === 'High Profit')   return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (p === 'Medium Profit') return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function getReliabilityStyle(r: string) {
  if (r === 'High Reliability')     return 'bg-green-100 text-green-800 border-green-200'
  if (r === 'Medium Reliability')   return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  if (r === 'Low Reliability')      return 'bg-red-100 text-red-700 border-red-200'
  if (r === 'Insufficient History') return 'bg-slate-100 text-slate-500 border-slate-300'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

export default function StatusBadge({ value, type = 'raw' }: Props) {
  let label = value
  let style = 'bg-slate-100 text-slate-600 border-slate-200'

  if (type === 'action') {
    label = ACTION_LABEL[value] ?? value
    style = getActionStyle(value)
  } else if (type === 'demand') {
    label = DEMAND_LABEL[value] ?? value
    style = getDemandStyle(value)
  } else if (type === 'profit') {
    label = PROFIT_LABEL[value] ?? value
    style = getProfitStyle(value)
  } else if (type === 'status') {
    label = value === 'stockout' ? 'Nguy cơ hết hàng'
          : value === 'overstock' ? 'Tồn kho dư'
          : 'Bình thường'
    style = getStatusStyle(value)
  } else if (type === 'reliability') {
    label = RELIABILITY_LABEL[value] ?? value
    style = getReliabilityStyle(value)
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style}`}>
      {label}
    </span>
  )
}

/** Hiển thị danh sách intelligence badges từ mảng badge keys */
export function IntelBadges({ badges }: { badges: string[] }) {
  if (!badges || badges.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map(key => {
        const cfg = BADGE_CONFIG[key]
        if (!cfg) return null
        return (
          <span
            key={key}
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.cls}`}
          >
            {cfg.label}
          </span>
        )
      })}
    </div>
  )
}
