import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL, // e.g., your.email@gmail.com
    pass: process.env.GMAIL_APP_PASSWORD, // 16-character App Password
  },
})

export async function sendEmail({
  to,
  subject,
  html
}: {
  to: string | string[]
  subject: string
  html: string
}) {
  try {
    const info = await transporter.sendMail({
      from: `"Ministry Schedule" <${process.env.GMAIL_EMAIL}>`,
      to,
      subject,
      html,
    })

    return { success: true, data: info }
  } catch (error) {
    console.error('Email exception:', error)
    return { success: false, error }
  }
}

// Pre-defined templates

export async function sendScheduleNotificationEmail(to: string, volunteerName: string, serviceName: string, date: string, slotName: string) {
  return sendEmail({
    to,
    subject: `Jadwal Pelayanan Baru: ${serviceName}`,
    html: `
      <h2>Halo, ${volunteerName}!</h2>
      <p>Kamu telah dijadwalkan untuk pelayanan pada ibadah <strong>${serviceName}</strong>.</p>
      <ul>
        <li><strong>Tanggal:</strong> ${date}</li>
        <li><strong>Posisi/Tugas:</strong> ${slotName}</li>
      </ul>
      <p>Mohon persiapkan diri dengan baik. Jika berhalangan, harap segera request tukar jadwal melalui dashboard.</p>
      <br />
      <p>Terima kasih,</p>
      <p>Tim Ministry</p>
    `
  })
}

export async function sendSwapRequestEmail(to: string, targetName: string, requesterName: string, serviceName: string, date: string, reason: string) {
  return sendEmail({
    to,
    subject: `Permintaan Tukar Jadwal dari ${requesterName}`,
    html: `
      <h2>Halo, ${targetName}!</h2>
      <p><strong>${requesterName}</strong> meminta kamu untuk menggantikan atau bertukar jadwal pelayanan pada ibadah <strong>${serviceName}</strong>.</p>
      <ul>
        <li><strong>Tanggal:</strong> ${date}</li>
        <li><strong>Alasan:</strong> ${reason || '-'}</li>
      </ul>
      <p>Silakan buka dashboard Ministry untuk menyetujui atau menolak permintaan ini.</p>
      <br />
      <p>Terima kasih,</p>
      <p>Tim Ministry</p>
    `
  })
}

export async function sendSwapApprovalEmail(to: string, name: string, status: 'approved' | 'rejected', requesterName: string, serviceName: string) {
  const isApproved = status === 'approved'
  return sendEmail({
    to,
    subject: `Permintaan Tukar Jadwal ${isApproved ? 'Disetujui' : 'Ditolak'}`,
    html: `
      <h2>Halo, ${name}!</h2>
      <p>Permintaan tukar jadwal pelayanan untuk ibadah <strong>${serviceName}</strong> (bersama ${requesterName}) telah <strong>${isApproved ? 'DISETUJUI' : 'DITOLAK'}</strong> oleh PIC Ibadah.</p>
      <p>Silakan cek jadwal terbaru kamu di dashboard.</p>
      <br />
      <p>Terima kasih,</p>
      <p>Tim Ministry</p>
    `
  })
}

export async function sendBirthdayEmail(to: string, name: string) {
  return sendEmail({
    to,
    subject: `Selamat Ulang Tahun, ${name}! 🎉`,
    html: `
      <h2>Selamat Ulang Tahun, ${name}!</h2>
      <p>Segenap tim Ministry mengucapkan selamat ulang tahun untukmu.</p>
      <p>Kiranya Tuhan Yesus selalu memberkati pelayanan, pekerjaan, dan setiap langkah kehidupanmu.</p>
      <br />
      <p>Tetap semangat melayani!</p>
      <p>Tim Ministry</p>
    `
  })
}

export async function sendVolunteerResponseEmail(to: string, name: string, isAccepted: boolean, partnerName: string, serviceName: string) {
  const statusStr = isAccepted ? 'DISETUJUI' : 'DITOLAK'
  const detailStr = isAccepted 
    ? 'Jadwal pelayanan kalian telah otomatis diperbarui di dashboard.' 
    : 'Jadwal pelayanan tetap seperti semula.'
  return sendEmail({
    to,
    subject: `Konfirmasi Tukar Jadwal: ${statusStr}`,
    html: `
      <h2>Halo, ${name}!</h2>
      <p>Partner pelayananmu, <strong>${partnerName}</strong>, telah <strong>${statusStr}</strong> permintaan tukar jadwal untuk ibadah <strong>${serviceName}</strong>.</p>
      <p>${detailStr}</p>
      <br />
      <p>Terima kasih,</p>
      <p>Tim Ministry</p>
    `
  })
}

