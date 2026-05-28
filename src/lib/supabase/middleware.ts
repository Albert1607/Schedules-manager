import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes
  if (pathname === '/login' || pathname === '/') {
    if (user) {
      // Redirect to dashboard based on role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const redirectUrl = getRedirectByRole(profile?.role, request.url)
      return NextResponse.redirect(redirectUrl)
    }
    return supabaseResponse
  }

  // Protected routes
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based protection
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  if (pathname.startsWith('/dashboard/pic-ministry') && role !== 'pic_ministry') {
    return NextResponse.redirect(getRedirectByRole(role, request.url))
  }

  if (pathname.startsWith('/dashboard/pic-ibadah') && role !== 'pic_ibadah' && role !== 'pic_ministry') {
    return NextResponse.redirect(getRedirectByRole(role, request.url))
  }

  return supabaseResponse
}

function getRedirectByRole(role: string | undefined, baseUrl: string): URL {
  const url = new URL(baseUrl)
  if (role === 'pic_ministry') url.pathname = '/dashboard/pic-ministry'
  else if (role === 'pic_ibadah') url.pathname = '/dashboard/pic-ibadah'
  else url.pathname = '/dashboard/volunteer'
  return url
}
