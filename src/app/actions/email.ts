'use server'

import { 
  sendScheduleNotificationEmail, 
  sendSwapRequestEmail, 
  sendSwapApprovalEmail, 
  sendBirthdayEmail, 
  sendVolunteerResponseEmail,
  sendSwapRecapEmailToMinistry,
  ScheduleItem
} from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/server'

// Server Action to trigger schedule emails
export async function triggerScheduleEmails(payloads: {
  email: string
  name: string
  schedules: ScheduleItem[]
}[]) {
  // We can run these in parallel
  const promises = payloads.map(p => 
    sendScheduleNotificationEmail(p.email, p.name, p.schedules)
  )
  await Promise.allSettled(promises)
  return { success: true }
}

// Server Action to trigger swap request email
export async function triggerSwapRequestEmail(email: string, targetName: string, requesterName: string, serviceName: string, date: string, reason: string) {
  await sendSwapRequestEmail(email, targetName, requesterName, serviceName, date, reason)
  return { success: true }
}

// Server Action to trigger swap approval email
export async function triggerSwapApprovalEmail(email: string, name: string, status: 'approved' | 'rejected', requesterName: string, serviceName: string) {
  await sendSwapApprovalEmail(email, name, status, requesterName, serviceName)
  return { success: true }
}

// Server Action to trigger volunteer response email
export async function triggerVolunteerResponseEmail(email: string, name: string, isAccepted: boolean, partnerName: string, serviceName: string) {
  await sendVolunteerResponseEmail(email, name, isAccepted, partnerName, serviceName)
  return { success: true }
}

// Server Action to send swap recap emails to all PIC Ministry users
export async function triggerSwapRecapEmailToMinistry(
  requesterName: string,
  targetName: string,
  serviceName: string,
  date: string,
  type: 'swap' | 'replacement',
  isAccepted: boolean
) {
  const adminClient = await createAdminClient()
  const { data: ministers } = await adminClient
    .from('profiles')
    .select('email, full_name')
    .eq('role', 'pic_ministry')

  if (ministers && ministers.length > 0) {
    const promises = ministers.map((m: any) =>
      sendSwapRecapEmailToMinistry(
        m.email,
        m.full_name,
        requesterName,
        targetName,
        serviceName,
        date,
        type,
        isAccepted
      )
    )
    await Promise.allSettled(promises)
  }
  return { success: true }
}


