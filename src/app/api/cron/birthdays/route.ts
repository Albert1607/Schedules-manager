import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendBirthdayEmail, sendBirthdayRecapEmailToMinistry } from '@/lib/email'

export const dynamic = 'force-dynamic' // ensure it's not cached

export async function GET(request: Request) {
  try {
    // Basic security check: Require an Authorization header or a secret query param
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    // You should define CRON_SECRET in your .env.local
    if (secret !== process.env.CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Using service role key because CRON jobs run outside user sessions
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase service role keys' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const today = new Date()
    const currentMonth = today.getMonth() + 1 // 1-12
    const currentDay = today.getDate() // 1-31

    // Fetch all active profiles that have a birth_date
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, birth_date')
      .eq('is_active', true)
      .not('birth_date', 'is', null)

    if (error) {
      throw error
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: 'No profiles with birth dates found.' })
    }

    // Filter in JS (safe for < 10,000 records)
    const birthdayProfiles = profiles.filter((p: any) => {
      const bDate = new Date(p.birth_date)
      return bDate.getMonth() + 1 === currentMonth && bDate.getDate() === currentDay
    })

    if (birthdayProfiles.length === 0) {
      return NextResponse.json({ message: 'No birthdays today.' })
    }

    // Send emails
    const emailPromises = birthdayProfiles.map((p: any) => {
      if (p.email && p.full_name) {
        return sendBirthdayEmail(p.email, p.full_name)
      }
      return Promise.resolve(null)
    })

    // Get all PIC Ministry profiles to send a consolidated birthday list
    const { data: ministers } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('role', 'pic_ministry')

    if (ministers && ministers.length > 0) {
      const birthdayData = birthdayProfiles.map((p: any) => ({
        full_name: p.full_name,
        email: p.email
      }))
      ministers.forEach((m: any) => {
        emailPromises.push(
          sendBirthdayRecapEmailToMinistry(m.email, m.full_name, birthdayData)
        )
      })
    }

    await Promise.allSettled(emailPromises)

    return NextResponse.json({ 
      success: true, 
      message: `Sent ${birthdayProfiles.length} birthday emails!`,
      profiles: birthdayProfiles.map((p: any) => p.email)
    })

  } catch (error: any) {
    console.error('CRON Birthday Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
