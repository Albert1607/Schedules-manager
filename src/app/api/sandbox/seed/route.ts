import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabaseAdmin = await createAdminClient()

    // 1. Create the Auth User
    const email = 'admin@ministry.com'
    const password = 'Password123!'
    const fullName = 'Super Admin Ministry'

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })

    if (authError && authError.message !== 'User already registered') {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    let userId = authData?.user?.id

    // If user already registered, fetch their ID
    if (!userId) {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const user = existingUsers.users.find((u: any) => u.email === email)
      if (user) userId = user.id
    }

    if (!userId) {
      return NextResponse.json({ error: 'Failed to retrieve or create user ID' }, { status: 500 })
    }

    // 2. Ensure profile exists and role is pic_ministry
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      email: email,
      role: 'pic_ministry',
      is_active: true
    })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Sandbox PIC Ministry user created successfully!', 
      credentials: { email, password },
      login_url: 'http://localhost:3000/login'
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
