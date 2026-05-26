export interface SkuRow {
  ItemCode: string
  revenue: number
  cost: number
  profit: number
  total_sales_qty: number
  sale_days_total: number
  last_sale_date: string
  total_return_qty: number
  sale_days_180: number
  sale_days_365: number
  avg_daily_sales_180: number
  net_qty: number
  days_since_last_sale: number
  return_ratio: number
  profit_percentile: number
  forecast_28d_validation: number
  forecast_28d_evaluation: number
  forecast_56d_total: number
  avg_forecast_per_day: number
  model_disagreement: number
  profit_segment: string
  demand_class: string
  return_heavy: boolean
  stockout_flag: boolean
  overstock_flag: boolean
  reorder_qty: number
  reliability_tag: string
  risk_level: string
  recommended_action: string
  priority_level: string
  reason_codes: string
}

export interface MonthlyTrend {
  month: string
  total_qty: number
  total_revenue: number
}

export interface KpiSummary {
  total_forecast_56d: number
  total_forecast_28d: number
  total_skus: number
  high_profit_skus: number
  stockout_risk_skus: number
  overstock_skus: number
  action_urgent: number
  action_review: number
  total_revenue: number
  total_profit: number
  active_skus: number
  dormant_skus: number
}

// Vietnamese business labels
export const ACTION_LABEL: Record<string, string> = {
  'Prioritize replenishment': 'Nhập hàng ngay',
  'Review with Sales': 'Cần xem xét',
  'Manual review required': 'Cần xem xét',
  'Monitor closely': 'Theo dõi',
  'Do not replenish': 'Không nhập thêm',
  'Check return/quality issue': 'Kiểm tra hoàn hàng',
  'Review slow-moving stock': 'Hàng tồn chậm',
}

export const DEMAND_LABEL: Record<string, string> = {
  Frequent: 'Bán thường xuyên',
  Active: 'Đang bán',
  Intermittent: 'Bán gián đoạn',
  Dormant: 'Không còn bán',
}

export const PROFIT_LABEL: Record<string, string> = {
  'High Profit': 'Lợi nhuận cao',
  'Medium Profit': 'Lợi nhuận trung bình',
  'Low Profit': 'Lợi nhuận thấp',
}

export type ActionType =
  | 'urgent'
  | 'review'
  | 'monitor'
  | 'no-replenish'
  | 'return'
  | 'slow'

export function getActionType(raw: string): ActionType {
  if (raw === 'Prioritize replenishment') return 'urgent'
  if (raw === 'Review with Sales' || raw === 'Manual review required') return 'review'
  if (raw === 'Do not replenish') return 'no-replenish'
  if (raw === 'Check return/quality issue') return 'return'
  if (raw === 'Review slow-moving stock') return 'slow'
  return 'monitor'
}
