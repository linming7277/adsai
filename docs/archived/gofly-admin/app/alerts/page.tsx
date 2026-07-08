"use client"
import React, { useEffect, useState } from 'react'
import { Layout, Menu, Typography, message, Table, Tag, Card, DatePicker, Select, Space, Empty, Alert, Button } from 'antd'
import dayjs from 'dayjs'
import { downloadCSV, toCSV } from '../../src/lib/csv'
import { DashboardOutlined, UserOutlined, DatabaseOutlined, AlertOutlined, SettingOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Title } = Typography

type AnyRecord = Record<string, any>

export default function AlertsPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AnyRecord[]>([])
  const [err, setErr] = useState('')
  const [severity, setSeverity] = useState<string | undefined>(undefined)
  const [range, setRange] = useState<[any, any] | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true); setErr('')
        const params = new URLSearchParams(); params.set('limit','200')
        if (severity) params.set('severity', severity)
        if (range && range[0] && range[1]) { params.set('from', range[0].toISOString()); params.set('to', range[1].toISOString()) }
        const r = await fetch('/api/go/api/v1/alerts?'+params.toString(), { cache: 'no-store' })
        if (r.status === 401 || r.status === 403) { message.warning('请先登录'); location.assign('/login'); return }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        let list = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : [])
        // 客户端兜底过滤
        if (severity) list = list.filter((x:any)=> String(x?.severity||'').toLowerCase() === severity)
        if (range && range[0] && range[1]) {
          const from = range[0].valueOf(), to = range[1].valueOf()
          list = list.filter((x:any)=>{
            const ts = new Date(x?.created_at || x?.createdAt || Date.now()).getTime()
            return ts>=from && ts<=to
          })
        }
        setItems(list)
      } catch (e:any) { setErr(e.message || String(e)) } finally { setLoading(false) }
    }
    load()
  }, [severity, range])

  const columns = [
    { title: '时间', dataIndex: 'created_at', key: 'ts', width: 200, render:(v:any)=> v || '-' },
    { title: '类型', dataIndex: 'type', key: 'type', width: 180 },
    { title: '严重性', dataIndex: 'severity', key: 'sev', width: 120, render:(v:any)=> v ? <Tag color={String(v).toLowerCase()==='high'?'red':String(v).toLowerCase()==='medium'?'orange':'blue'}>{String(v)}</Tag> : '-' },
    { title: '消息', dataIndex: 'message', key: 'msg', ellipsis: true },
  ]

  const exportCSV = () => {
    const rows = items.map((r:any)=> ({
      id: r.id ?? r.alert_id ?? '',
      type: r.type ?? '',
      severity: r.severity ?? '',
      message: r.message ?? '',
      createdAt: r.created_at ?? r.createdAt ?? ''
    }))
    downloadCSV('alerts.csv', toCSV(rows))
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 48, margin: 12, color: '#fff' }}>AdsAI Console</div>
        <Menu theme="dark" defaultSelectedKeys={["alerts"]} mode="inline" items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘', onClick:()=>location.assign('/') },
          { key: 'users', icon: <UserOutlined />, label: '用户与套餐', onClick:()=>location.assign('/users') },
          { key: 'billing', icon: <DatabaseOutlined />, label: 'Token与计费', onClick:()=>location.assign('/billing') },
          { key: 'alerts', icon: <AlertOutlined />, label: '系统告警' },
          { key: 'configs', icon: <SettingOutlined />, label: '动态配置', onClick:()=>location.assign('/configs') },
          { key: 'monitoring', icon: <DashboardOutlined />, label: '监控', onClick:()=>location.assign('/monitoring') },
          { key: 'audits', icon: <AlertOutlined />, label: '审计', onClick:()=>location.assign('/audits') },
          { key: 'apikeys', icon: <SettingOutlined />, label: 'API Keys', onClick:()=>location.assign('/apikeys') },
        ]} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', paddingInline: 16 }}>
          <Title level={4} style={{ margin: 0 }}>系统告警</Title>
        </Header>
        <Content style={{ margin: 16 }}>
          {err ? <Alert type="error" message="加载失败" description={err} showIcon style={{ marginBottom: 12 }} /> : null}
          <Card>
            <Space style={{ marginBottom: 12 }}>
              <Select allowClear placeholder='严重性' style={{ width: 160 }} onChange={(v)=>setSeverity(v)} options={[{value:'high',label:'HIGH'},{value:'medium',label:'MEDIUM'},{value:'low',label:'LOW'}]} />
              <DatePicker.RangePicker showTime onChange={(vals)=> setRange(vals as any)} disabledDate={(d)=> d>dayjs()} />
              <Button onClick={exportCSV}>导出CSV</Button>
            </Space>
            <Table rowKey={(r)=> r.id || r.alert_id || Math.random()} loading={loading} dataSource={items} columns={columns as any} pagination={{ pageSize: 20 }} locale={{ emptyText: <Empty description='暂无告警'/> }} />
          </Card>
        </Content>
      </Layout>
    </Layout>
  )
}
