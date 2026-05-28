'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { RoleId } from '@/lib/roles'

const STORAGE_KEY = 'autoparts_role'

interface RoleCtx {
  role: RoleId | null
  setRole: (r: RoleId | null) => void
}

const Ctx = createContext<RoleCtx>({ role: null, setRole: () => {} })

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<RoleId | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as RoleId | null
    if (stored) setRoleState(stored)
    setReady(true)
  }, [])

  function setRole(r: RoleId | null) {
    setRoleState(r)
    if (r) localStorage.setItem(STORAGE_KEY, r)
    else localStorage.removeItem(STORAGE_KEY)
  }

  if (!ready) return null

  return <Ctx.Provider value={{ role, setRole }}>{children}</Ctx.Provider>
}

export function useRole() {
  return useContext(Ctx)
}
