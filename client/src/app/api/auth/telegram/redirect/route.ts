import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const params = Object.fromEntries(url.searchParams.entries())
    const res = await fetch('http://localhost:4000/api/auth/telegram/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    const data = await res.json().catch(() => ({}))
    if (data?.ok) {
      return NextResponse.redirect(new URL('/lobby', url.origin))
    }
    return NextResponse.json({ ok: false, error: 'verify_failed', details: data }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'redirect_error' }, { status: 200 })
  }
}


