'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { triggerSwapApprovalEmail } from '@/app/actions/email'
import { ArrowLeftRight, CheckCircle, XCircle, Loader2, Clock, AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'

export default function SwapApprovalsPage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<{ id: string; action: 'approved' | 'rejected' } | null>(null)
  const [note, setNote] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from('swap_requests')
      .select(`
        *,
        requester:profiles!swap_requests_requester_id_fkey(id, full_name, email),
        target_volunteer:profiles!swap_requests_target_volunteer_id_fkey(id, full_name, email),
        schedule:schedules!swap_requests_schedule_id_fkey(
          scheduled_date, service_slot_templates(slot_name),
          profiles!schedules_volunteer_id_fkey(full_name),
          services(name)
        ),
        replacement_schedule:schedules!swap_requests_replacement_schedule_id_fkey(
          scheduled_date, service_slot_templates(slot_name)
        )
      `)
      .eq('pic_ibadah_id', user.id)
      .order('created_at', { ascending: false })

    setRequests(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function processRequest(requestId: string, status: 'approved' | 'rejected', picNote: string) {
    setProcessing(requestId)
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', requestId).single()

    const { error } = await supabase.from('swap_requests').update({
      status: status === 'approved' ? (req?.target_volunteer_id ? 'pending_volunteer' : 'approved') : 'rejected',
      pic_note: picNote || null,
    }).eq('id', requestId)

    if (!error) {
      // If approved and no target, mark as fully approved
      if (status === 'approved' && req) {
        if (!req.target_volunteer_id) {
          // Open replacement — mark schedule as swapped
          await supabase.from('schedules').update({ status: 'swapped' }).eq('id', req.schedule_id)
        }

        // Send notifications
        const notifTargets = [req.requester_id]
        if (req.target_volunteer_id) notifTargets.push(req.target_volunteer_id)

        const notifInserts = notifTargets.map(uid => ({
          user_id: uid,
          title: status === 'approved' ? '✅ Permintaan Swap Disetujui' : '❌ Permintaan Swap Ditolak',
          body: status === 'approved' ? 'Permintaan tukar jadwal Anda telah disetujui oleh PIC.' : `Permintaan tukar jadwal Anda ditolak. ${picNote || ''}`,
          type: 'swap',
          ref_id: requestId,
        }))
        await supabase.from('notifications').insert(notifInserts)

        // Notify PIC Ministry about the update
        const { data: ministers } = await supabase.from('profiles').select('id').eq('role', 'pic_ministry')
        if (ministers && ministers.length > 0) {
          await supabase.from('notifications').insert(ministers.map((m: any) => ({
            user_id: m.id,
            title: `Update Swap — ${status === 'approved' ? 'Disetujui' : 'Ditolak'}`,
            body: `Permintaan swap telah ${status === 'approved' ? 'disetujui' : 'ditolak'} oleh PIC Ibadah.`,
            type: 'swap_info',
            ref_id: requestId,
          })))
        }

        // Send Emails
        const serviceName = req.schedule?.services?.name || 'Ibadah'
        if (req.requester?.email) {
          await triggerSwapApprovalEmail(req.requester.email, req.requester.full_name, status === 'approved' ? 'approved' : 'rejected', req.requester.full_name, serviceName)
        }
        if (req.target_volunteer?.email) {
          await triggerSwapApprovalEmail(req.target_volunteer.email, req.target_volunteer.full_name, status === 'approved' ? 'approved' : 'rejected', req.requester.full_name, serviceName)
        }
      }
    }

    await loadData()
    setNoteModal(null)
    setNote('')
    setProcessing(null)
  }

  const pending = requests.filter(r => r.status === 'pending_pic')
  const history = requests.filter(r => r.status !== 'pending_pic')

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending_pic: 'badge-amber',
      pending_volunteer: 'badge-blue',
      approved: 'badge-green',
      rejected: 'badge-red',
    }
    const labels: Record<string, string> = {
      pending_pic: 'Menunggu PIC',
      pending_volunteer: 'Menunggu Volunteer',
      approved: 'Disetujui',
      rejected: 'Ditolak',
    }
    return { cls: map[status] || 'badge-blue', label: labels[status] || status }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Persetujuan Swap Jadwal</h1>
        <p className="text-sm text-muted-foreground mt-1">Tinjau dan kelola permintaan tukar jadwal volunteer</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Pending */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm">Menunggu Persetujuan</h2>
              {pending.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-[10px] font-bold flex items-center justify-center text-black">{pending.length}</span>
              )}
            </div>

            {pending.length === 0 ? (
              <div className="glass-card py-10 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Tidak ada permintaan yang menunggu</p>
              </div>
            ) : (
              pending.map(req => (
                <SwapCard
                  key={req.id}
                  req={req}
                  statusBadge={statusBadge}
                  onApprove={() => setNoteModal({ id: req.id, action: 'approved' })}
                  onReject={() => setNoteModal({ id: req.id, action: 'rejected' })}
                  processing={processing === req.id}
                  isPending
                />
              ))
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground">Riwayat</h2>
              {history.map(req => (
                <SwapCard key={req.id} req={req} statusBadge={statusBadge} isPending={false} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Note Modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold">
                {noteModal.action === 'approved' ? '✅ Setujui Permintaan' : '❌ Tolak Permintaan'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Catatan (opsional)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} className="form-input" rows={3}
                  placeholder="Tambahkan catatan untuk volunteer..." />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-border">
              <button onClick={() => { setNoteModal(null); setNote('') }} className="flex-1 px-4 py-2 bg-secondary hover:bg-accent border border-border rounded-lg text-sm">Batal</button>
              <button
                onClick={() => processRequest(noteModal.id, noteModal.action, note)}
                disabled={!!processing}
                className={`flex-1 flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold transition-colors
                  ${noteModal.action === 'approved' ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-destructive hover:bg-destructive/80 text-white'}
                `}
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {noteModal.action === 'approved' ? 'Setujui' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SwapCard({ req, statusBadge, onApprove, onReject, processing, isPending }: any) {
  const { cls, label } = statusBadge(req.status)

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
            {req.requester?.full_name?.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-sm">{req.requester?.full_name}</p>
            <p className="text-xs text-muted-foreground">{req.requester?.email}</p>
          </div>
        </div>
        <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${cls}`}>{label}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="p-3 bg-secondary/40 rounded-lg">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Jadwal Diminta Ditukar</p>
          <p className="text-sm font-medium">{req.schedule?.scheduled_date ? format(parseISO(req.schedule.scheduled_date), 'd MMM yyyy', { locale: id }) : '—'}</p>
          <p className="text-xs text-muted-foreground">{req.schedule?.service_slot_templates?.slot_name || '—'}</p>
        </div>
        <div className="p-3 bg-secondary/40 rounded-lg">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            {req.type === 'swap' ? 'Target Pengganti' : 'Mencari Pengganti'}
          </p>
          {req.target_volunteer ? (
            <>
              <p className="text-sm font-medium">{req.target_volunteer.full_name}</p>
              {req.replacement_schedule?.scheduled_date && (
                <p className="text-xs text-muted-foreground">{format(parseISO(req.replacement_schedule.scheduled_date), 'd MMM yyyy', { locale: id })}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Open replacement</p>
          )}
        </div>
      </div>

      {req.reason && (
        <p className="text-xs text-muted-foreground mb-3 p-2 bg-secondary/30 rounded-lg">
          <span className="font-medium text-foreground">Alasan: </span>{req.reason}
        </p>
      )}
      {req.pic_note && (
        <p className="text-xs text-muted-foreground mb-3 p-2 bg-secondary/30 rounded-lg">
          <span className="font-medium text-foreground">Catatan PIC: </span>{req.pic_note}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{format(parseISO(req.created_at), 'd MMM yyyy HH:mm', { locale: id })}</span>
        {isPending && (
          <div className="flex gap-2">
            <button
              onClick={onReject}
              disabled={processing}
              className="flex items-center gap-1 px-3 py-1.5 border border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-xs"
            >
              <XCircle className="w-3.5 h-3.5" /> Tolak
            </button>
            <button
              onClick={onApprove}
              disabled={processing}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-xs"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Setujui
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
