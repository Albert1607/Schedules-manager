'use server'

import { sendScheduleNotificationEmail, sendSwapRequestEmail, sendSwapApprovalEmail, sendBirthdayEmail, sendVolunteerResponseEmail } from '@/lib/email'

// Server Action to trigger schedule emails
export async function triggerScheduleEmails(payloads: { email: string; name: string; serviceName: string; date: string; slotName: string }[]) {
  // We can run these in parallel
  const promises = payloads.map(p => 
    sendScheduleNotificationEmail(p.email, p.name, p.serviceName, p.date, p.slotName)
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

