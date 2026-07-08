export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const vars = {
    BACKEND_URL: process.env.BACKEND_URL || '',
    GO_BASE_OFFERS: process.env.GO_BASE_OFFERS || '',
    GO_BASE_SITERANK: process.env.GO_BASE_SITERANK || '',
    GO_BASE_BATCHOPEN: process.env.GO_BASE_BATCHOPEN || '',
    GO_BASE_ADSCENTER: process.env.GO_BASE_ADSCENTER || '',
    GO_BASE_BILLING: process.env.GO_BASE_BILLING || '',
    GO_BASE_NOTIFICATIONS: process.env.GO_BASE_NOTIFICATIONS || '',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  }
  return new Response(JSON.stringify({ env: vars, ts: Date.now() }), { status: 200, headers: { 'content-type': 'application/json' } })
}

