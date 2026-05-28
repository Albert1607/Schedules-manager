import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    let { email, password, full_name, phone, birth_date, role, region_id, service_id, pic_ibadah_id } = await req.json()

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Email, password, dan nama wajib diisi' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: currentProfile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single()
    const currentProfileData = currentProfile as { role: string } | null
    if (currentProfileData?.role !== 'pic_ministry') {
      if (currentProfileData?.role === 'pic_ibadah' && role === 'volunteer') {
        pic_ibadah_id = currentUser.id
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const admin = await createAdminClient()

    // Create user in auth
    const { data: newUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (authError) throw authError

    // Update profile with extra fields (using type assertion since we don't have full generated types yet)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (admin as any).from('profiles').update({
      full_name,
      phone: phone || null,
      birth_date: birth_date || null,
      role,
      region_id: region_id || null,
      service_id: service_id || null,
      pic_ibadah_id: pic_ibadah_id || null,
    }).eq('id', newUser.user.id)

    if (profileError) throw profileError

    return NextResponse.json({ success: true, user: newUser.user })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
