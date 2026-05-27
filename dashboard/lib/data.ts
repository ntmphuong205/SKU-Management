import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import type { SkuRow, MonthlyTrend } from './types'

const PROCESSED_DIR = path.join(process.cwd(), 'data')

function readCsv<T>(filename: string): T[] {
  const filePath = path.join(PROCESSED_DIR, filename)
  if (!fs.existsSync(filePath)) return []
  const content = fs.readFileSync(filePath, 'utf-8')
  const result = Papa.parse<T>(content, { header: true, dynamicTyping: true, skipEmptyLines: true })
  return result.data
}

let _skuCache: SkuRow[] | null = null
let _monthlyCache: MonthlyTrend[] | null = null

export function getSkuData(): SkuRow[] {
  if (_skuCache) return _skuCache
  _skuCache = readCsv<SkuRow>('sku_summary.csv')
  return _skuCache
}

export function getMonthlyTrend(): MonthlyTrend[] {
  if (_monthlyCache) return _monthlyCache
  _monthlyCache = readCsv<MonthlyTrend>('monthly_trend.csv')
  return _monthlyCache
}

export function getKpiSummary(skus: SkuRow[], lt = 14, ss = 7, cov = 21) {
  const withInv = skus.map(s => {
    const afpd = s.avg_forecast_per_day || 0
    const stock = afpd * cov
    const ltDemand = afpd * lt
    const ssDemand = afpd * ss
    const proj = stock - ltDemand
    return {
      ...s,
      _stockout: proj < ssDemand,
      _overstock: stock > s.forecast_56d_total * 1.5,
    }
  })

  return {
    total_forecast_56d: skus.reduce((a, s) => a + (s.forecast_56d_total || 0), 0),
    total_forecast_28d: skus.reduce((a, s) => a + (s.forecast_28d_validation || 0), 0),
    total_skus: skus.length,
    high_profit_skus: skus.filter(s => s.profit_segment === 'High Profit').length,
    stockout_risk_skus: withInv.filter(s => s._stockout).length,
    overstock_skus: withInv.filter(s => s._overstock).length,
    action_urgent: skus.filter(s => s.recommended_action === 'Prioritize replenishment').length,
    action_review: skus.filter(s =>
      s.recommended_action === 'Review with Sales' ||
      s.recommended_action === 'Manual review required'
    ).length,
    total_revenue: skus.reduce((a, s) => a + (s.revenue || 0), 0),
    total_profit: skus.reduce((a, s) => a + Math.max(s.profit || 0, 0), 0),
    active_skus: skus.filter(s => s.demand_class !== 'Dormant').length,
    dormant_skus: skus.filter(s => s.demand_class === 'Dormant').length,
  }
}

export function enrichSku(s: SkuRow, lt: number, ss: number, cov: number) {
  const afpd = s.avg_forecast_per_day || 0
  const stock = afpd * cov
  const ltDemand = afpd * lt
  const ssDemand = afpd * ss
  const proj = stock - ltDemand
  const stockout = proj < ssDemand
  const overstock = stock > s.forecast_56d_total * 1.5
  const reorder = Math.max(0, ltDemand + ssDemand - stock)

  let status: 'stockout' | 'overstock' | 'normal'
  if (stockout) status = 'stockout'
  else if (overstock) status = 'overstock'
  else status = 'normal'

  // ── Intelligence badges ──────────────────────────────────────
  const badges: string[] = []
  const hist = s.avg_daily_sales_180 || 0
  if (hist > 0 && afpd > 0) {
    const ratio = afpd / hist
    if (ratio >= 1.5)                    badges.push('demand_spike')
    else if (ratio >= 1.2)               badges.push('emerging_trend')
  }
  if (s.demand_class === 'Dormant')      badges.push('dormant')
  if (
    s.reliability_tag === 'Low Reliability' ||
    s.reliability_tag === 'Insufficient History'
  )                                      badges.push('low_reliability')
  if (s.return_ratio > 0.1 || s.return_heavy) badges.push('high_return')

  return { ...s, _stock: stock, _ltDemand: ltDemand, _ssDemand: ssDemand,
           _proj: proj, _stockout: stockout, _overstock: overstock,
           _reorder: reorder, _status: status, _badges: badges }
}
