'use client'
import React from 'react'

export default function ConsistencyTool(){
  const [limit, setLimit] = React.useState('200')
  const [result, setResult] = React.useState<any>(null)
  const [busy, setBusy] = React.useState(false)
  const qs = () => new URLSearchParams({ limit }).toString()
  const check = async () => {
    setBusy(true)
    try {
      const r = await fetch(`/api/go/api/v1/console/consistency/offers?${qs()}`, { cache: 'no-store' })
      const j = await r.json()
      setResult(j)
    } finally { setBusy(false) }
  }
  const repair = async () => {
    setBusy(true)
    try {
      const r = await fetch(`/api/go/api/v1/console/consistency/offers?${qs()}&repair=true`, { method:'POST' })
      const j = await r.json()
      setResult(j)
    } finally { setBusy(false) }
  }
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">读模型一致性（Offer）</h1>
      <label className="block mb-3">
        <span className="block text-sm text-gray-600 mb-1">数量上限</span>
        <input className="border rounded px-3 py-2 w-full" type="number" value={limit} onChange={e=>setLimit((e.target as HTMLInputElement).value)} />
      </label>
      <div className="flex gap-3 mb-6">
        <button onClick={check} disabled={busy} className={`px-4 py-2 rounded ${busy?'bg-gray-300':'bg-blue-600 text-white hover:bg-blue-700'}`}>扫描缺口</button>
        <button onClick={repair} disabled={busy} className={`px-4 py-2 rounded ${busy?'bg-gray-300':'bg-green-600 text-white hover:bg-green-700'}`}>一键修复</button>
      </div>
      {result && <pre className="bg-gray-50 border rounded p-3 text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
      <p className="text-xs text-gray-500">说明：仅管理员可用；根据 OfferCreated 事件修补缺失的 Offer 行。</p>
    </div>
  )
}

