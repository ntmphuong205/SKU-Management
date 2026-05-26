import { NextRequest, NextResponse } from 'next/server'
import { getSkuData, enrichSku } from '@/lib/data'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const lt  = Number(searchParams.get('lt')  ?? 14)
  const ss  = Number(searchParams.get('ss')  ?? 7)
  const cov = Number(searchParams.get('cov') ?? 21)

  const skus = getSkuData()
  const sku = skus.find(s => s.ItemCode === id)
  if (!sku) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(enrichSku(sku, lt, ss, cov))
}
