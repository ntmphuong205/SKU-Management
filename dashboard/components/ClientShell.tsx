'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useRole } from '@/context/RoleContext'
import { ROLES } from '@/lib/roles'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function ClientShell({ children }: { children: ReactNode }) {
  const { role } = useRole()
  const router = useRouter()
  const pathname = usePathname()

  const isLoginPage = pathname === '/login'

  useEffect(() => {
    if (!isLoginPage && !role) {
      router.replace('/login')
    }
  }, [role, isLoginPage, router])

  useEffect(() => {
    if (role && !isLoginPage) {
      const allowed = ROLES[role].nav.map(n => n.href)
      const isAllowed = allowed.some(h => h === '/' ? pathname === '/' : pathname.startsWith(h))
      if (!isAllowed) {
        router.replace(allowed[0])
      }
    }
  }, [role, pathname, isLoginPage, router])

  if (isLoginPage) return <>{children}</>

  if (!role) return null

  return (
    <>
      <Sidebar />
      <Topbar />
      <main className="ml-56 pt-14 min-h-screen">{children}</main>
    </>
  )
}
