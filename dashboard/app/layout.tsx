import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AutoParts FIP — Demand Forecast Platform',
  description: 'Nền tảng dự báo nhu cầu và cảnh báo rủi ro tồn kho phụ tùng ô tô',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${inter.className} antialiased`}>
        <Sidebar />
        <Topbar />
        {/* ml-56 = sidebar width, pt-14 = topbar height */}
        <main className="ml-56 pt-14 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
