'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { triggerVolunteerResponseEmail } from '@/app/actions/email'

export async function respondToSwapRequest(requestId: string, accept: boolean) {
  try {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized: Harap login terlebih dahulu.' }
    }

    // 1. Fetch swap request with requester & target details using user-context client
    const { data: req, error: fetchErr } = await client
      .from('swap_requests')
      .select(`
        *,
        requester:profiles!swap_requests_requester_id_fkey(id, full_name, email),
        target_volunteer:profiles!swap_requests_target_volunteer_id_fkey(id, full_name, email),
        schedule:schedules!swap_requests_schedule_id_fkey(scheduled_date, service_id, service_slot_templates(slot_name), services(name))
      `)
      .eq('id', requestId)
      .single()

    if (fetchErr || !req) {
      return { success: false, error: 'Request tidak ditemukan atau Anda tidak memiliki akses.' }
    }

    if (req.target_volunteer_id !== user.id) {
      return { success: false, error: 'Anda bukan target volunteer untuk permintaan ini.' }
    }

    if (req.status !== 'pending_volunteer') {
      return { success: false, error: 'Permintaan ini tidak sedang menunggu konfirmasi Anda.' }
    }

    const adminClient = await createAdminClient()

    if (accept) {
      // 2. Perform the swap / replacement
      if (req.type === 'swap' && req.replacement_schedule_id) {
        // Direct schedule swap between requester and target
        // a. Update requester's schedule with target_volunteer_id (and set status to 'confirmed')
        const { error: err1 } = await adminClient
          .from('schedules')
          .update({ volunteer_id: req.target_volunteer_id, status: 'confirmed' })
          .eq('id', req.schedule_id)

        // b. Update target's schedule with requester_id (and set status to 'confirmed')
        const { error: err2 } = await adminClient
          .from('schedules')
          .update({ volunteer_id: req.requester_id, status: 'confirmed' })
          .eq('id', req.replacement_schedule_id)

        if (err1 || err2) {
          console.error('Error updating schedules during swap:', { err1, err2 })
          return { success: false, error: 'Gagal memperbarui jadwal pelayanan saat swap.' }
        }
      } else {
        // Replacement (target replaces requester)
        const { error: err } = await adminClient
          .from('schedules')
          .update({ volunteer_id: req.target_volunteer_id, status: 'confirmed' })
          .eq('id', req.schedule_id)

        if (err) {
          console.error('Error updating schedule during replacement:', err)
          return { success: false, error: 'Gagal memperbarui jadwal pelayanan saat replacement.' }
        }
      }

      // 3. Update swap request status to approved
      const { error: reqErr } = await adminClient
        .from('swap_requests')
        .update({ status: 'approved' })
        .eq('id', requestId)

      if (reqErr) {
        console.error('Error updating swap request status:', reqErr)
        return { success: false, error: 'Gagal mengubah status permintaan swap.' }
      }

      // 4. Send Notifications & Emails
      const serviceName = req.schedule?.services?.name || 'Ibadah'
      
      // Notify requester
      await adminClient.from('notifications').insert({
        user_id: req.requester_id,
        title: '✅ Swap Jadwal Disetujui',
        body: `Permintaan swap jadwal Anda untuk ${serviceName} telah disetujui oleh ${req.target_volunteer?.full_name}.`,
        type: 'swap',
        ref_id: requestId
      })

      // Notify PIC Ibadah
      if (req.pic_ibadah_id) {
        await adminClient.from('notifications').insert({
          user_id: req.pic_ibadah_id,
          title: '🔄 Swap Jadwal Selesai',
          body: `Swap jadwal antara ${req.requester?.full_name} dan ${req.target_volunteer?.full_name} telah selesai dikonfirmasi.`,
          type: 'swap_info',
          ref_id: requestId
        })
      }

      // Send email to requester (non-blocking)
      if (req.requester?.email && req.requester?.full_name && req.target_volunteer?.full_name) {
        triggerVolunteerResponseEmail(
          req.requester.email,
          req.requester.full_name,
          true,
          req.target_volunteer.full_name,
          serviceName
        ).catch(err => console.error('Email error:', err))
      }

    } else {
      // Reject
      // 1. Update swap request status to rejected
      const { error: reqErr } = await adminClient
        .from('swap_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)

      if (reqErr) {
        console.error('Error updating swap request status during reject:', reqErr)
        return { success: false, error: 'Gagal menolak permintaan swap.' }
      }

      // 2. Send Notifications & Emails
      const serviceName = req.schedule?.services?.name || 'Ibadah'

      // Notify requester
      await adminClient.from('notifications').insert({
        user_id: req.requester_id,
        title: '❌ Swap Jadwal Ditolak',
        body: `Permintaan swap jadwal Anda untuk ${serviceName} telah ditolak oleh ${req.target_volunteer?.full_name}.`,
        type: 'swap',
        ref_id: requestId
      })

      // Notify PIC Ibadah
      if (req.pic_ibadah_id) {
        await adminClient.from('notifications').insert({
          user_id: req.pic_ibadah_id,
          title: '❌ Swap Jadwal Ditolak',
          body: `${req.target_volunteer?.full_name} menolak permintaan swap jadwal dari ${req.requester?.full_name}.`,
          type: 'swap_info',
          ref_id: requestId
        })
      }

      // Send email to requester (non-blocking)
      if (req.requester?.email && req.requester?.full_name && req.target_volunteer?.full_name) {
        triggerVolunteerResponseEmail(
          req.requester.email,
          req.requester.full_name,
          false,
          req.target_volunteer.full_name,
          serviceName
        ).catch(err => console.error('Email error:', err))
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Unexpected error in respondToSwapRequest action:', error)
    return { success: false, error: error.message || 'Terjadi kesalahan sistem.' }
  }
}
