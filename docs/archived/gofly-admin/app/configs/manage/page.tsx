"use client"
import React, { useEffect, useState } from 'react'
import { Layout, Menu, Typography, message, Card, Button, List, Input, Space, Modal, Empty } from 'antd'
import { DashboardOutlined, UserOutlined, DatabaseOutlined, AlertOutlined, SettingOutlined, SaveOutlined, RollbackOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

export default function ConfigManagePage() {
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [keys, setKeys] = useState<{key:string,updatedAt:string}[]>([])
  const [sel, setSel] = useState<string>('')
  const [value, setValue] = useState<string>('')
  const [history, setHistory] = useState<{id:number,value:string,updatedAt:string,userId:string}[]>([])
  const [saving, setSaving] = useState(false)
  const [diff, setDiff] = useState<{ path:string, from:any, to:any }[] | null>(null)

  const fetchKeys = async () => {
    const r = await fetch('/api/go/api/v1/console/config', { cache: 'no-store' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    const items = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : [])
    setKeys(items)
  }
  const fetchValue = async (k:string) => {
    const r = await fetch(`/api/go/api/v1/console/config/${encodeURIComponent(k)}`, { cache: 'no-store' })
    if (!r.ok) { setValue(''); return }
    const j = await r.json()
    setValue(JSON.stringify(j?.value ?? {}, null, 2))
  }
  const fetchHistory = async (k:string) => {
    const r = await fetch(`/api/go/api/v1/console/config/history?key=${encodeURIComponent(k)}`, { cache: 'no-store' })
    if (!r.ok) { setHistory([]); return }
    const j = await r.json()
    const items = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : [])
    setHistory(items)
  }

  useEffect(() => { (async()=>{ try { setLoading(true); await fetchKeys() } catch(e:any){ message.error(e.message||String(e)) } finally { setLoading(false) } })() }, [])
  useEffect(() => { if (sel) { fetchValue(sel); fetchHistory(sel) } }, [sel])

  function computeDiff(a: any, b: any, basePath=''): { path: string, from:any, to:any }[] {
    const changes: { path:string, from:any, to:any }[] = []
    const isObj = (v:any)=> v && typeof v === 'object' && !Array.isArray(v)
    if (isObj(a) && isObj(b)) {
      const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort()
      for (const k of keys) {
        const na = (a as any)[k]
        const nb = (b as any)[k]
        const p = basePath ? `${basePath}.${k}` : k
        if (JSON.stringify(na) === JSON.stringify(nb)) continue
        if (isObj(na) && isObj(nb)) changes.push(...computeDiff(na, nb, p))
        else changes.push({ path: p, from: na, to: nb })
      }
    } else {
      if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ path: basePath || '(root)', from: a, to: b })
    }
    return changes
  }

  const onSave = async () => {
    try {
      setSaving(true)
      let parsed: any
      try { parsed = JSON.parse(value || '{}') } catch (e) { message.error('JSON 格式有误'); return }
      // 拉取当前线上值，计算 diff 后确认
      let current:any = {}
      try {
        const r0 = await fetch(`/api/go/api/v1/console/config/${encodeURIComponent(sel)}`)
        if (r0.ok) { const j0 = await r0.json(); current = j0?.value ?? {} }
      } catch {}
      const changes = computeDiff(current, parsed)
      setDiff(changes)
      const ok = await new Promise<boolean>((resolve)=>{
        Modal.confirm({ title: '确认发布配置?', width: 720, content: (
          <div>
            <div style={{marginBottom:8}}>将发布键：<b>{sel}</b></div>
            <Card size='small' title='变更预览'>
              {changes.length === 0 ? <Empty description='无变更' /> : (
                <pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(changes, null, 2)}</pre>
              )}
            </Card>
          </div>
        ), onOk: ()=> resolve(true), onCancel: ()=> resolve(false) })
      })
      if (!ok) return
      const r = await fetch(`/api/go/api/v1/console/config/${encodeURIComponent(sel)}`, { method: 'PUT', headers: { 'content-type':'application/json' }, body: JSON.stringify({ value: parsed }) })
      if (!r.ok) throw new Error(`保存失败: HTTP ${r.status}`)
      message.success('已保存为新版本')
      await fetchHistory(sel)
    } catch (e:any) { message.error(e.message || String(e)) } finally { setSaving(false) }
  }

  const onRollback = async (hist:any) => {
    Modal.confirm({ title: '确认回滚?', content: `将以历史版本(${hist.updatedAt})覆盖 ${sel}`, onOk: async () => {
      try {
        let parsed: any
        try { parsed = JSON.parse(hist.value || '{}') } catch { parsed = hist.value }
        const r = await fetch(`/api/go/api/v1/console/config/${encodeURIComponent(sel)}`, { method: 'PUT', headers: { 'content-type':'application/json' }, body: JSON.stringify({ value: parsed }) })
        if (!r.ok) throw new Error(`回滚失败: HTTP ${r.status}`)
        message.success('已回滚到所选版本')
        await fetchValue(sel); await fetchHistory(sel)
      } catch (e:any) { message.error(e.message || String(e)) }
    } })
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 48, margin: 12, color: '#fff' }}>AutoAds Console</div>
        <Menu theme="dark" defaultSelectedKeys={["configs-manage"]} mode="inline" items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘', onClick:()=>location.assign('/') },
          { key: 'users', icon: <UserOutlined />, label: '用户与套餐', onClick:()=>location.assign('/users') },
          { key: 'billing', icon: <DatabaseOutlined />, label: 'Token与计费', onClick:()=>location.assign('/billing') },
          { key: 'alerts', icon: <AlertOutlined />, label: '系统告警', onClick:()=>location.assign('/alerts') },
          { key: 'configs', icon: <SettingOutlined />, label: '动态配置(只读)', onClick:()=>location.assign('/configs') },
          { key: 'plans', icon: <SettingOutlined />, label: '套餐(只读)', onClick:()=>location.assign('/plans') },
          { key: 'monitoring', icon: <DashboardOutlined />, label: '监控', onClick:()=>location.assign('/monitoring') },
          { key: 'audits', icon: <AlertOutlined />, label: '审计', onClick:()=>location.assign('/audits') },
          { key: 'apikeys', icon: <SettingOutlined />, label: 'API Keys', onClick:()=>location.assign('/apikeys') },
        ]} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', paddingInline: 16, display:'flex', alignItems:'center', gap:12 }}>
          <Title level={4} style={{ margin: 0, flex:1 }}>动态配置（草稿→发布→回滚）</Title>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={onSave} disabled={!sel} loading={saving}>发布保存</Button>
          </Space>
        </Header>
        <Content style={{ margin: 16, display:'grid', gridTemplateColumns:'280px 1fr 380px', gap:16 }}>
          <Card loading={loading} title="配置键">
            <List size="small" dataSource={keys}
              renderItem={(it)=>(<List.Item onClick={()=>setSel(it.key)} style={{cursor:'pointer', background: sel===it.key?'#f0f5ff':'transparent'}}>
                <div>
                  <Text strong>{it.key}</Text>
                  <div style={{fontSize:12,color:'#888'}}>{it.updatedAt}</div>
                </div>
              </List.Item>)} />
          </Card>
          <Card title={sel?`编辑：${sel}`:'选择一个配置键'} extra={<Text type="secondary">JSON</Text>}>
            <Input.TextArea rows={24} value={value} onChange={(e)=>setValue(e.target.value)} placeholder="{\n  ...\n}" spellCheck={false} style={{fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'}}/>
          </Card>
          <Card title="历史版本">
            <List size="small" dataSource={history}
              renderItem={(it)=>(<List.Item actions={[<Button size="small" icon={<RollbackOutlined/>} onClick={()=>onRollback(it)}>回滚</Button>] }>
                <div>
                  <div style={{fontSize:12,color:'#888'}}>{it.updatedAt} · by {it.userId||'unknown'}</div>
                  <pre style={{whiteSpace:'pre-wrap',maxHeight:120,overflow:'auto'}}>{it.value}</pre>
                </div>
              </List.Item>)} />
          </Card>
        </Content>
      </Layout>
    </Layout>
  )
}
