export interface SkuOverride {
  sku: string
  inputPrice: number | null   // giá nhập/đv (VND) — user nhập tay
  sellPrice: number | null    // giá bán/đv (VND) — ước tính hoặc nhập tay
  planQty: number             // số lượng kế hoạch đặt
  note: string
  updatedAt: string
  updatedBy: string
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
