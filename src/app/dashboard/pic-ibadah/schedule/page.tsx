'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateSchedule, getQuarterBounds, getCurrentQuarter, getQuarterOptions } from '@/lib/schedule-generator'
import { triggerScheduleEmails } from '@/app/actions/email'
import { Calendar, Shuffle, Trash2, Plus, Loader2, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns'
import { id } from 'date-fns/locale'

export default function SchedulePage() {
  const supabase = createClient()
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [service, setService] = useState<any>(null)
  const [schedules, setSchedules] = useState<any[]>([])
  const [slots, setSlots] = useState<any[]>([])
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [volSpecs, setVolSpecs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter())
  const [extraDates, setExtraDates] = useState<string[]>([])
  const [newExtraDate, setNewExtraDate] = useState('')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data: profile } = await supabase.from('profiles').select('service_id').eq('id', user.id).single()
    const svcId = (profile as any)?.service_id
    setServiceId(svcId)

    if (!svcId) { setLoading(false); return }

    const [{ data: svc }, { data: sch }, { data: sl }, { data: vol }, { data: vs }] = await Promise.all([
      supabase.from('services').select('*').eq('id', svcId).single(),
      supabase.from('schedules').select(`
        *, 
        profiles!schedules_volunteer_id_fkey(id, full_name),
        service_slot_templates(slot_name)
      `).eq('service_id', svcId).eq('quarter', selectedQuarter).order('scheduled_date'),
      supabase.from('service_slot_templates').select('*').eq('service_id', svcId),
      supabase.from('profiles').select('*').eq('pic_ibadah_id', user.id).eq('is_active', true),
      supabase.from('volunteer_specifications').select(`*, specification_levels(id, order_index, label)`),
    ])

    setService(svc)
    setSchedules(sch || [])
    setSlots(sl || [])
    setVolunteers(vol || [])
    setVolSpecs(vs || [])
    setLoading(false)
  }, [selectedQuarter])

  useEffect(() => { loadData() }, [loadData])

  async function handleGenerate() {
    if (!serviceId || !service) return
    if (!confirm(`Generate jadwal untuk ${selectedQuarter}? Jadwal yang sudah ada untuk kuartal ini akan dihapus.`)) return

    setGenerating(true)
    setMsg(null)

    try {
      // Clear existing schedules for this quarter
      await supabase.from('schedules').delete().eq('service_id', serviceId).eq('quarter', selectedQuarter)

      const { start, end } = getQuarterBounds(selectedQuarter)
      const entries = generateSchedule({
        serviceId,
        quarter: selectedQuarter,
        startDate: start,
        endDate: end,
        slots,
        volunteers,
        volunteerSpecs: volSpecs,
        serviceDayOfWeek: service.day_of_week ?? 0,
        extraDates,
      })

      if (entries.length === 0) {
        setMsg({ type: 'error', text: 'Tidak ada entri jadwal yang bisa dibuat. Pastikan ada volunteer dan template slot.' })
        setGenerating(false)
        return
      }

      // Insert in batches
      const batchSize = 50
      const emailPayloads: any[] = []
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize).map(e => ({ ...e, created_by: currentUserId }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('schedules').insert(batch)
        if (error) throw error

        // Prepare email payloads
        batch.forEach(e => {
          const vol = volunteers.find(v => v.id === e.volunteer_id)
          const slot = slots.find(s => s.id === e.slot_template_id)
          if (vol && vol.email && slot) {
            emailPayloads.push({
              email: vol.email,
              name: vol.full_name,
              serviceName: service.name,
              date: format(parseISO(e.scheduled_date as string), 'd MMMM yyyy', { locale: id }),
              slotName: slot.slot_name
            })
          }
        })
      }

      if (emailPayloads.length > 0) {
        await triggerScheduleEmails(emailPayloads)
      }

      setMsg({ type: 'success', text: `Berhasil membuat ${entries.length} jadwal untuk ${selectedQuarter} dan mengirim email notifikasi!` })
      await loadData()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setGenerating(false)
    }
  }

  async function handleClearQuarter() {
    if (!confirm(`Hapus SEMUA jadwal kuartal ${selectedQuarter}?`)) return
    setClearing(true)
    await supabase.from('schedules').delete().eq('service_id', serviceId!).eq('quarter', selectedQuarter)
    await loadData()
    setClearing(false)
  }

  // Calendar helpers
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(calendarDate), end: endOfMonth(calendarDate) })
  const scheduledDates = new Set(schedules.map(s => s.scheduled_date))

  function getSchedulesForDate(dateStr: string) {
    return schedules.filter(s => s.scheduled_date === dateStr)
  }

  const selectedDateSchedules = selectedDate ? getSchedulesForDate(selectedDate) : []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Jadwal Pelayanan</h1>
          <p className="text-sm text-muted-foreground mt-1">{service?.name || 'Ibadah belum ditetapkan'}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedQuarter}
            onChange={e => setSelectedQuarter(e.target.value)}
            className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
          >
            {getQuarterOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating || !serviceId || slots.length === 0 || volunteers.length === 0}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
            id="generate-schedule-btn"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Auto Generate'}
          </button>
          {schedules.length > 0 && (
            <button
              onClick={handleClearQuarter}
              disabled={clearing}
              className="px-3 py-2 border border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Hapus Kuartal
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${msg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-destructive/10 border-destructive/20 text-red-400'}`}>
          {msg.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm">{msg.text}</p>
        </div>
      )}

      {slots.length === 0 && serviceId && (
        <div className="glass-card p-4 border-l-4 border-amber-500 text-sm text-amber-300">
          ⚠️ Belum ada template slot. Buat template slot terlebih dahulu agar jadwal bisa di-generate.
        </div>
      )}

      {/* Extra Dates */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-sm mb-3">Tanggal Ibadah Tambahan</h2>
        <p className="text-xs text-muted-foreground mb-3">Tambahkan tanggal ibadah di luar jadwal reguler (hari besar, ibadah khusus, dll.)</p>
        <div className="flex gap-2 mb-3">
          <input
            type="date"
            value={newExtraDate}
            onChange={e => setNewExtraDate(e.target.value)}
            className="form-input flex-1"
          />
          <button
            onClick={() => {
              if (newExtraDate && !extraDates.includes(newExtraDate)) {
                setExtraDates(prev => [...prev, newExtraDate].sort())
                setNewExtraDate('')
              }
            }}
            className="px-4 py-2 bg-primary/15 text-primary border border-primary/30 rounded-lg text-sm hover:bg-primary/25 transition-colors flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>
        {extraDates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {extraDates.map(d => (
              <span key={d} className="flex items-center gap-1.5 text-xs bg-secondary px-2.5 py-1 rounded-full">
                {format(parseISO(d), 'd MMM yyyy', { locale: id })}
                <button onClick={() => setExtraDates(prev => prev.filter(x => x !== d))} className="text-muted-foreground hover:text-destructive">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">
              {format(calendarDate, 'MMMM yyyy', { locale: id })}
            </h2>
            <div className="flex gap-2">
              <button onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors">
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
            {/* Empty cells for start of month */}
            {Array.from({ length: startOfMonth(calendarDate).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {daysInMonth.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const hasSchedule = scheduledDates.has(dateStr)
              const isSelected = selectedDate === dateStr
              const isTodayDate = isToday(day)
              const count = getSchedulesForDate(dateStr).length

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`relative p-1.5 rounded-lg text-xs transition-all aspect-square flex flex-col items-center justify-center gap-0.5
                    ${isSelected ? 'bg-primary text-white' : isTodayDate ? 'border border-primary text-primary' : 'hover:bg-accent'}
                    ${!isSameMonth(day, calendarDate) ? 'opacity-30' : ''}
                  `}
                >
                  <span className="font-medium">{format(day, 'd')}</span>
                  {hasSchedule && !isSelected && (
                    <div className="w-1 h-1 rounded-full bg-primary" />
                  )}
                  {hasSchedule && isSelected && (
                    <span className="text-[9px] opacity-80">{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Date Detail */}
        <div className="glass-card p-5">
          {!selectedDate ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
              <Calendar className="w-10 h-10 opacity-30 mb-3" />
              <p className="text-sm">Klik tanggal untuk melihat jadwal</p>
            </div>
          ) : (
            <>
              <h2 className="font-semibold text-sm mb-1">
                {format(parseISO(selectedDate), 'EEEE, d MMMM yyyy', { locale: id })}
              </h2>
              <p className="text-xs text-muted-foreground mb-4">{selectedDateSchedules.length} jadwal</p>
              <div className="space-y-2">
                {selectedDateSchedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada jadwal di tanggal ini</p>
                ) : (
                  selectedDateSchedules.map(s => (
                    <div key={s.id} className="p-3 bg-secondary/40 rounded-lg">
                      <p className="text-sm font-medium">{s.profiles?.full_name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{s.service_slot_templates?.slot_name || '—'}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded mt-1 inline-block ${
                        s.status === 'confirmed' ? 'badge-green' : s.status === 'swapped' ? 'badge-amber' : 'badge-blue'
                      }`}>{s.status}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Schedule table */}
      {schedules.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50">
            <h2 className="font-semibold text-sm">Daftar Jadwal — {selectedQuarter} ({schedules.length} entri)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead className="bg-secondary/50">
                <tr>
                  <th>Tanggal</th>
                  <th>Slot / Peran</th>
                  <th>Volunteer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {schedules.slice(0, 30).map(s => (
                  <tr key={s.id}>
                    <td className="font-medium">{format(parseISO(s.scheduled_date), 'd MMM yyyy', { locale: id })}</td>
                    <td className="text-muted-foreground">{s.service_slot_templates?.slot_name || '—'}</td>
                    <td>{s.profiles?.full_name || '—'}</td>
                    <td>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        s.status === 'confirmed' ? 'badge-green' : s.status === 'swapped' ? 'badge-amber' : 'badge-blue'
                      }`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {schedules.length > 30 && (
              <p className="text-xs text-center text-muted-foreground py-3">Menampilkan 30 dari {schedules.length} jadwal</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
