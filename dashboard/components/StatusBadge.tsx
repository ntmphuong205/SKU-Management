import { ACTION_LABEL, DEMAND_LABEL, PROFIT_LABEL, RELIABILITY_LABEL, BADGE_CONFIG } from '@/lib/types'

type BadgeVariant = 'action' | 'demand' | 'profit' | 'status' | 'reliability' | 'raw'

interface Props {
  value: string
  type?: BadgeVariant
}

const ACTION_DOT: Record<string, string> = {
  'Prioritize replenishment':   'bg-red-500',
  'Review with Sales':          'bg-blue-500',
  'Manual review required':     'bg-blue-500',
  'Check return/quality issue': 'bg-purple-500',
  'Review slow-moving stock':   'bg-slate-400',
  'Do not replenish':           'bg-slate-300',
}
const ACTION_TEXT: Record<string, string> = {
  'Prioritize replenishment':   'text-red-700 font-semibold',
  'Review with Sales':          'text-blue-700',
  'Manual review required':     'text-blue-700',
  'Check return/quality issue': 'text-purple-700',
  'Review slow-moving stock':   'text-slate-600',
  'Do not replenish':           'text-slate-400',
}

const DEMAND_TEXT: Record<string, string> = {
  Frequent:     'text-emerald-700',
  Active:       'text-sky-700',
  Intermittent: 'text-amber-700',
  Dormant:      'text-slate-400',
}

const PROFIT_TEXT: Record<string, string> = {
  'High Profit':   'text-emerald-700',
  'Medium Profit': 'text-slate-600',
  'Low Profit':    'text-slate-400',
}

const RELIABILITY_TEXT: Record<string, string> = {
  'High Reliability':     'text-emerald-700',
  'Medium Reliability':   'text-slate-600',
  'Low Reliability':      'text-red-600',
  'Insufficient History': 'text-slate-400',
}

export default function StatusBadge({ value, type = 'raw' }: Props) {
  if (type === 'action') {
    const label = ACTION_LABEL[value] ?? value
    const dot   = ACTION_DOT[value]  ?? 'bg-green-500'
    const text  = ACTION_TEXT[value] ?? 'text-green-700'
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs ${text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
        {label}
      </span>
    )
  }

  if (type === 'status') {
    const map: Record<string, { dot: string; text: string; label: string }> = {
      stockout:  { dot: 'bg-red-500',   text: 'text-red-700',   label: 'Hết hàng' },
      overstock: { dot: 'bg-blue-500',  text: 'text-blue-700',  label: 'Tồn kho dư' },
      normal:    { dot: 'bg-green-500', text: 'text-green-700', label: 'Bình thường' },
    }
    const s = map[value] ?? map.normal
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs ${s.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
        {s.label}
      </span>
    )
  }

  if (type === 'demand') {
    return (
      <span className={`text-xs ${DEMAND_TEXT[value] ?? 'text-slate-600'}`}>
        {DEMAND_LABEL[value] ?? value}
      </span>
    )
  }

  if (type === 'profit') {
    return (
      <span className={`text-xs ${PROFIT_TEXT[value] ?? 'text-slate-600'}`}>
        {PROFIT_LABEL[value] ?? value}
      </span>
    )
  }

  if (type === 'reliability') {
    return (
      <span className={`text-xs ${RELIABILITY_TEXT[value] ?? 'text-slate-600'}`}>
        {RELIABILITY_LABEL[value] ?? value}
      </span>
    )
  }

  return <span className="text-xs text-slate-600">{value}</span>
}

/** Intelligence signals — plain text, no pills */
export function IntelBadges({ badges }: { badges: string[] }) {
  if (!badges?.length) return null
  const labels = badges.map(k => BADGE_CONFIG[k]?.label).filter(Boolean)
  if (!labels.length) return null
  return (
    <span className="text-[11px] text-slate-400 italic">{labels.join(' · ')}</span>
  )
}
