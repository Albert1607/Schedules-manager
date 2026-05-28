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

export interface ScheduleItem {
  date: string
  time: string
  serviceName: string
  slotName: string
  location: string
}

export async function sendScheduleNotificationEmail(to: string, volunteerName: string, schedules: ScheduleItem[]) {
  const listHtml = schedules.map(s => `
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px;">${s.date}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${s.time}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${s.serviceName}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${s.slotName}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${s.location}</td>
    </tr>
  `).join('')

  return sendEmail({
    to,
    subject: `Jadwal Pelayanan Baru`,
    html: `
      <h2>Halo, ${volunteerName}!</h2>
      <p>Kamu telah dijadwalkan untuk pelayanan periode ini. Berikut rincian jadwalmu:</p>
      <table style="border-collapse: collapse; width: 100%; border: 1px solid #ddd; font-family: sans-serif;">
        <thead>
          <tr style="background-color: #f2f2f2; text-align: left;">
            <th style="border: 1px solid #ddd; padding: 8px;">Tanggal</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Waktu</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Ibadah</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Posisi/Tugas</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Tempat</th>
          </tr>
        </thead>
        <tbody>
          ${listHtml}
        </tbody>
      </table>
      <p style="margin-top: 15px;">Mohon persiapkan diri dengan baik. Jika berhalangan, harap segera request tukar jadwal melalui dashboard.</p>
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

export async function sendSwapRecapEmailToMinistry(
  to: string,
  picMinistryName: string,
  requesterName: string,
  targetName: string,
  serviceName: string,
  date: string,
  type: 'swap' | 'replacement',
  isAccepted: boolean
) {
  const outcome = isAccepted ? 'DISETUJUI & SELESAI' : 'DITOLAK & DIBATALKAN'
  const detail = isAccepted
    ? `Jadwal pelayanan untuk ibadah ${serviceName} pada tanggal ${date} telah resmi ditukar/diperbarui.`
    : `Permintaan swap dibatalkan/ditolak.`

  return sendEmail({
    to,
    subject: `[RECAP] Swap Jadwal: ${outcome}`,
    html: `
      <h2>Halo, ${picMinistryName}!</h2>
      <p>Berikut adalah laporan akhir (recap) pertukaran jadwal pelayanan:</p>
      <ul>
        <li><strong>Tipe:</strong> ${type === 'swap' ? 'Tukar Jadwal' : 'Cari Pengganti'}</li>
        <li><strong>Ibadah:</strong> ${serviceName}</li>
        <li><strong>Tanggal:</strong> ${date}</li>
        <li><strong>Pengaju:</strong> ${requesterName}</li>
        <li><strong>Target:</strong> ${targetName}</li>
        <li><strong>Status Akhir:</strong> <strong>${outcome}</strong></li>
      </ul>
      <p>${detail}</p>
      <br />
      <p>Terima kasih,</p>
      <p>System Manager</p>
    `
  })
}

export async function sendBirthdayRecapEmailToMinistry(
  to: string,
  picMinistryName: string,
  birthdayList: { full_name: string; email: string }[]
) {
  const listHtml = birthdayList.map(p => `<li><strong>${p.full_name}</strong> (${p.email})</li>`).join('')
  return sendEmail({
    to,
    subject: `[RECAP] Ulang Tahun Hari Ini 🎉`,
    html: `
      <h2>Halo, ${picMinistryName}!</h2>
      <p>Berikut adalah daftar volunteer yang berulang tahun hari ini:</p>
      <ul>
        ${listHtml}
      </ul>
      <br />
      <p>Mari berikan ucapan selamat kepada mereka!</p>
      <p>Tim Ministry</p>
    `
  })
}


