'use client'
import React from 'react'

function Input({ label, value, onChange, type='text' }: any){
  return (
    <label className="block mb-3">
      <span className="block text-sm text-gray-600 mb-1">{label}</span>
      <input className="border rounded px-3 py-2 w-full" type={type} value={value} onChange={e=>onChange((e.target as HTMLInputElement).value)} />
    </label>
  )
}

export default function ReplayToolPage(){
  const [eventName, setEventName] = React.useState('OfferCreated')
  const [sinceHours, setSinceHours] = React.useState('24')
  const [limit, setLimit] = React.useState('100')
  const [plan, setPlan] = React.useState<any>(null)
  const [execRes, setExecRes] = React.useState<any>(null)
  const [busy, setBusy] = React.useState(false)
  const qs = () => {
    const p = new URLSearchParams()
    if (eventName) p.set('eventName', eventName)
    if (sinceHours) p.set('sinceHours', sinceHours)
    if (limit) p.set('limit', limit)
    return p.toString()
  }
  const loadPlan = async () => {
    setBusy(true); setExecRes(null)
    try {
      const r = await fetch(`/api/go/api/v1/console/events/replay/plan?${qs()}`, { cache: 'no-store' })
      const j = await r.json()
      setPlan(j)
    } catch (e:any) { setPlan({ error: e?.message||String(e) }) }
    finally { setBusy(false) }
  }
  const execute = async () => {
    setBusy(true)
    try {
      const body:any = {}
      if (sinceHours) body.sinceHours = Number(sinceHours)
      if (limit) body.limit = Number(limit)
      const r = await fetch('/api/go/api/v1/console/events/replay', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) })
      const j = await r.json()
      setExecRes(j)
    } catch (e:any) { setExecRes({ error: e?.message||String(e) }) }
    finally { setBusy(false) }
  }
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">事件回放（Admin）</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Input label="事件名" value={eventName} onChange={setEventName} />
        <Input label="近（小时）" value={sinceHours} onChange={setSinceHours} type='number' />
        <Input label="数量上限" value={limit} onChange={setLimit} type='number' />
      </div>
      <div className="flex gap-3 mb-6">
        <button onClick={loadPlan} disabled={busy} className={`px-4 py-2 rounded ${busy?'bg-gray-300':'bg-blue-600 text-white hover:bg-blue-700'}`}>预览计划</button>
        <button onClick={execute} disabled={busy} className={`px-4 py-2 rounded ${busy?'bg-gray-300':'bg-green-600 text-white hover:bg-green-700'}`}>执行回放</button>
      </div>
      {plan && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">计划</h2>
          <pre className="bg-gray-50 border rounded p-3 text-sm overflow-auto">{JSON.stringify(plan, null, 2)}</pre>
        </div>
      )}
      {execRes && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">执行结果</h2>
          <pre className="bg-gray-50 border rounded p-3 text-sm overflow-auto">{JSON.stringify(execRes, null, 2)}</pre>
        </div>
      )}
      <p className="text-xs text-gray-500">说明：仅管理员可用；通过 API Gateway+BFF 转发到 Console 后端。</p>
    </div>
  )
}

