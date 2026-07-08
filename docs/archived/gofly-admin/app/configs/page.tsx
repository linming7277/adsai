"use client"
import React, { useEffect, useState } from 'react'
import { Layout, Menu, Typography, message, Card, Button } from 'antd'
import { DashboardOutlined, UserOutlined, DatabaseOutlined, AlertOutlined, SettingOutlined, ReloadOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Title } = Typography

type AnyRecord = Record<string, any>

export default function ConfigsPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [policy, setPolicy] = useState<AnyRecord | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const r = await fetch('/api/go/api/v1/console/limits/policy', { cache: 'no-store' })
      if (r.status === 401 || r.status === 403) { message.warning('请先登录'); location.assign('/login'); return }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setPolicy(j || {})
    } catch (e:any) { message.error(`加载配置失败: ${e.message || e}`) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 48, margin: 12, color: '#fff' }}>AdsAI Console</div>
        <Menu theme="dark" defaultSelectedKeys={["configs"]} mode="inline" items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘', onClick:()=>location.assign('/') },
          { key: 'users', icon: <UserOutlined />, label: '用户与套餐', onClick:()=>location.assign('/users') },
          { key: 'billing', icon: <DatabaseOutlined />, label: 'Token与计费', onClick:()=>location.assign('/billing') },
          { key: 'alerts', icon: <AlertOutlined />, label: '系统告警', onClick:()=>location.assign('/alerts') },
          { key: 'configs', icon: <SettingOutlined />, label: '动态配置' },
          { key: 'monitoring', icon: <DashboardOutlined />, label: '监控', onClick:()=>location.assign('/monitoring') },
          { key: 'audits', icon: <AlertOutlined />, label: '审计', onClick:()=>location.assign('/audits') },
          { key: 'apikeys', icon: <SettingOutlined />, label: 'API Keys', onClick:()=>location.assign('/apikeys') },
        ]} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', paddingInline: 16, display:'flex', alignItems:'center', gap:12 }}>
          <Title level={4} style={{ margin: 0, flex:1 }}>动态配置（只读）</Title>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Header>
        <Content style={{ margin: 16 }}>
          <Card loading={loading} title="限流/配额策略">
            <pre style={{ whiteSpace:'pre-wrap' }}>{policy ? JSON.stringify(policy, null, 2) : '暂无数据'}</pre>
          </Card>
        </Content>
      </Layout>
    </Layout>
  )
}
