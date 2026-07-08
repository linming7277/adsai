"use client"
import React, { useEffect, useState } from 'react'
import { Layout, Menu, Typography, message, Card, Row, Col, Statistic } from 'antd'
import { DashboardOutlined, UserOutlined, DatabaseOutlined, AlertOutlined, SettingOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Title } = Typography

type AnyRecord = Record<string, any>

export default function BillingPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AnyRecord>({})

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const r = await fetch('/api/go/api/v1/console/tokens/stats', { cache: 'no-store' })
        if (r.status === 401 || r.status === 403) { message.warning('请先登录'); location.assign('/login'); return }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        setStats(j || {})
      } catch (e:any) { message.error(`加载计费统计失败: ${e.message || e}`) } finally { setLoading(false) }
    }
    load()
  }, [])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 48, margin: 12, color: '#fff' }}>AutoAds Console</div>
        <Menu theme="dark" defaultSelectedKeys={["billing"]} mode="inline" items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘', onClick:()=>location.assign('/') },
          { key: 'users', icon: <UserOutlined />, label: '用户与套餐', onClick:()=>location.assign('/users') },
          { key: 'billing', icon: <DatabaseOutlined />, label: 'Token与计费' },
          { key: 'alerts', icon: <AlertOutlined />, label: '系统告警', onClick:()=>location.assign('/alerts') },
          { key: 'configs', icon: <SettingOutlined />, label: '动态配置', onClick:()=>location.assign('/configs') },
          { key: 'monitoring', icon: <DashboardOutlined />, label: '监控', onClick:()=>location.assign('/monitoring') },
          { key: 'audits', icon: <AlertOutlined />, label: '审计', onClick:()=>location.assign('/audits') },
          { key: 'apikeys', icon: <SettingOutlined />, label: 'API Keys', onClick:()=>location.assign('/apikeys') },
        ]} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', paddingInline: 16 }}>
          <Title level={4} style={{ margin: 0 }}>Token 与计费</Title>
        </Header>
        <Content style={{ margin: 16 }}>
          <Row gutter={[16,16]}>
            <Col xs={24} md={12} lg={6}><Card loading={loading} title="总预留"><Statistic value={stats?.reservedTotal ?? 0} /></Card></Col>
            <Col xs={24} md={12} lg={6}><Card loading={loading} title="总扣费"><Statistic value={stats?.committedTotal ?? 0} /></Card></Col>
            <Col xs={24} md={12} lg={6}><Card loading={loading} title="总释放"><Statistic value={stats?.releasedTotal ?? 0} /></Card></Col>
            <Col xs={24} md={12} lg={6}><Card loading={loading} title="活跃用户数"><Statistic value={stats?.activeUsers ?? 0} /></Card></Col>
          </Row>
          <Card style={{ marginTop: 16 }} loading={loading} title="原始统计(JSON)"><pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(stats, null, 2)}</pre></Card>
        </Content>
      </Layout>
    </Layout>
  )
}
