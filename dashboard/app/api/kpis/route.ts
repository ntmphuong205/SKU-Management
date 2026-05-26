import { NextRequest, NextResponse } from 'next/server'
import { getSkuData, getKpiSummary } from '@/lib/data'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lt  = Number(searchParams.get('lt')  ?? 14)
  const ss  = Number(searchParams.get('ss')  ?? 7)
  const cov = Number(searchParams.get('cov') ?? 21)
  const skus = getSkuData()
  const kpis = getKpiSummary(skus, lt, ss, cov)
  return NextResponse.json(kpis)
}
