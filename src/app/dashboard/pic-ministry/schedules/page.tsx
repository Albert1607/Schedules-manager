import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'
import { Calendar } from 'lucide-react'

export const metadata = { title: 'Semua Jadwal | Ministry Schedule' }

export default async function AllSchedulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: schedules } = await supabase
    .from('schedules')
    .select(`
      *,
      services(name, regions(name)),
      profiles!schedules_volunteer_id_fkey(full_name),
      service_slot_templates(slot_name)
    `)
    .gte('scheduled_date', new Date().toISOString().split('T')[0])
    .neq('status', 'cancelled')
    .order('scheduled_date')
    .limit(100)

  const statusColors: Record<string, string> = {
    scheduled: 'badge-blue',
    confirmed: 'badge-green',
    swapped: 'badge-amber',
    cancelled: 'badge-red',
  }
  const statusLabels: Record<string, string> = {
    scheduled: 'Terjadwal',
    confirmed: 'Confirmed',
    swapped: 'Ditukar',
    cancelled: 'Dibatalkan',
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Semua Jadwal</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview jadwal pelayanan semua ibadah</p>
      </div>

      <div className="glass-card overflow-hidden">
        {(!schedules || schedules.length === 0) ? (
          <div className="py-16 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Belum ada jadwal yang dibuat</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead className="bg-secondary/50">
                <tr>
                  <th>Tanggal</th>
                  <th>Ibadah</th>
                  <th>Wilayah</th>
                  <th>Peran</th>
                  <th>Volunteer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(schedules as any[]).map(s => (
                  <tr key={s.id}>
                    <td className="font-medium whitespace-nowrap">
                      {format(parseISO(s.scheduled_date), 'd MMM yyyy', { locale: id })}
                    </td>
                    <td>{s.services?.name || '—'}</td>
                    <td className="text-muted-foreground">{(s.services as any)?.regions?.name || '—'}</td>
                    <td className="text-muted-foreground">{s.service_slot_templates?.slot_name || '—'}</td>
                    <td>{(s.profiles as any)?.full_name || '—'}</td>
                    <td>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColors[s.status] || 'badge-blue'}`}>
                        {statusLabels[s.status] || s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
