export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BACKEND_DEFAULT = 'https://autoads-gw-885pd7lz.an.gateway.dev'
let __backendCache: { base: string; ts: number } | undefined
async function resolveBackendBase(req: Request): Promise<string> {
  if (process.env.BACKEND_URL && process.env.BACKEND_URL.trim() !== '') return process.env.BACKEND_URL.trim()
  const now = Date.now()
  if (__backendCache && now - __backendCache.ts < 5 * 60_000) return __backendCache.base
  try {
    const u = new URL(req.url)
    const scheme = u.protocol || 'https:'
    const host = u.host
    const wellKnown = `${scheme}//${host}/.well-known/backend.json`
    const controller = new AbortController()
    const to = setTimeout(() => controller.abort(), 1000)
    const r = await fetch(wellKnown, { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } })
    clearTimeout(to)
    if (r.ok) {
      const j = await r.json().catch(() => ({} as any))
      const base = String(j?.backendBase || '').trim()
      if (base) { __backendCache = { base, ts: now }; return base }
    }
  } catch { /* ignore */ }
  __backendCache = { base: BACKEND_DEFAULT, ts: Date.now() }
  return BACKEND_DEFAULT
}
// Optional per-service overrides to bypass API Gateway in preview:
// e.g. GO_BASE_OFFERS=https://offer-preview-xxxx.run.app
const GO_BASE_OVERRIDES: Record<string,string|undefined> = {
  offers: process.env.GO_BASE_OFFERS,
  siterank: process.env.GO_BASE_SITERANK,
  batchopen: process.env.GO_BASE_BATCHOPEN,
  adscenter: process.env.GO_BASE_ADSCENTER,
  billing: process.env.GO_BASE_BILLING,
  notifications: process.env.GO_BASE_NOTIFICATIONS,
  console: process.env.GO_BASE_CONSOLE,
}
const MAX_BODY_BYTES = Number(process.env.BFF_MAX_BODY || 2 * 1024 * 1024)
const UPSTREAM_TIMEOUT_MS = Number(process.env.BFF_UPSTREAM_TIMEOUT_MS || 15000)

function resolveTarget(subPath: string, search: string, backendBase: string) {
  const s = subPath.startsWith('/') ? subPath : `/${subPath}`
  const allowed = ['/', '/api', '/api/', '/api/v1', '/api/v1/', '/health', '/healthz', '/ready', '/readyz']
    .some(p => s === p || s.startsWith(p))
  if (!allowed) return null
  // Try per-service override for /api/v1/{service}/...
  // Extract first segment after /api/v1
  const segs = s.split('/').filter(Boolean) // e.g. ['api','v1','offers','...']
  if (segs.length >= 3 && segs[0] === 'api' && segs[1] === 'v1') {
    const svc = segs[2]
    const base = GO_BASE_OVERRIDES[svc]
    if (base) return `${base}${s}${search || ''}`
  }
  return `${backendBase}${s}${search || ''}`
}

function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null
  const parts = header.split(';')
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

async function readBodyWithLimit(req: Request, limit: number): Promise<BodyInit | undefined | Response> {
  if (['GET','HEAD'].includes(req.method)) return undefined
  const len = req.headers.get('content-length')
  if (len && Number(len) > limit) {
    return new Response(JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large', limit } }), {
      status: 413,
      headers: { 'content-type': 'application/json', 'X-BFF-Enforced': '1' }
    })
  }
  const reader = req.body?.getReader()
  if (!reader) return undefined
  let received = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      received += value.byteLength
      if (received > limit) {
        return new Response(JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large', limit } }), { status: 413 })
      }
      chunks.push(value)
    }
  }
  return chunks.length ? Buffer.concat(chunks) : undefined
}

async function proxy(req: Request, path: string[]) {
  const url = new URL(req.url)
  const subPath = `/${path.join('/')}`
  const base = await resolveBackendBase(req)
  const target = resolveTarget(subPath, url.search, base)
  if (!target) return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 })

  const headers = new Headers(req.headers)
  headers.delete('host'); headers.delete('connection'); headers.delete('content-length'); headers.delete('accept-encoding')
  if (!headers.get('x-request-id')) headers.set('x-request-id', `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`)

  // Inject Firebase bearer from cookie if missing
  if (!headers.get('authorization')) {
    const cookie = req.headers.get('cookie')
    const token = readCookie(cookie, 'Firebase-Token')
    if (token) headers.set('authorization', `Bearer ${token}`)
  }

  // Enrich minimal user info for downstream if possible
  const authz = headers.get('authorization') || ''
  const tok = authz.startsWith('Bearer ') ? authz.slice(7) : ''
  if (tok && !headers.get('X-User-Id')) {
    try {
      const seg = tok.split('.')[1]
      const payload = JSON.parse(Buffer.from(seg.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'))
      const uid = String(payload.user_id || payload.sub || '')
      const email = String(payload.email || '')
      if (uid) headers.set('X-User-Id', uid)
      if (email) headers.set('X-User-Email', email)
      const ui = { sub: uid, email }
      const b64 = Buffer.from(JSON.stringify(ui)).toString('base64')
      if (uid) headers.set('X-Endpoint-API-UserInfo', b64)
    } catch {}
  }

  let body: BodyInit | undefined | Response
  if (!['GET','HEAD'].includes(req.method)) {
    body = await readBodyWithLimit(req, MAX_BODY_BYTES)
    if (body instanceof Response) return body
  }

  try {
    const controller = new AbortController()
    const t = setTimeout(()=>controller.abort(), UPSTREAM_TIMEOUT_MS)
    const resp = await fetch(target, { method: req.method, headers, body, redirect: 'manual', signal: controller.signal })
    clearTimeout(t)
    const h = new Headers(resp.headers)
    h.set('X-BFF-Enforced', '1')
    return new Response(resp.body, { status: resp.status, headers: h })
  } catch (e:any) {
    const msg = e?.message || 'Upstream error'
    const isTo = /abort|timeout/i.test(msg)
    return new Response(JSON.stringify({ error: { code: isTo ? 'GATEWAY_TIMEOUT' : 'BAD_GATEWAY', message: msg } }), { status: isTo ? 504 : 502 })
  }
}

export async function GET(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function HEAD(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function POST(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function PUT(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function PATCH(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function DELETE(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
export async function OPTIONS(req: Request, ctx: { params: { path: string[] } }) { return proxy(req, ctx.params.path) }
