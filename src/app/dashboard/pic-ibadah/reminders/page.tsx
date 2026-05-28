import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { id } from 'date-fns/locale'
import { Bell, CheckCircle, Phone } from 'lucide-react'

export const metadata = { title: 'Reminders | Ministry Schedule' }

export default async function RemindersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('service_id').eq('id', user.id).single()
  const serviceId = (profile as any)?.service_id

  const today = new Date()
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [{ data: scheduled }, { data: allVol }] = await Promise.all([
    supabase.from('schedules').select(`
      *, profiles!schedules_volunteer_id_fkey(id, full_name, email, phone),
      service_slot_templates(slot_name)
    `).eq('service_id', serviceId || '').gte('scheduled_date', weekStart).lte('scheduled_date', weekEnd).neq('status', 'cancelled'),
    supabase.from('profiles').select('id, full_name, email, phone').eq('pic_ibadah_id', user.id).eq('is_active', true),
  ])

  const scheduledIds = new Set((scheduled || []).map((s: any) => s.profiles?.id).filter(Boolean))
  const offVolunteers = (allVol || []).filter((v: any) => !scheduledIds.has(v.id))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Reminder Minggu Ini</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(weekStart), 'd MMM', { locale: id })} – {format(new Date(weekEnd), 'd MMM yyyy', { locale: id })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Serving this week */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Pelayanan Minggu Ini</h2>
              <p className="text-xs text-muted-foreground">{(scheduled || []).length} jadwal</p>
            </div>
          </div>
          <div className="space-y-2">
            {(scheduled || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada jadwal minggu ini</p>
            ) : (
              (scheduled as any[]).map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-secondary/40 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs font-bold flex-shrink-0">
                    {s.profiles?.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.profiles?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.service_slot_templates?.slot_name} · {format(new Date(s.scheduled_date + 'T00:00:00'), 'd MMM', { locale: id })}
                    </p>
                  </div>
                  {s.profiles?.phone && (
                    <a href={`https://wa.me/${s.profiles.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-500/15 hover:bg-green-500/25 transition-colors">
                      <Phone className="w-3.5 h-3.5 text-green-400" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Not serving this week */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Bell className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Tidak Tugas Minggu Ini</h2>
              <p className="text-xs text-muted-foreground">{offVolunteers.length} volunteer</p>
            </div>
          </div>
          <div className="space-y-2">
            {offVolunteers.length === 0 ? (
              <div className="flex items-center gap-2 py-4 justify-center text-sm text-green-400">
                <CheckCircle className="w-4 h-4" />
                Semua volunteer sudah terjadwal!
              </div>
            ) : (
              offVolunteers.map((v: any) => (
                <div key={v.id} className="flex items-center gap-3 p-3 bg-secondary/40 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold flex-shrink-0">
                    {v.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{v.full_name}</p>
                    <p className="text-xs text-muted-foreground">{v.email}</p>
                  </div>
                  {v.phone && (
                    <a href={`https://wa.me/${v.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500/15 hover:bg-amber-500/25 transition-colors"
                      title="Hubungi via WhatsApp">
                      <Phone className="w-3.5 h-3.5 text-amber-400" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="glass-card p-5 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <strong className="text-foreground">Tip:</strong> Klik ikon <Phone className="w-3.5 h-3.5 inline text-green-400" /> untuk menghubungi volunteer via WhatsApp.
          Sistem notifikasi in-app otomatis terkirim saat jadwal dibuat.
        </p>
      </div>
    </div>
  )
}
