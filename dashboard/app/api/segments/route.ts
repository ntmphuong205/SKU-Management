import { NextResponse } from 'next/server'
import { getSkuData } from '@/lib/data'
import { DEMAND_LABEL, PROFIT_LABEL, RELIABILITY_LABEL } from '@/lib/types'

export async function GET() {
  const skus = getSkuData()

  // ── Demand class breakdown ──────────────────────────────────
  const demandMap: Record<string, number> = {}
  skus.forEach(s => {
    const k = s.demand_class || 'Unknown'
    demandMap[k] = (demandMap[k] || 0) + 1
  })

  // ── Profit segment breakdown (count + revenue + profit) ─────
  const profitMap: Record<string, { count: number; revenue: number; profit: number }> = {}
  skus.forEach(s => {
    const k = s.profit_segment || 'Unknown'
    if (!profitMap[k]) profitMap[k] = { count: 0, revenue: 0, profit: 0 }
    profitMap[k].count++
    profitMap[k].revenue += s.revenue || 0
    profitMap[k].profit  += Math.max(s.profit || 0, 0)
  })

  // ── Reliability tag breakdown ────────────────────────────────
  const relMap: Record<string, number> = {}
  skus.forEach(s => {
    const k = s.reliability_tag || 'Unknown'
    relMap[k] = (relMap[k] || 0) + 1
  })

  const demandOrder = ['Frequent', 'Active', 'Intermittent', 'Dormant']
  const profitOrder = ['High Profit', 'Medium Profit', 'Low Profit']
  const relOrder    = ['High Reliability', 'Medium Reliability', 'Low Reliability', 'Insufficient History']

  return NextResponse.json({
    demandClass: demandOrder
      .filter(k => demandMap[k] != null)
      .map(k => ({ key: k, name: DEMAND_LABEL[k] || k, value: demandMap[k] })),

    profitSegment: profitOrder
      .filter(k => profitMap[k] != null)
      .map(k => ({ key: k, name: PROFIT_LABEL[k] || k, ...profitMap[k] })),

    reliability: relOrder
      .filter(k => relMap[k] != null)
      .map(k => ({ key: k, name: RELIABILITY_LABEL[k] || k, value: relMap[k] })),
  })
}
