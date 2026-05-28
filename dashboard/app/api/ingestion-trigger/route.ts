import { NextResponse } from 'next/server'

const BACKEND = process.env.INGESTION_API_URL ?? 'http://localhost:8000'

export async function POST() {
  try {
    const res = await fetch(`${BACKEND}/ingestion/trigger`, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error('backend error')
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'Backend không khả dụng' },
      { status: 503 }
    )
  }
}
