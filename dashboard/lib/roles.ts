import {
  LayoutDashboard, AlertTriangle, List,
  Search, PackageCheck, Sparkles,
  TrendingUp, Package, BarChart3, SlidersHorizontal,
} from 'lucide-react'
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

export const ROLES: Record<RoleId, RoleMeta> = {
  sales: {
    id: 'sales',
    label: 'Kinh doanh',
    subtitle: 'Dự báo doanh số & xu hướng nhu cầu',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    nav: [
      { href: '/',         label: 'Dashboard bán hàng',   icon: LayoutDashboard },
      { href: '/chi-tiet', label: 'Dự báo doanh số',      icon: TrendingUp      },
      { href: '/canh-bao', label: 'Cảnh báo thiếu hàng', icon: AlertTriangle   },
      { href: '/tro-ly',   label: 'Trợ lý AI',            icon: Sparkles        },
    ],
  },
  logistics: {
    id: 'logistics',
    label: 'Logistics',
    subtitle: 'Quản lý rủi ro tồn kho & đặt hàng',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    nav: [
      { href: '/canh-bao',  label: 'Rủi ro tồn kho',      icon: AlertTriangle },
      { href: '/danh-sach', label: 'Tồn kho & Hoàn hàng', icon: Package       },
      { href: '/chi-tiet',  label: 'Điều chỉnh SKU',       icon: SlidersHorizontal },
      { href: '/mo-phong',  label: 'Mô phỏng tồn kho',    icon: PackageCheck  },
      { href: '/tro-ly',    label: 'Trợ lý AI',            icon: Sparkles      },
    ],
  },
  manager: {
    id: 'manager',
    label: 'Quản lý',
    subtitle: 'Toàn quyền truy cập — chiến lược & giám sát',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    nav: [
      { href: '/',           label: 'Tổng quan',          icon: LayoutDashboard },
      { href: '/canh-bao',   label: 'Rủi ro toàn hệ thống', icon: AlertTriangle   },
      { href: '/danh-sach',  label: 'Danh sách SKU',      icon: List            },
      { href: '/chi-tiet',   label: 'Dự báo chi tiết',    icon: Search          },
      { href: '/mo-phong',   label: 'Tối ưu tồn kho',     icon: PackageCheck    },
      { href: '/governance', label: 'Quản trị hệ thống',   icon: BarChart3       },
      { href: '/tro-ly',     label: 'Trợ lý AI',          icon: Sparkles        },
    ],
  },
}

export const ROLE_ORDER: RoleId[] = ['sales', 'logistics', 'manager']
