import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BACKEND = process.env.INGESTION_API_URL ?? 'http://localhost:8000'

export async function GET() {
  try {
    const [statusRes, historyRes] = await Promise.all([
      fetch(`${BACKEND}/status`, { signal: AbortSignal.timeout(4000), cache: 'no-store' }),
      fetch(`${BACKEND}/ingestion/history?limit=10`, { signal: AbortSignal.timeout(4000), cache: 'no-store' }),
    ])

    if (!statusRes.ok || !historyRes.ok) throw new Error('backend error')

    const status  = await statusRes.json()
    const history = await historyRes.json()

    return NextResponse.json({ ...status, history: history.history, source: 'live' })
  } catch {
    return NextResponse.json(
      { source: 'offline', error: 'Backend không khả dụng' },
      { status: 503 }
    )
  }
}
