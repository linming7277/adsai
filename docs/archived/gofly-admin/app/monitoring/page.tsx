"use client"
import React, { useEffect, useState } from 'react'
import { Layout, Menu, Typography, message, Card, Row, Col, Statistic } from 'antd'
import { DashboardOutlined, UserOutlined, DatabaseOutlined, AlertOutlined, SettingOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Title } = Typography

type AnyRecord = Record<string, any>

export default function MonitoringPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [slo, setSlo] = useState<AnyRecord>({})
  const [usage, setUsage] = useState<AnyRecord>({})

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [r1, r2] = await Promise.all([
          fetch('/api/go/api/v1/console/slo', { cache: 'no-store' }),
          fetch('/api/go/api/v1/console/api-usage?service=adscenter', { cache: 'no-store' })
        ])
        if (r1.status === 401 || r1.status === 403 || r2.status === 401 || r2.status === 403) { message.warning('请先登录'); location.assign('/login'); return }
        if (r1.ok) setSlo(await r1.json()); else message.error(`SLO加载失败: HTTP ${r1.status}`)
        if (r2.ok) setUsage(await r2.json()); else message.error(`API用量加载失败: HTTP ${r2.status}`)
      } catch (e:any) { message.error(`加载监控失败: ${e.message || e}`) } finally { setLoading(false) }
    }
    load()
  }, [])

  const sloP95 = (slo?.p95 || {}) as AnyRecord

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 48, margin: 12, color: '#fff' }}>AutoAds Console</div>
        <Menu theme="dark" defaultSelectedKeys={["monitoring"]} mode="inline" items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘', onClick:()=>location.assign('/') },
          { key: 'users', icon: <UserOutlined />, label: '用户与套餐', onClick:()=>location.assign('/users') },
          { key: 'billing', icon: <DatabaseOutlined />, label: 'Token与计费', onClick:()=>location.assign('/billing') },
          { key: 'alerts', icon: <AlertOutlined />, label: '系统告警', onClick:()=>location.assign('/alerts') },
          { key: 'configs', icon: <SettingOutlined />, label: '动态配置', onClick:()=>location.assign('/configs') },
          { key: 'audits', icon: <AlertOutlined />, label: '审计', onClick:()=>location.assign('/audits') },
          { key: 'apikeys', icon: <SettingOutlined />, label: 'API Keys', onClick:()=>location.assign('/apikeys') },
        ]} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', paddingInline: 16 }}>
          <Title level={4} style={{ margin: 0 }}>系统监控</Title>
        </Header>
        <Content style={{ margin: 16 }}>
          <Row gutter={[16,16]}>
            <Col xs={24} md={12} lg={6}><Card loading={loading} title="评估P95(秒)"><Statistic value={sloP95?.siterank || 0} precision={2} /></Card></Col>
            <Col xs={24} md={12} lg={6}><Card loading={loading} title="Pre-flight P95(ms)"><Statistic value={sloP95?.adscenterPreflight || 0} /></Card></Col>
            <Col xs={24} md={12} lg={6}><Card loading={loading} title="入队P95(ms)"><Statistic value={sloP95?.batchEnqueue || 0} /></Card></Col>
            <Col xs={24} md={12} lg={6}><Card loading={loading} title="错误率(%)"><Statistic value={((slo?.errorRate || 0)*100) as number} precision={2} /></Card></Col>
          </Row>
          <Card style={{ marginTop: 16 }} loading={loading} title="API用量(adscenter)"><pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(usage, null, 2)}</pre></Card>
          <Card style={{ marginTop: 16 }} loading={loading} title="SLO原始(JSON)"><pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(slo, null, 2)}</pre></Card>
        </Content>
      </Layout>
    </Layout>
  )
}
