import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'No API key' })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
  )
  const data = await res.json()

  // Lọc chỉ model hỗ trợ generateContent
  const models = (data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent')
    )
    .map((m: { name: string; displayName: string }) => ({
      name: m.name,
      displayName: m.displayName,
    }))

  return NextResponse.json({ total: models.length, models, raw: data })
}
