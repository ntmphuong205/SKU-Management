import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GEMINI_KEY = process.env.GEMINI_API_KEY
const BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite']

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()
  if (!prompt?.trim()) return NextResponse.json({ reply: '' })

  if (!GEMINI_KEY) return NextResponse.json({ reply: null })

  for (const model of MODELS) {
    try {
      const res = await fetch(`${BASE}/models/${model}:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (reply) return NextResponse.json({ reply })
    } catch {
      continue
    }
  }

  return NextResponse.json({ reply: null })
}
