import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GEMINI_KEY = process.env.GEMINI_API_KEY
const BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']

const RSS_FEEDS = [
  'https://vnexpress.net/rss/kinh-doanh.rss',
  'https://vnexpress.net/rss/oto-xe-may.rss',
  'https://vnexpress.net/rss/the-gioi.rss',
]

const RELEVANT_KW = [
  'ô tô', 'xe', 'phụ tùng', 'linh kiện', 'nhập khẩu', 'xuất khẩu',
  'tỷ giá', 'USD', 'vận chuyển', 'logistics', 'chuỗi cung ứng',
  'thuế', 'giá thép', 'nguyên liệu', 'cảng', 'container',
  'lạm phát', 'lãi suất', 'kinh tế', 'thị trường', 'thương mại',
]

function stripHtml(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#\d+;/g, '').replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function parseItems(xml: string): { title: string; desc: string }[] {
  const items: { title: string; desc: string }[] = []
  const re = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const s = m[1]
    const title = stripHtml(s.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '')
    const desc  = stripHtml(s.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ?? '')
    if (title) items.push({ title, desc })
  }
  return items
}

async function callGemini(prompt: string): Promise<string> {
  for (const model of MODELS) {
    try {
      const url = `${BASE}/models/${model}:generateContent?key=${GEMINI_KEY}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (text) return text
    } catch {
      continue
    }
  }
  throw new Error('Gemini không phản hồi')
}

export async function GET() {
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: 'no_api_key' }, { status: 503 })
  }

  // Fetch RSS
  const results = await Promise.allSettled(
    RSS_FEEDS.map(url =>
      fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.text())
    )
  )
  const xmls = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map(r => r.value)

  if (xmls.length === 0) {
    return NextResponse.json({ error: 'rss_failed' }, { status: 503 })
  }

  // Get relevant headlines
  const all = xmls.flatMap(parseItems)
  const relevant = all.filter(i =>
    RELEVANT_KW.some(k => (i.title + ' ' + i.desc).toLowerCase().includes(k))
  )
  const pool = relevant.length >= 5 ? relevant : all
  const headlines = pool.slice(0, 8)

  const headlineText = headlines
    .map((h, i) => `${i + 1}. ${h.title}${h.desc ? ' — ' + h.desc.slice(0, 120) : ''}`)
    .join('\n')

  const prompt = `Bạn là chuyên gia chuỗi cung ứng tại doanh nghiệp phân phối phụ tùng ô tô Việt Nam.

Các tin tức thị trường hôm nay:
${headlineText}

Hãy viết ngắn gọn bằng tiếng Việt:
1. Một đoạn tóm tắt 2–3 câu về tình hình thị trường từ góc độ chuỗi cung ứng phụ tùng ô tô.
2. 2–3 điểm cần lưu ý trong vận hành kho hàng và đặt hàng ngày hôm nay.

Format bắt buộc (giữ nguyên từ khóa đầu dòng):
SUMMARY: [đoạn tóm tắt]
BULLET: [điểm 1]
BULLET: [điểm 2]
BULLET: [điểm 3 nếu cần]`

  try {
    const raw = await callGemini(prompt)

    const lines = raw.split('\n')

    // Gom tất cả dòng từ SUMMARY: đến trước BULLET: đầu tiên
    const summaryStart = lines.findIndex(l => l.startsWith('SUMMARY:'))
    const bulletStart  = lines.findIndex(l => l.startsWith('BULLET:'))
    let summary = ''
    if (summaryStart !== -1) {
      const end = bulletStart !== -1 ? bulletStart : lines.length
      const summaryLines = lines.slice(summaryStart, end)
      summaryLines[0] = summaryLines[0].replace('SUMMARY:', '')
      summary = summaryLines.join(' ').replace(/\s+/g, ' ').trim()
    } else {
      summary = lines[0] ?? ''
    }

    const bulletLines = lines.filter(l => l.startsWith('BULLET:'))
    const bullets = bulletLines.map(l => l.replace('BULLET:', '').trim()).filter(Boolean)

    return NextResponse.json({
      summary,
      bullets,
      generatedAt: new Date().toISOString(),
      headlineCount: headlines.length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'ai_failed', detail: String(err) },
      { status: 503 }
    )
  }
}
