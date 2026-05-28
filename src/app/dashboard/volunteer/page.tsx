'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth, addMonths } from 'date-fns'
import { id } from 'date-fns/locale'

export default function VolunteerDashboard() {
  const supabase = createClient()
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: prof }, { data: sch }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('schedules').select(`
        *,
        services(name, time_of_day),
        service_slot_templates(slot_name)
      `)
        .eq('volunteer_id', user.id)
        .gte('scheduled_date', new Date().toISOString().split('T')[0])
        .neq('status', 'cancelled')
        .order('scheduled_date'),
    ])

    setProfile(prof)
    setSchedules(sch || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(calendarDate), end: endOfMonth(calendarDate) })
  const scheduledDates = new Set(schedules.map(s => s.scheduled_date))

  const selectedSchedules = selectedDate ? schedules.filter(s => s.scheduled_date === selectedDate) : []

  const upcomingSchedules = schedules.slice(0, 5)

  function getStatusColor(status: string) {
    if (status === 'confirmed') return 'badge-green'
    if (status === 'swapped') return 'badge-amber'
    if (status === 'cancelled') return 'badge-red'
    return 'badge-blue'
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
        <h1 className="text-2xl font-bold gradient-text">Jadwal Saya</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Halo, {profile?.full_name || 'Volunteer'}! Lihat jadwal pelayanan kamu.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{format(calendarDate, 'MMMM yyyy', { locale: id })}</h2>
            <div className="flex gap-2">
              <button onClick={() => setCalendarDate(d => addMonths(d, -1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCalendarDate(d => addMonths(d, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startOfMonth(calendarDate).getDay() }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {daysInMonth.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const hasSchedule = scheduledDates.has(dateStr)
              const isSelected = selectedDate === dateStr
              const isTodayDate = isToday(day)
              const inMonth = isSameMonth(day, calendarDate)

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`relative p-1.5 rounded-lg text-xs transition-all aspect-square flex flex-col items-center justify-center gap-0.5
                    ${!inMonth ? 'opacity-30' : ''}
                    ${isSelected ? 'bg-primary text-white' : isTodayDate ? 'border border-primary text-primary' : 'hover:bg-accent'}
                  `}
                >
                  <span className="font-medium">{format(day, 'd')}</span>
                  {hasSchedule && !isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  {hasSchedule && isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Date Detail / Upcoming */}
        <div className="glass-card p-5">
          {selectedDate ? (
            <>
              <h2 className="font-semibold text-sm mb-1">
                {format(parseISO(selectedDate), 'EEEE, d MMMM', { locale: id })}
              </h2>
              <div className="mt-4 space-y-3">
                {selectedSchedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada jadwal</p>
                ) : (
                  selectedSchedules.map(s => (
                    <div key={s.id} className="menu-card">
                      <div className="flex items-center gap-4">
                        <div className="menu-card-icon">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-primary">{s.services?.name || '—'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {s.service_slot_templates?.slot_name || '—'} 
                            {s.services?.time_of_day && ` • ${s.services.time_of_day.slice(0, 5)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${getStatusColor(s.status)}`}>
                          {statusLabels[s.status] || s.status}
                        </span>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> Jadwal Mendatang
              </h2>
              <div className="space-y-3">
                {upcomingSchedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada jadwal mendatang</p>
                ) : (
                  upcomingSchedules.map(s => (
                    <div key={s.id} className="menu-card">
                      <div className="flex items-center gap-4">
                        <div className="menu-card-icon">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-primary">{s.services?.name || '—'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(parseISO(s.scheduled_date), 'd MMM', { locale: id })} • {s.service_slot_templates?.slot_name || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${getStatusColor(s.status)}`}>
                          {statusLabels[s.status] || s.status}
                        </span>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* All upcoming schedules */}
      {schedules.length > 5 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50">
            <h2 className="font-semibold text-sm">Semua Jadwal Mendatang ({schedules.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead className="bg-secondary/50">
                <tr><th>Tanggal</th><th>Ibadah</th><th>Peran</th><th>Status</th></tr>
              </thead>
              <tbody>
                {schedules.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium">{format(parseISO(s.scheduled_date), 'd MMM yyyy', { locale: id })}</td>
                    <td className="text-muted-foreground">{s.services?.name || '—'}</td>
                    <td>{s.service_slot_templates?.slot_name || '—'}</td>
                    <td>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${getStatusColor(s.status)}`}>
                        {statusLabels[s.status] || s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
