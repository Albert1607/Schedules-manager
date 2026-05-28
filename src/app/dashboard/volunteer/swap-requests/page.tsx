'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { triggerSwapRequestEmail } from '@/app/actions/email'
import { respondToSwapRequest } from '@/app/actions/swap'
import { ArrowLeftRight, Plus, Loader2, X, Clock, CheckCircle, XCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'

export default function SwapRequestsPage() {
  const supabase = createClient()
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [incomingRequests, setIncomingRequests] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'outgoing' | 'incoming'>('outgoing')
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [mySchedules, setMySchedules] = useState<any[]>([])
  const [otherVolunteers, setOtherVolunteers] = useState<any[]>([])
  const [volSchedules, setVolSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [availableTargets, setAvailableTargets] = useState<any[]>([])
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [currentUserName, setCurrentUserName] = useState<string>('')
  const [picIbadahId, setPicIbadahId] = useState<string | null>(null)

  const [form, setForm] = useState({
    type: 'swap' as 'swap' | 'replacement',
    schedule_id: '',
    target_volunteer_id: '',
    replacement_schedule_id: '',
    reason: '',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data: profile } = await supabase.from('profiles').select('full_name, pic_ibadah_id').eq('id', user.id).single()
    setPicIbadahId((profile as any)?.pic_ibadah_id)
    setCurrentUserName((profile as any)?.full_name)

    const [{ data: myReqs }, { data: incomingReqs }, { data: mySchs }, { data: others }] = await Promise.all([
      supabase.from('swap_requests').select(`
        *,
        schedule:schedules!swap_requests_schedule_id_fkey(scheduled_date, service_slot_templates(slot_name), services(name)),
        target_volunteer:profiles!swap_requests_target_volunteer_id_fkey(full_name)
      `).eq('requester_id', user.id).order('created_at', { ascending: false }),
      supabase.from('swap_requests').select(`
        *,
        requester:profiles!swap_requests_requester_id_fkey(full_name),
        schedule:schedules!swap_requests_schedule_id_fkey(scheduled_date, service_slot_templates(slot_name), services(name)),
        replacement_schedule:schedules!swap_requests_replacement_schedule_id_fkey(scheduled_date, service_slot_templates(slot_name))
      `).eq('target_volunteer_id', user.id).order('created_at', { ascending: false }),
      supabase.from('schedules').select(`
        *, services(name), service_slot_templates(slot_name)
      `).eq('volunteer_id', user.id)
        .gte('scheduled_date', new Date().toISOString().split('T')[0])
        .eq('status', 'scheduled').order('scheduled_date'),
      supabase.from('profiles').select('id, full_name, email').eq('pic_ibadah_id', (profile as any)?.pic_ibadah_id || '').neq('id', user.id).eq('is_active', true),
    ])

    setMyRequests(myReqs || [])
    setIncomingRequests(incomingReqs || [])
    setMySchedules(mySchs || [])
    setOtherVolunteers(others || [])
    setAvailableTargets(others || [])
    setLoading(false)
  }, [])

  async function handleResponse(requestId: string, accept: boolean) {
    if (!window.confirm(`Apakah Anda yakin ingin ${accept ? 'menyetujui' : 'menolak'} permintaan swap ini?`)) {
      return
    }
    setActioningId(requestId + (accept ? '_accept' : '_reject'))
    const res = await respondToSwapRequest(requestId, accept)
    if (!res.success) {
      alert(res.error)
    } else {
      await loadData()
    }
    setActioningId(null)
  }

  useEffect(() => { loadData() }, [loadData])

  async function loadVolunteerSchedules(volunteerId: string) {
    if (!volunteerId) { setVolSchedules([]); return }
    const { data } = await supabase.from('schedules').select(`
      *, services(name), service_slot_templates(slot_name)
    `).eq('volunteer_id', volunteerId)
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .eq('status', 'scheduled').order('scheduled_date')
    setVolSchedules(data || [])
  }

  async function handleScheduleChange(scheduleId: string) {
    setForm(f => ({ ...f, schedule_id: scheduleId, target_volunteer_id: '', replacement_schedule_id: '' }))
    if (!scheduleId) {
      setAvailableTargets(otherVolunteers)
      return
    }

    const selectedSchedule = mySchedules.find(s => s.id === scheduleId)
    if (!selectedSchedule) return
    
    setLoadingTargets(true)
    const date = new Date(selectedSchedule.scheduled_date)
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]

    // Find all volunteer_ids who are scheduled in this month
    const { data: monthSchedules } = await supabase.from('schedules').select('volunteer_id')
      .gte('scheduled_date', startOfMonth)
      .lte('scheduled_date', endOfMonth)
      .eq('status', 'scheduled')
      
    const busyIds = new Set((monthSchedules || []).map(s => s.volunteer_id))
    
    const available = otherVolunteers.filter(v => !busyIds.has(v.id))
    setAvailableTargets(available)
    setLoadingTargets(false)
  }

  async function handleSubmit() {
    if (!form.schedule_id) { setError('Pilih jadwal yang ingin ditukar'); return }
    if (!form.target_volunteer_id) { setError('Pilih volunteer target'); return }

    setSaving(true)
    setError('')

    const payload = {
      requester_id: currentUserId,
      schedule_id: form.schedule_id,
      target_volunteer_id: form.target_volunteer_id,
      replacement_schedule_id: form.type === 'swap' && form.replacement_schedule_id ? form.replacement_schedule_id : null,
      type: form.type,
      status: 'pending_pic' as const,
      pic_ibadah_id: picIbadahId,
      reason: form.reason || null,
    }

    const { error: e } = await supabase.from('swap_requests').insert(payload)
    if (e) { setError(e.message); setSaving(false); return }

    // Notify PIC Ibadah
    if (picIbadahId) {
      await supabase.from('notifications').insert({
        user_id: picIbadahId,
        title: '🔄 Permintaan Swap Baru',
        body: `Ada permintaan tukar jadwal yang membutuhkan persetujuan Anda.`,
        type: 'swap',
      })
    }

    // Trigger email if there is a target volunteer
    if (form.target_volunteer_id) {
      const target = otherVolunteers.find(v => v.id === form.target_volunteer_id)
      const schedule = mySchedules.find(s => s.id === form.schedule_id)
      if (target && target.email && schedule) {
        await triggerSwapRequestEmail(
          target.email,
          target.full_name,
          currentUserName || 'Volunteer',
          schedule.services?.name || 'Ibadah',
          format(parseISO(schedule.scheduled_date), 'd MMMM yyyy', { locale: id }),
          form.reason
        )
      }
    }

    await loadData()
    setShowModal(false)
    setSaving(false)
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string; icon: any }> = {
      pending_pic: { cls: 'badge-amber', label: 'Menunggu PIC', icon: Clock },
      pending_volunteer: { cls: 'badge-blue', label: 'Menunggu Volunteer', icon: Clock },
      approved: { cls: 'badge-green', label: 'Disetujui', icon: CheckCircle },
      rejected: { cls: 'badge-red', label: 'Ditolak', icon: XCircle },
    }
    return map[status] || { cls: 'badge-blue', label: status, icon: Clock }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Tukar Jadwal</h1>
          <p className="text-sm text-muted-foreground mt-1">Request swap atau cari pengganti untuk jadwalmu</p>
        </div>
        <button
          id="create-swap-btn"
          onClick={() => { setForm({ type: 'swap', schedule_id: '', target_volunteer_id: '', replacement_schedule_id: '', reason: '' }); setError(''); setShowModal(true) }}
          disabled={mySchedules.length === 0}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Request Swap
        </button>
      </div>

      {mySchedules.length === 0 && (
        <div className="glass-card p-5 text-center text-muted-foreground text-sm">
          Kamu tidak memiliki jadwal mendatang yang bisa ditukar.
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${activeTab === 'outgoing' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Permintaan Keluar
        </button>
        <button
          onClick={() => setActiveTab('incoming')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-all relative ${activeTab === 'incoming' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Permintaan Masuk
          {incomingRequests.filter(r => r.status === 'pending_volunteer').length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full">
              {incomingRequests.filter(r => r.status === 'pending_volunteer').length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : activeTab === 'outgoing' ? (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground">Riwayat Permintaan Keluar (Saya yang Mengajukan)</h2>
          {myRequests.length === 0 ? (
            <div className="glass-card py-12 text-center">
              <ArrowLeftRight className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Belum ada permintaan swap keluar</p>
            </div>
          ) : (
            myRequests.map(req => {
              const { cls, label, icon: Icon } = statusBadge(req.status)
              return (
                <div key={req.id} className="glass-card p-5 animate-fade-in">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm">{req.schedule?.services?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {req.schedule?.scheduled_date ? format(parseISO(req.schedule.scheduled_date), 'd MMMM yyyy', { locale: id }) : '—'} ·
                        {' '}{req.schedule?.service_slot_templates?.slot_name || '—'}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${cls}`}>
                      <Icon className="w-3 h-3" /> {label}
                    </span>
                  </div>

                  {req.target_volunteer && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Tukar dengan: <span className="text-foreground font-medium">{req.target_volunteer.full_name}</span>
                    </p>
                  )}
                  {req.type === 'replacement' && (
                    <p className="text-xs text-amber-400 mb-2">Open replacement — menunggu volunteer pengganti</p>
                  )}
                  {req.reason && (
                    <p className="text-xs text-muted-foreground p-2 bg-secondary/40 rounded-lg mb-2">
                      <span className="text-foreground">Alasan: </span>{req.reason}
                    </p>
                  )}
                  {req.pic_note && (
                    <p className="text-xs text-muted-foreground p-2 bg-secondary/40 rounded-lg">
                      <span className="text-foreground">Catatan PIC: </span>{req.pic_note}
                    </p>
                  )}

                  <p className="text-[10px] text-muted-foreground/60 mt-3">
                    {format(parseISO(req.created_at), 'd MMM yyyy HH:mm', { locale: id })}
                  </p>
                </div>
              )
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground">Permintaan Masuk (Butuh Konfirmasi Saya)</h2>
          {incomingRequests.length === 0 ? (
            <div className="glass-card py-12 text-center">
              <ArrowLeftRight className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Belum ada permintaan swap masuk</p>
            </div>
          ) : (
            incomingRequests.map(req => {
              const { cls, label, icon: Icon } = statusBadge(req.status)
              const isActionable = req.status === 'pending_volunteer'
              return (
                <div key={req.id} className="glass-card p-5 animate-fade-in">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm">{req.schedule?.services?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.schedule?.scheduled_date ? format(parseISO(req.schedule.scheduled_date), 'd MMMM yyyy', { locale: id }) : '—'} ·
                        {' '}{req.schedule?.service_slot_templates?.slot_name || '—'}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${cls}`}>
                      <Icon className="w-3 h-3" /> {label}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="p-3 bg-secondary/40 rounded-lg">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Pengirim (Meminta Swap)</p>
                      <p className="text-sm font-medium">{req.requester?.full_name || '—'}</p>
                    </div>
                    <div className="p-3 bg-secondary/40 rounded-lg">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Jadwal Anda yang Diambil</p>
                      {req.type === 'swap' && req.replacement_schedule ? (
                        <>
                          <p className="text-sm font-medium">
                            {format(parseISO(req.replacement_schedule.scheduled_date), 'd MMM yyyy', { locale: id })}
                          </p>
                          <p className="text-xs text-muted-foreground">{req.replacement_schedule.service_slot_templates?.slot_name || '—'}</p>
                        </>
                      ) : (
                        <p className="text-sm text-amber-400">Hanya menggantikan (Replacement)</p>
                      )}
                    </div>
                  </div>

                  {req.reason && (
                    <p className="text-xs text-muted-foreground p-2 bg-secondary/40 rounded-lg mb-3">
                      <span className="text-foreground">Alasan: </span>{req.reason}
                    </p>
                  )}
                  {req.pic_note && (
                    <p className="text-xs text-muted-foreground p-2 bg-secondary/40 rounded-lg mb-3">
                      <span className="text-foreground">Catatan PIC: </span>{req.pic_note}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-4">
                    <span>
                      {format(parseISO(req.created_at), 'd MMM yyyy HH:mm', { locale: id })}
                    </span>

                    {isActionable && (
                      <div className="flex gap-2">
                        <button
                          disabled={actioningId !== null}
                          onClick={() => handleResponse(req.id, false)}
                          className="flex items-center gap-1 px-3 py-1.5 border border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-xs disabled:opacity-50"
                        >
                          {actioningId === req.id + '_reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Tolak
                        </button>
                        <button
                          disabled={actioningId !== null}
                          onClick={() => handleResponse(req.id, true)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-xs disabled:opacity-50"
                        >
                          {actioningId === req.id + '_accept' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Terima
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Swap Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold">Request Tukar Jadwal</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
              {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-red-400">{error}</div>}

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Tipe Request</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['swap', 'replacement'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, type: t, target_volunteer_id: '', replacement_schedule_id: '' }))}
                      className={`p-3 rounded-xl border text-sm font-medium transition-all ${form.type === t ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-secondary/50 text-muted-foreground hover:bg-accent'}`}
                    >
                      {t === 'swap' ? '🔄 Tukar dengan Volunteer Lain' : '🙋 Cari Pengganti (Open)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* My schedule */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Jadwal Saya yang Ingin Ditukar *</label>
                <select value={form.schedule_id} onChange={e => handleScheduleChange(e.target.value)} className="form-input">
                  <option value="">Pilih jadwal...</option>
                  {mySchedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {format(parseISO(s.scheduled_date), 'd MMM yyyy', { locale: id })} — {s.services?.name} ({s.service_slot_templates?.slot_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Target volunteer (required for both swap & replacement) */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Volunteer Target *</label>
                <select
                  value={form.target_volunteer_id}
                  onChange={e => {
                    setForm(f => ({ ...f, target_volunteer_id: e.target.value, replacement_schedule_id: '' }))
                    if (form.type === 'swap') loadVolunteerSchedules(e.target.value)
                  }}
                  className="form-input"
                  disabled={!form.schedule_id || loadingTargets}
                >
                  <option value="">{loadingTargets ? 'Memuat volunteer...' : 'Pilih volunteer...'}</option>
                  {availableTargets.map(v => <option key={v.id} value={v.id}>{v.full_name}</option>)}
                </select>
                {form.schedule_id && availableTargets.length === 0 && !loadingTargets && (
                  <p className="text-xs text-red-400 mt-2">Tidak ada volunteer yang kosong di bulan ini.</p>
                )}
              </div>

              {/* Swap: pick replacement schedule */}
              {form.type === 'swap' && form.target_volunteer_id && volSchedules.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1.5">Jadwal Mereka yang Akan Diambil (opsional)</label>
                      <select value={form.replacement_schedule_id} onChange={e => setForm(f => ({ ...f, replacement_schedule_id: e.target.value }))} className="form-input">
                        <option value="">Pilih jadwal (opsional)...</option>
                        {volSchedules.map(s => (
                          <option key={s.id} value={s.id}>
                            {format(parseISO(s.scheduled_date), 'd MMM yyyy', { locale: id })} — {s.service_slot_templates?.slot_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

              {/* Swap specific empty state */}
              {form.type === 'swap' && form.target_volunteer_id && volSchedules.length === 0 && (
                <p className="text-xs text-amber-400">Volunteer ini tidak memiliki jadwal mendatang.</p>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Alasan (opsional)</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="form-input" rows={3} placeholder="Kenapa ingin tukar jadwal?" />
              </div>

              {form.type === 'replacement' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                  ℹ️ Request ini akan dikirim ke volunteer target dan PIC Ibadah. Volunteer target hanya menggantikan posisi tanpa menukar jadwalnya dengan jadwalmu.
                </div>
              )}
            </div>
            <div className="flex gap-3 p-6 border-t border-border">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-secondary hover:bg-accent border border-border rounded-lg text-sm">Batal</button>
              <button id="submit-swap-btn" onClick={handleSubmit} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                {saving ? 'Mengirim...' : 'Kirim Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
