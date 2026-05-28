import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, Calendar, ArrowLeftRight, CheckCircle, Clock } from 'lucide-react'
import StatsCard from '@/components/ui/StatsCard'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { id } from 'date-fns/locale'

export const metadata = { title: 'PIC Ibadah | Ministry Schedule' }

export default async function PicIbadahPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*, services!fk_profiles_service(*)').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const serviceId = (profile as any).service_id

  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

  const [
    { count: totalVolunteers },
    { data: thisWeekSchedules },
    { count: pendingSwaps },
    { data: offThisWeek },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true })
      .eq('pic_ibadah_id', user.id).eq('is_active', true),
    supabase.from('schedules').select(`
      *, profiles!schedules_volunteer_id_fkey(full_name),
      service_slot_templates(slot_name)
    `).eq('service_id', serviceId || '')
      .gte('scheduled_date', weekStartStr)
      .lte('scheduled_date', weekEndStr)
      .neq('status', 'cancelled'),
    supabase.from('swap_requests').select('*', { count: 'exact', head: true })
      .eq('pic_ibadah_id', user.id).eq('status', 'pending_pic'),
    supabase.from('profiles').select('id, full_name')
      .eq('pic_ibadah_id', user.id).eq('is_active', true),
  ])

  const scheduledThisWeek = new Set(thisWeekSchedules?.map((s: any) => s.volunteer_id) || [])
  const offVolunteers = (offThisWeek || []).filter((v: any) => !scheduledThisWeek.has(v.id))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Dashboard PIC Ibadah</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {(profile as any).services?.name || 'Ibadah belum ditetapkan'} · Minggu ini ({format(weekStart, 'd MMM', { locale: id })} – {format(weekEnd, 'd MMM yyyy', { locale: id })})
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Volunteer" value={totalVolunteers ?? 0} icon={Users} color="purple" desc="Di bawah saya" />
        <StatsCard title="Pelayanan Minggu Ini" value={thisWeekSchedules?.length ?? 0} icon={Calendar} color="green" desc="Jadwal terjadwal" />
        <StatsCard title="Pending Swap" value={pendingSwaps ?? 0} icon={ArrowLeftRight} color="amber" desc="Menunggu persetujuan" />
        <StatsCard title="Tidak Tugas" value={offVolunteers.length} icon={Clock} color="blue" desc="Minggu ini" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* This Week's Schedule */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Jadwal Minggu Ini</h2>
            <Link href="/dashboard/pic-ibadah/schedule" className="text-xs text-primary hover:underline">
              Kelola jadwal
            </Link>
          </div>
          <div className="space-y-2">
            {(!thisWeekSchedules || thisWeekSchedules.length === 0) ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Belum ada jadwal minggu ini</p>
            ) : (
              thisWeekSchedules.slice(0, 6).map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-secondary/40 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                    {(s.profiles as any)?.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{(s.profiles as any)?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{(s.service_slot_templates as any)?.slot_name} · {format(new Date(s.scheduled_date + 'T00:00:00'), 'd MMM', { locale: id })}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.status === 'confirmed' ? 'badge-green' : 'badge-blue'}`}>
                    {s.status === 'confirmed' ? 'Confirmed' : 'Terjadwal'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Off This Week */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Tidak Tugas Minggu Ini</h2>
            <Link href="/dashboard/pic-ibadah/reminders" className="text-xs text-primary hover:underline">
              Kirim reminder
            </Link>
          </div>
          <div className="space-y-2">
            {offVolunteers.length === 0 ? (
              <div className="flex items-center gap-2 py-4 justify-center text-sm text-green-400">
                <CheckCircle className="w-4 h-4" />
                Semua volunteer sudah terjadwal!
              </div>
            ) : (
              offVolunteers.slice(0, 6).map((v: any) => (
                <div key={v.id} className="flex items-center gap-3 p-3 bg-secondary/40 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold flex-shrink-0">
                    {v.full_name?.charAt(0)}
                  </div>
                  <span className="text-sm font-medium flex-1">{v.full_name}</span>
                  <span className="text-[10px] text-muted-foreground">Libur</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {(pendingSwaps ?? 0) > 0 && (
        <div className="glass-card p-5 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="w-5 h-5 text-amber-400" />
              <div>
                <p className="font-semibold text-sm">{pendingSwaps} Permintaan Swap Menunggu Persetujuan</p>
                <p className="text-xs text-muted-foreground">Tinjau dan setujui permintaan tukar jadwal</p>
              </div>
            </div>
            <Link href="/dashboard/pic-ibadah/swap-approvals" className="btn-primary text-xs px-3 py-1.5">
              Tinjau Sekarang
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
