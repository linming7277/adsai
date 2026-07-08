import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

async function verifyFirebaseToken(idToken: string) {
  if (!projectId) throw new Error('Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  })
  return payload as any
}

export async function POST(req: NextRequest) {
  try {
    const hdr = req.headers.get('x-firebase-token') || ''
    const body = await req.json().catch(()=>({})) as any
    const token = hdr || body?.token || ''
    if (!token) return new Response(JSON.stringify({ error: 'missing_token' }), { status: 400 })
    await verifyFirebaseToken(token)
    const c = cookies()
    const secure = process.env.NODE_ENV === 'production'
    c.set('Firebase-Token', token, { httpOnly: true, sameSite: 'lax', path: '/', secure, maxAge: 60*60*6 })
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e:any) {
    return new Response(JSON.stringify({ error: 'invalid_token', message: e?.message || 'verify failed' }), { status: 400 })
  }
}

export async function DELETE() {
  const c = cookies()
  c.set('Firebase-Token', '', { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV==='production', maxAge: 0 })
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
}

