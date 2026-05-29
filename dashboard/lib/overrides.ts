export interface SkuOverride {
  sku: string
  multiplier: number   // 0.5 = giảm 50%, 1.0 = giữ nguyên, 2.0 = tăng gấp đôi
  note: string
  updatedAt: string    // ISO string
  updatedBy: string    // 'logistics' | 'manager'
}

const KEY = 'sku_overrides_v1'

export function getOverrides(): Record<string, SkuOverride> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function getOverride(sku: string): SkuOverride | null {
  return getOverrides()[sku] ?? null
}

export function saveOverride(ov: SkuOverride): void {
  const all = getOverrides()
  all[ov.sku] = ov
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function removeOverride(sku: string): void {
  const all = getOverrides()
  delete all[sku]
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function getAllOverrides(): SkuOverride[] {
  return Object.values(getOverrides())
}
