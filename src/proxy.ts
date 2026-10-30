import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/env'

// Refreshes the Supabase session cookie and keeps signed-out users out of /admin.
// Real authorization is enforced by RLS in the database.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value)
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const isLogin = request.nextUrl.pathname === '/admin/login'

  if (!data?.claims === !isLogin) {
    // Signed out → login page; already signed in → skip the login page.
    const url = request.nextUrl.clone()
    url.pathname = isLogin ? '/admin' : '/admin/login'
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
