const STORAGE_KEY = 'autoparts_proposals'

export interface Proposal {
  id: string
  sku: string
  qty: number
  note: string
  submittedAt: string
  status: 'pending' | 'approved' | 'rejected'
  reviewedAt?: string
  reviewNote?: string
}

export function getProposals(): Proposal[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') }
  catch { return [] }
}

export function saveProposal(p: Pick<Proposal, 'sku' | 'qty' | 'note'>): void {
  const list = getProposals()
  list.unshift({ ...p, id: crypto.randomUUID(), submittedAt: new Date().toISOString(), status: 'pending' })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function updateProposal(id: string, updates: Partial<Proposal>): void {
  const list = getProposals()
  const i = list.findIndex(p => p.id === id)
  if (i !== -1) { list[i] = { ...list[i], ...updates }; localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) }
}

export function pendingCount(): number {
  return getProposals().filter(p => p.status === 'pending').length
}
