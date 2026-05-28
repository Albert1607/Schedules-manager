import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  color: 'purple' | 'blue' | 'green' | 'amber' | 'red'
  desc?: string
  change?: string
}

const colorMap = {
  purple: {
    bg: 'bg-purple-500/15',
    icon: 'text-purple-400',
    glow: 'hsla(270, 70%, 65%, 0.2)',
  },
  blue: {
    bg: 'bg-blue-500/15',
    icon: 'text-blue-400',
    glow: 'hsla(210, 90%, 65%, 0.2)',
  },
  green: {
    bg: 'bg-green-500/15',
    icon: 'text-green-400',
    glow: 'hsla(142, 70%, 50%, 0.2)',
  },
  amber: {
    bg: 'bg-amber-500/15',
    icon: 'text-amber-400',
    glow: 'hsla(38, 92%, 60%, 0.2)',
  },
  red: {
    bg: 'bg-red-500/15',
    icon: 'text-red-400',
    glow: 'hsla(0, 72%, 58%, 0.2)',
  },
}

export default function StatsCard({ title, value, icon: Icon, color, desc, change }: StatsCardProps) {
  const c = colorMap[color]

  return (
    <div className="stat-card">
      {/* Background glow */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `radial-gradient(circle at top right, ${c.glow} 0%, transparent 70%)` }} />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
          {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
          {change && (
            <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
              ↑ {change}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </div>
  )
}
