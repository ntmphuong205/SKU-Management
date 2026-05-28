import { LayoutDashboard, AlertTriangle, List, Search, PackageCheck, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type RoleId = 'sales' | 'logistics' | 'manager'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export interface RoleMeta {
  id: RoleId
  label: string
  subtitle: string
  color: string
  bg: string
  nav: NavItem[]
}

const ALL_NAV: NavItem[] = [
  { href: '/',          label: 'Tổng quan',        icon: LayoutDashboard },
  { href: '/canh-bao',  label: 'Phân tích rủi ro', icon: AlertTriangle   },
  { href: '/danh-sach', label: 'Danh sách SKU',     icon: List            },
  { href: '/chi-tiet',  label: 'Dự báo chi tiết',  icon: Search          },
  { href: '/mo-phong',  label: 'Tối ưu tồn kho',   icon: PackageCheck    },
  { href: '/tro-ly',    label: 'Trợ lý AI',         icon: Sparkles        },
]

function pick(hrefs: string[]): NavItem[] {
  return hrefs.map(h => ALL_NAV.find(n => n.href === h)!).filter(Boolean)
}

export const ROLES: Record<RoleId, RoleMeta> = {
  sales: {
    id: 'sales',
    label: 'Kinh doanh',
    subtitle: 'Theo dõi dự báo và danh sách SKU',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    nav: pick(['/', '/danh-sach', '/chi-tiet', '/canh-bao', '/tro-ly']),
  },
  logistics: {
    id: 'logistics',
    label: 'Logistics',
    subtitle: 'Quản lý rủi ro tồn kho và tối ưu đặt hàng',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    nav: pick(['/canh-bao', '/danh-sach', '/chi-tiet', '/mo-phong', '/tro-ly']),
  },
  manager: {
    id: 'manager',
    label: 'Quản lý',
    subtitle: 'Toàn quyền truy cập — tổng quan và phân tích chiến lược',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    nav: pick(['/', '/canh-bao', '/danh-sach', '/chi-tiet', '/mo-phong', '/tro-ly']),
  },
}

export const ROLE_ORDER: RoleId[] = ['sales', 'logistics', 'manager']
