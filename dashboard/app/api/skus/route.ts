import { NextRequest, NextResponse } from 'next/server'
import { getSkuData, enrichSku } from '@/lib/data'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lt     = Number(searchParams.get('lt')     ?? 14)
  const ss     = Number(searchParams.get('ss')     ?? 7)
  const cov    = Number(searchParams.get('cov')    ?? 21)
  const search = searchParams.get('search')        ?? ''
  const status = searchParams.get('status')        ?? ''
  const profit = searchParams.get('profit')        ?? ''
  const demand = searchParams.get('demand')        ?? ''
  const action = searchParams.get('action')        ?? ''
  const page   = Number(searchParams.get('page')   ?? 1)
  const limit  = Number(searchParams.get('limit')  ?? 50)
  const sort   = searchParams.get('sort')          ?? 'forecast_56d_total'
  const dir    = searchParams.get('dir')           ?? 'desc'

  let rows = getSkuData().map(s => enrichSku(s, lt, ss, cov))

  // Filters
  if (search) {
    const q = search.toUpperCase()
    rows = rows.filter(r => r.ItemCode.includes(q))
  }
  if (status) {
    rows = rows.filter(r => r._status === status)
  }
  if (profit) {
    rows = rows.filter(r => r.profit_segment === profit)
  }
  if (demand) {
    rows = rows.filter(r => r.demand_class === demand)
  }
  if (action) {
    rows = rows.filter(r => r.recommended_action === action)
  }

  // Sort
  rows.sort((a, b) => {
    const av = (a as Record<string, unknown>)[sort]
    const bv = (b as Record<string, unknown>)[sort]
    const an = typeof av === 'number' ? av : 0
    const bn = typeof bv === 'number' ? bv : 0
    return dir === 'asc' ? an - bn : bn - an
  })

  const total = rows.length
  const paged = rows.slice((page - 1) * limit, page * limit)

  return NextResponse.json({ total, page, limit, rows: paged })
}
