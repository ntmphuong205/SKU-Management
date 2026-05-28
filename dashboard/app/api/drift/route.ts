import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BACKEND = process.env.INGESTION_API_URL ?? 'http://localhost:8000'

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/drift`, {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('backend error')
    const data = await res.json()
    return NextResponse.json({ ...data, source: 'live' })
  } catch {
    return NextResponse.json({ source: 'offline' }, { status: 503 })
  }
}
