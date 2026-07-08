"use client"
import React, { useEffect, useState } from 'react'
import { Layout, Menu, Table, Typography, message, Tag, Card, Input, Select, Drawer, Descriptions, Empty, Alert, Space, Button } from 'antd'
import { downloadCSV, toCSV } from '../../src/lib/csv'
import { DashboardOutlined, UserOutlined, DatabaseOutlined, AlertOutlined, SettingOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Title } = Typography

type AnyRecord = Record<string, any>

export default function UsersPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AnyRecord[]>([])
  const [total, setTotal] = useState<number>(0)
  const [q, setQ] = useState('')
  const [role, setRole] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [err, setErr] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<AnyRecord | null>(null)
  const [detail, setDetail] = useState<{tokens?:AnyRecord, subscription?:AnyRecord}>({})

  const load = async (_page=page, _pageSize=pageSize, _q=q, _role=role) => {
    try {
      setErr('')
      setLoading(true)
      const params = new URLSearchParams()
      params.set('limit', String(_pageSize))
      params.set('offset', String((_page-1)*_pageSize))
      if (_q) params.set('q', _q)
      if (_role) params.set('role', _role)
      const r = await fetch(`/api/go/api/v1/console/users?${params.toString()}`, { cache: 'no-store' })
      if (r.status === 401 || r.status === 403) { message.warning('请先登录'); location.assign('/login'); return }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      const list = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : [])
      setItems(list)
      setTotal(Number(j?.total || list.length))
    } catch (e:any) {
      setErr(e.message || String(e))
    } finally { setLoading(false) }
  }

  useEffect(() => { load(1, pageSize) }, [])

  const onView = async (row: AnyRecord) => {
    setCurrent(row); setOpen(true); setDetail({})
    try {
      const [rt, rs] = await Promise.all([
        fetch(`/api/go/api/v1/console/users/${encodeURIComponent(row.id || row.userId || '')}/tokens`, { cache:'no-store' }),
        fetch(`/api/go/api/v1/console/users/${encodeURIComponent(row.id || row.userId || '')}/subscription`, { cache:'no-store' }),
      ])
      const tk = rt.ok ? await rt.json() : undefined
      const sub = rs.ok ? await rs.json() : undefined
      setDetail({ tokens: tk, subscription: sub })
    } catch {}
  }

  const columns = [
    { title: '用户ID', dataIndex: 'id', key: 'id', width: 220 },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 260, render: (v:any)=> v || '-' },
    { title: '角色', dataIndex: 'role', key: 'role', width: 120, render: (v:any)=> v ? <Tag>{String(v)}</Tag> : '-' },
    { title: '订阅', key: 'subscription', render: (_:any, row:AnyRecord)=> row?.subscription?.plan || row?.plan || '-' },
    { title: 'Token余额', key: 'tokens', render: (_:any, row:AnyRecord)=> row?.tokens?.balance ?? '-' },
    { title: '操作', key: 'ops', fixed:'right' as const, render: (_:any, row:AnyRecord)=> <a onClick={()=>onView(row)}>详情</a> },
  ]

  const exportCSV = () => {
    const rows = items.map(r => ({
      id: r.id ?? '',
      email: r.email ?? '',
      role: r.role ?? '',
      subscriptionPlan: r.subscription?.plan ?? r.plan ?? '',
      tokensBalance: (r.tokens && (r.tokens.balance ?? r.tokens?.remaining)) ?? ''
    }))
    downloadCSV('users.csv', toCSV(rows))
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 48, margin: 12, color: '#fff' }}>AutoAds Console</div>
        <Menu theme="dark" defaultSelectedKeys={["users"]} mode="inline" items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘', onClick:()=>location.assign('/') },
          { key: 'users', icon: <UserOutlined />, label: '用户与套餐' },
          { key: 'billing', icon: <DatabaseOutlined />, label: 'Token与计费', onClick:()=>location.assign('/billing') },
          { key: 'alerts', icon: <AlertOutlined />, label: '系统告警', onClick:()=>location.assign('/alerts') },
          { key: 'configs', icon: <SettingOutlined />, label: '动态配置', onClick:()=>location.assign('/configs') },
          { key: 'monitoring', icon: <DashboardOutlined />, label: '监控', onClick:()=>location.assign('/monitoring') },
          { key: 'audits', icon: <AlertOutlined />, label: '审计', onClick:()=>location.assign('/audits') },
          { key: 'apikeys', icon: <SettingOutlined />, label: 'API Keys', onClick:()=>location.assign('/apikeys') },
        ]} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', paddingInline: 16 }}>
          <Title level={4} style={{ margin: 0 }}>用户与套餐</Title>
        </Header>
        <Content style={{ margin: 16 }}>
          {err ? <Alert type="error" message="加载失败" description={err} showIcon style={{ marginBottom: 12 }} /> : null}
          <Card>
            <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center', justifyContent:'space-between' }}>
              <Space>
                <Input.Search allowClear placeholder="搜索邮箱/ID" onSearch={(v)=>{ setQ(v); setPage(1); load(1, pageSize, v, role) }} style={{ maxWidth: 300 }} />
                <Select allowClear placeholder="角色" style={{ width: 160 }} onChange={(v)=>{ setRole(v); setPage(1); load(1, pageSize, q, v) }} options={[{label:'ADMIN',value:'ADMIN'},{label:'USER',value:'USER'}]} />
              </Space>
              <Space>
                <Button onClick={()=>load()} loading={loading}>刷新</Button>
                <Button type='primary' onClick={exportCSV}>导出CSV</Button>
              </Space>
            </div>
            <Table
              rowKey={(r)=> r.id || r.email || Math.random()}
              loading={loading}
              dataSource={items}
              columns={columns as any}
              locale={{ emptyText: <Empty description="暂无用户" /> }}
              pagination={{ current: page, pageSize, total, showSizeChanger:true, onChange:(p,ps)=>{ setPage(p); setPageSize(ps); load(p, ps) } }} />
          </Card>
          <Drawer title="用户详情" width={520} open={open} onClose={()=>setOpen(false)} destroyOnClose>
            {!current ? <Empty /> : (
              <>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="用户ID">{current.id || '-'}</Descriptions.Item>
                  <Descriptions.Item label="邮箱">{current.email || '-'}</Descriptions.Item>
                  <Descriptions.Item label="角色">{current.role || '-'}</Descriptions.Item>
                </Descriptions>
                <Card title="订阅" size="small" style={{ marginTop: 12 }}>
                  <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(detail.subscription ?? {}, null, 2)}</pre>
                </Card>
                <Card title="Token" size="small" style={{ marginTop: 12 }}>
                  <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(detail.tokens ?? {}, null, 2)}</pre>
                </Card>
              </>
            )}
          </Drawer>
        </Content>
      </Layout>
    </Layout>
  )
}
