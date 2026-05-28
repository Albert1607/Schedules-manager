'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/types'
import {
  LayoutDashboard, Users, Church, Calendar, Bell, LogOut,
  Menu, X, ChevronRight, Settings, Shield, BookOpen,
  ClipboardList, ArrowLeftRight, UserCheck, Star, Map,
  Home
} from 'lucide-react'
import NotificationBell from './NotificationBell'
import { ThemeToggle } from '../ThemeToggle'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const picMinistryNav: NavItem[] = [
  { href: '/dashboard/pic-ministry', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/pic-ministry/users', label: 'Kelola Pengguna', icon: Users },
  { href: '/dashboard/pic-ministry/services', label: 'Kelola Ibadah', icon: Church },
  { href: '/dashboard/pic-ministry/regions', label: 'Kelola Wilayah', icon: Map },
  { href: '/dashboard/pic-ministry/specifications', label: 'Spesifikasi', icon: Star },
  { href: '/dashboard/pic-ministry/schedules', label: 'Semua Jadwal', icon: Calendar },
]

const picIbadahNav: NavItem[] = [
  { href: '/dashboard/pic-ibadah', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/pic-ibadah/volunteers', label: 'Volunteer Saya', icon: Users },
  { href: '/dashboard/pic-ibadah/schedule', label: 'Buat Jadwal', icon: Calendar },
  { href: '/dashboard/pic-ibadah/slots', label: 'Template Slot', icon: BookOpen },
  { href: '/dashboard/pic-ibadah/swap-approvals', label: 'Persetujuan Swap', icon: ArrowLeftRight },
  { href: '/dashboard/pic-ibadah/reminders', label: 'Reminder Minggu Ini', icon: Bell },
]

const volunteerNav: NavItem[] = [
  { href: '/dashboard/volunteer', label: 'Jadwal Saya', icon: Home },
  { href: '/dashboard/volunteer/swap-requests', label: 'Tukar Jadwal', icon: ArrowLeftRight },
]

export default function DashboardSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const navItems = profile.role === 'pic_ministry'
    ? picMinistryNav
    : profile.role === 'pic_ibadah'
    ? picIbadahNav
    : volunteerNav

  const roleLabel = {
    pic_ministry: 'PIC Ministry',
    pic_ibadah: 'PIC Ibadah',
    volunteer: 'Volunteer'
  }[profile.role]

  const roleColor = {
    pic_ministry: 'badge-purple',
    pic_ibadah: 'badge-blue',
    volunteer: 'badge-green'
  }[profile.role]

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--gradient-primary)' }}>
            <Church className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground leading-tight">Eaglekidz Ministry</p>
            <p className="text-xs text-muted-foreground">Manager</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-sm">
            {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{profile.full_name}</p>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${roleColor}`}>
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="px-3 py-4 border-t border-border/50 space-y-1">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="sidebar-item w-full text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4" />
          <span>{loggingOut ? 'Keluar...' : 'Keluar'}</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 h-screen bg-card border-r border-border/50 fixed left-0 top-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile toggle */}
      <button
        id="sidebar-toggle"
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 flex items-center justify-center bg-card border border-border rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-50 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>
    </>
  )
}
