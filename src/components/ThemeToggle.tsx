'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button className="sidebar-item w-full justify-between opacity-0">
        <div className="flex items-center gap-3">
          <Sun className="w-4 h-4" />
          <span>Tema</span>
        </div>
      </button>
    )
  }

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="sidebar-item w-full justify-between"
    >
      <div className="flex items-center gap-3">
        {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        <span>{isDark ? 'Mode Gelap' : 'Mode Terang'}</span>
      </div>
    </button>
  )
}
