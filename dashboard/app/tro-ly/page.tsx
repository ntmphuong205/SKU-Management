'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  BarChart, Bar, XAxis, YAxis, Cell,
  Tooltip, ResponsiveContainer,
} from 'recharts'

interface ChartItem    { label: string; value: number; color?: string }
interface ChartPayload { title: string; unit: string; items: ChartItem[] }

interface Message {
  role: 'user' | 'assistant'
  content: string
  ts: number
  chartData?: ChartPayload
}

const WELCOME = `Xin chào! Tôi là trợ lý phân tích dữ liệu phụ tùng ô tô 🚗

Bạn có thể hỏi tôi bằng ngôn ngữ tự nhiên, ví dụ:
• "SKU-09760 có cần nhập hàng không?"
• "Có bao nhiêu SKU đang hết hàng?"
• "Top 5 SKU cần ưu tiên nhập ngay?"
• "Những SKU nào đang tồn kho dư?"
• "SKU lợi nhuận cao nhất là gì?"

Bạn muốn biết gì?`

const QUICK_PROMPTS = [
  { label: '🔴 Rủi ro cao nhất',       text: 'Top 10 SKU có rủi ro cao nhất cần xử lý ngay hôm nay?' },
  { label: '⚡ Cần nhập gấp',           text: 'SKU nào đang cần nhập hàng gấp trong tuần này?' },
  { label: '📉 Dự báo kém tin cậy',    text: 'Những SKU nào có độ tin cậy dự báo thấp nhất? Tại sao không đáng tin?' },
  { label: '📈 Nhu cầu tăng đột biến', text: 'SKU nào đang có nhu cầu tăng đột biến so với lịch sử?' },
  { label: '📦 Tồn kho dư thừa',       text: 'Tồn kho nào đang dư thừa cần giải phóng? Ưu tiên SKU lợi nhuận cao.' },
]

// ── Mini chart rendered inside assistant messages ─────────────
function MiniChart({ data }: { data: ChartPayload }) {
  const h = Math.max(120, data.items.length * 28 + 40)
  return (
    <div className="mt-3 bg-slate-50 rounded-xl border border-slate-100 px-3 pt-3 pb-1">
      <p className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">
        {data.title}
      </p>
      <ResponsiveContainer width="100%" height={h}>
        <BarChart
          data={data.items}
          layout="vertical"
          margin={{ left: 4, right: 28, top: 0, bottom: 0 }}
        >
          <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fontFamily: 'monospace' }}
            width={72} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v) => [`${Number(v).toLocaleString()} ${data.unit}`, '']}
            cursor={{ fill: '#f1f5f9' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.items.map((item, i) => (
              <Cell key={i} fill={item.color ?? '#2563eb'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
        isUser ? 'bg-blue-600' : 'bg-slate-700'
      }`}>
        {isUser
          ? <User size={14} className="text-white" />
          : <Bot size={14} className="text-white" />}
      </div>

      {/* Bubble + optional chart */}
      <div className={`max-w-[78%] ${isUser ? '' : 'w-full'}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm whitespace-pre-wrap'
            : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm prose prose-sm max-w-none prose-p:my-1 prose-headings:my-1.5 prose-ul:my-1 prose-li:my-0 prose-hr:my-2'
        }`}>
          {isUser ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
          {!isUser && msg.chartData && msg.chartData.items.length > 0 && (
            <MiniChart data={msg.chartData} />
          )}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center mt-0.5">
        <Bot size={14} className="text-white" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <span className="flex gap-1 items-center h-4">
          {[0, 150, 300].map(delay => (
            <span
              key={delay}
              className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  )
}

export default function TroLy() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME, ts: Date.now() },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { role: 'user', content: trimmed, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Gửi lịch sử hội thoại (bỏ tin nhắn chào mừng)
    const history = messages
      .filter(m => m.content !== WELCOME)
      .slice(-8)
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      })

      const contentType = res.headers.get('Content-Type') ?? ''

      if (contentType.includes('text/plain') && res.body) {
        // Streaming — hiện chữ dần
        const chartDataHeader = res.headers.get('X-Chart-Data')
        const chartData = chartDataHeader ? JSON.parse(chartDataHeader) : undefined
        setMessages(prev => [...prev, { role: 'assistant', content: '', ts: Date.now(), chartData }])
        setLoading(false)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          setMessages(prev => {
            const msgs = [...prev]
            const last = msgs[msgs.length - 1]
            msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
            return msgs
          })
        }
      } else {
        // JSON (cache hit hoặc lỗi)
        const data = await res.json()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply || 'Không có phản hồi.',
          ts: Date.now(),
          chartData: data.chartData ?? undefined,
        }])
        setLoading(false)
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Lỗi kết nối. Vui lòng thử lại.',
        ts: Date.now(),
      }])
      setLoading(false)
    } finally {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function reset() {
    setMessages([{ role: 'assistant', content: WELCOME, ts: Date.now() }])
    setInput('')
    inputRef.current?.focus()
  }

  const showQuickPrompts = messages.length <= 1

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 0px)' }}>

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles size={20} className="text-blue-600" />
            Trợ lý phân tích AI
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Hỏi đáp tự nhiên về SKU, tồn kho và dự báo nhu cầu
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
AI · 15.972 SKU
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
          >
            <RotateCcw size={12} /> Cuộc trò chuyện mới
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50">

        {/* Quick prompt chips — chỉ hiện khi chưa hỏi gì */}
        {showQuickPrompts && (
          <div className="flex flex-wrap gap-2 pb-2">
            <p className="w-full text-xs text-slate-400 font-medium mb-1">Câu hỏi gợi ý:</p>
            {QUICK_PROMPTS.map(q => (
              <button
                key={q.text}
                onClick={() => send(q.text)}
                className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors shadow-sm"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="shrink-0 bg-white border-t border-slate-200 px-6 py-4">
        <form
          onSubmit={e => { e.preventDefault(); send(input) }}
          className="flex gap-3"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder='Hỏi về SKU, tồn kho, nhu cầu… (VD: "SKU-09760 cần đặt hàng không?")'
            disabled={loading}
            className="flex-1 py-2.5 px-4 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
        <p className="text-[10px] text-slate-400 mt-2 text-center">
          Trợ lý AI có thể mắc lỗi. Kiểm tra thông tin quan trọng trước khi ra quyết định.
        </p>
      </div>
    </div>
  )
}
