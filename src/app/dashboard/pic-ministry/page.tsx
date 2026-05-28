import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, Church, Calendar, TrendingUp, MapPin, Shield } from 'lucide-react'
import StatsCard from '@/components/ui/StatsCard'
import Link from 'next/link'

export const metadata = { title: 'PIC Ministry — Overview | Ministry Schedule' }

export default async function PicMinistryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { count: totalVolunteers },
    { count: totalPicIbadah },
    { count: totalServices },
    { count: totalSchedules },
    { data: recentUsers },
    { data: services },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'volunteer').eq('is_active', true),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'pic_ibadah').eq('is_active', true),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('schedules').select('*', { count: 'exact', head: true }).gte('scheduled_date', new Date().toISOString().split('T')[0]),
    supabase.from('profiles').select('id, full_name, role, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('services').select('id, name, region_id, regions(name), pic_ibadah_id, profiles!services_pic_ibadah_id_fkey(full_name)').eq('is_active', true).limit(5),
  ])

  const stats = [
    { title: 'Total Volunteer', value: totalVolunteers ?? 0, icon: Users, color: 'purple' as const, desc: 'Aktif' },
    { title: 'PIC Ibadah', value: totalPicIbadah ?? 0, icon: Shield, color: 'blue' as const, desc: 'Aktif' },
    { title: 'Ibadah Aktif', value: totalServices ?? 0, icon: Church, color: 'green' as const, desc: 'Terdaftar' },
    { title: 'Jadwal Mendatang', value: totalSchedules ?? 0, icon: Calendar, color: 'amber' as const, desc: 'Ke depan' },
  ]

  const roleColors: Record<string, string> = {
    pic_ministry: 'badge-purple',
    pic_ibadah: 'badge-blue',
    volunteer: 'badge-green',
  }
  const roleLabels: Record<string, string> = {
    pic_ministry: 'PIC Ministry',
    pic_ibadah: 'PIC Ibadah',
    volunteer: 'Volunteer',
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold gradient-text">Dashboard PIC Ministry</h1>
        <p className="text-muted-foreground text-sm mt-1">Kelola semua aspek pelayanan dari satu tempat</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatsCard key={s.title} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Pengguna Terbaru</h2>
            <Link href="/dashboard/pic-ministry/users" className="text-xs text-primary hover:underline">
              Lihat semua
            </Link>
          </div>
          <div className="space-y-3">
            {recentUsers?.map((u) => (
              <div key={u.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0">
                  {u.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${roleColors[u.role as string]}`}>
                  {roleLabels[u.role as string]}
                </span>
              </div>
            ))}
            {(!recentUsers || recentUsers.length === 0) && (
              <p className="text-sm text-muted-foreground">Belum ada pengguna</p>
            )}
          </div>
        </div>

        {/* Active Services */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Ibadah Aktif</h2>
            <Link href="/dashboard/pic-ministry/services" className="text-xs text-primary hover:underline">
              Kelola semua
            </Link>
          </div>
          <div className="space-y-3">
            {services?.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0">
                  <Church className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.regions?.name || 'Tanpa wilayah'} · {s.profiles?.full_name || 'Belum ada PIC'}
                  </p>
                </div>
              </div>
            ))}
            {(!services || services.length === 0) && (
              <p className="text-sm text-muted-foreground">Belum ada ibadah terdaftar</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-sm mb-4">Aksi Cepat</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/dashboard/pic-ministry/users', label: 'Tambah User', icon: Users },
            { href: '/dashboard/pic-ministry/services', label: 'Tambah Ibadah', icon: Church },
            { href: '/dashboard/pic-ministry/regions', label: 'Kelola Wilayah', icon: MapPin },
            { href: '/dashboard/pic-ministry/specifications', label: 'Kelola Spesifikasi', icon: TrendingUp },
          ].map((a) => (
            <Link key={a.href} href={a.href}
              className="flex flex-col items-center gap-2 p-4 bg-secondary/50 hover:bg-accent rounded-xl transition-colors text-center group">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                <a.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs font-medium">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
