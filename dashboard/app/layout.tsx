import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { RoleProvider } from '@/context/RoleContext'
import ClientShell from '@/components/ClientShell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AutoParts FIP — Demand Forecast Platform',
  description: 'Nền tảng dự báo nhu cầu và cảnh báo rủi ro tồn kho phụ tùng ô tô',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${inter.className} antialiased`}>
        <RoleProvider>
          <ClientShell>{children}</ClientShell>
        </RoleProvider>
      </body>
    </html>
  )
}
