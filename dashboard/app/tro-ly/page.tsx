'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, RotateCcw } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  ts: number
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
  { label: '🔴 SKU cần nhập ngay', text: 'Danh sách top 5 SKU cần nhập hàng ngay?' },
  { label: '📦 Tồn kho dư', text: 'Những SKU nào đang bị tồn kho dư?' },
  { label: '📊 Tổng quan', text: 'Cho tôi tổng quan tình hình tồn kho và dự báo hiện tại' },
  { label: '💰 Lợi nhuận cao', text: 'Top SKU có lợi nhuận cao nhất là gì?' },
  { label: '📈 Nhu cầu lớn', text: 'Top 5 SKU có nhu cầu cao nhất 56 ngày tới?' },
]

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

      {/* Bubble */}
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
      }`}>
        {msg.content}
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
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply || 'Không có phản hồi.',
        ts: Date.now(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Lỗi kết nối. Vui lòng thử lại.',
        ts: Date.now(),
      }])
    } finally {
      setLoading(false)
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
            Gemini AI · 15,972 SKU
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
