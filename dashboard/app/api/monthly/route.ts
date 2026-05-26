import { NextResponse } from 'next/server'
import { getMonthlyTrend } from '@/lib/data'

export async function GET() {
  const data = getMonthlyTrend()
  return NextResponse.json(data)
}
