import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MIMO_KEY  = process.env.MIMO_API_KEY
const MIMO_BASE = 'https://api.xiaomimimo.com/v1'
const MIMO_MODEL = 'mimo-v2.5-pro'

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()
  if (!prompt?.trim()) return NextResponse.json({ reply: null })
  if (!MIMO_KEY)      return NextResponse.json({ reply: null })

  try {
    const res = await fetch(`${MIMO_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MIMO_KEY}`,
      },
      body: JSON.stringify({
        model: MIMO_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_completion_tokens: 256,
      }),
      signal: AbortSignal.timeout(55000),
    })
    if (!res.ok) return NextResponse.json({ reply: null })
    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content ?? null
    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ reply: null })
  }
}
