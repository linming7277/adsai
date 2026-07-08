export const runtime = 'nodejs'
export const dynamic = 'force-static'

export async function GET() {
  const base = (process.env.BACKEND_URL || process.env.API_GATEWAY_HOST || '').trim()
  const backendBase = base.startsWith('http') ? base : (base ? `https://${base}` : 'https://autoads-gw-885pd7lz.an.gateway.dev')
  return new Response(JSON.stringify({ backendBase, generatedAt: new Date().toISOString() }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
  })
}

