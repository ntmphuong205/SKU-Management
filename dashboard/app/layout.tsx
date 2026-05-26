import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AutoParts — Quản lý Dự báo Nhu cầu',
  description: 'Nền tảng dự báo nhu cầu và cảnh báo rủi ro tồn kho phụ tùng ô tô',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${inter.className} bg-slate-50 text-slate-800 antialiased`}>
        <Sidebar />
        <main className="ml-56 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
