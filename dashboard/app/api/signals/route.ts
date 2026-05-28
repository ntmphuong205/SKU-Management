import { NextResponse } from 'next/server'

const RSS_FEEDS = [
  'https://vnexpress.net/rss/kinh-doanh.rss',
  'https://vnexpress.net/rss/oto-xe-may.rss',
  'https://vnexpress.net/rss/the-gioi.rss',
]

const CRITICAL_KW = [
  'đứt gãy', 'thiếu hàng', 'ùn tắc', 'đóng cửa', 'khủng hoảng',
  'sự cố', 'tăng đột biến', 'giảm đột biến', 'ngừng sản xuất', 'khan hàng',
  'đình công', 'lũ lụt', 'thiên tai', 'bão',
]
const WARNING_KW = [
  'tỷ giá', 'lãi suất', 'thuế', 'giá tăng', 'tăng giá', 'cước vận tải',
  'chi phí tăng', 'rủi ro', 'cảnh báo', 'giá thép', 'nguyên liệu', 'lạm phát',
  'USD', 'nhập khẩu khó', 'hải quan', 'kiểm tra chặt',
]

// Only show news relevant to auto-parts / supply chain / economics
const RELEVANT_KW = [
  'ô tô', 'xe', 'phụ tùng', 'linh kiện', 'nhập khẩu', 'xuất khẩu',
  'tỷ giá', 'USD', 'vận chuyển', 'logistics', 'chuỗi cung ứng', 'hàng hóa',
  'thuế', 'giá', 'thép', 'nguyên liệu', 'cảng', 'container', 'kho',
  'doanh nghiệp', 'thương mại', 'kinh doanh', 'thị trường',
]

function isRelevant(text: string): boolean {
  const t = text.toLowerCase()
  return RELEVANT_KW.some(k => t.includes(k))
}

function classify(text: string): 'critical' | 'warning' | 'info' {
  const t = text.toLowerCase()
  if (CRITICAL_KW.some(k => t.includes(k))) return 'critical'
  if (WARNING_KW.some(k => t.includes(k)))  return 'warning'
  return 'info'
}

function stripHtml(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#\d+;/g, '').replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (isNaN(diff) || diff < 0) return 'Vừa xong'
  if (diff < 3600)  return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  return `${Math.floor(diff / 86400)} ngày trước`
}

function parseItems(xml: string) {
  const items: { title: string; desc: string; pubDate: string }[] = []
  const re = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const s = m[1]
    const title   = stripHtml(s.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '')
    const desc    = stripHtml(s.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ?? '')
    const pubDate = (s.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '').trim()
    if (title) items.push({ title, desc, pubDate })
  }
  return items
}

export async function GET() {
  try {
    const results = await Promise.allSettled(
      RSS_FEEDS.map(url =>
        fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(5000) })
          .then(r => r.text())
      )
    )

    const xmls = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map(r => r.value)

    if (xmls.length === 0) {
      return NextResponse.json({ error: 'all_feeds_failed' }, { status: 503 })
    }

    const all = xmls.flatMap(parseItems)

    // Sort newest first
    all.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

    // Keep relevant items, fall back to top items if not enough
    const relevant = all.filter(i => isRelevant(i.title + ' ' + i.desc))
    const pool = relevant.length >= 6 ? relevant : all

    const signals = pool.slice(0, 10).map((item, i) => ({
      id: i + 1,
      type: classify(item.title + ' ' + item.desc),
      time: timeAgo(item.pubDate),
      title: item.title.length > 80 ? item.title.slice(0, 77) + '…' : item.title,
      desc: item.desc.length > 220 ? item.desc.slice(0, 217) + '…' : item.desc,
    }))

    return NextResponse.json({
      signals,
      refreshedAt: new Date().toISOString(),
      source: 'vnexpress',
    })
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  }
}
