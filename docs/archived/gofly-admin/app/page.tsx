"use client"
import React, { useEffect, useState } from 'react'
import { Layout, Menu, Card, Row, Col, Statistic, Typography, message } from 'antd'
import { DashboardOutlined, UserOutlined, SettingOutlined, AlertOutlined, DatabaseOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Title } = Typography

export default function DashboardPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({})

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const r = await fetch('/api/go/api/v1/console/stats', { cache: 'no-store' })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        setStats(j || {})
      } catch (e: any) {
        message.error(`加载统计失败: ${e.message || e}`)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 48, margin: 12, color: '#fff' }}>AdsAI Console</div>
        <Menu theme="dark" defaultSelectedKeys={["dashboard"]} mode="inline" items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
          { key: 'users', icon: <UserOutlined />, label: '用户与套餐', onClick:()=>location.assign('/users') },
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
          <Title level={4} style={{ margin: 0 }}>管理后台 · 仪表盘</Title>
        </Header>
        <Content style={{ margin: 16 }}>
          <Row gutter={[16,16]}>
            <Col xs={24} md={12} lg={6}><Card loading={loading} title="活跃用户"><Statistic value={stats?.activeUsers || 0} /></Card></Col>
            <Col xs={24} md={12} lg={6}><Card loading={loading} title="订阅收入(7日)"><Statistic prefix="$" value={stats?.revenue7d || 0} precision={2} /></Card></Col>
            <Col xs={24} md={12} lg={6}><Card loading={loading} title="评估P95(秒)"><Statistic value={stats?.slo?.siterankP95 || 0} precision={2} /></Card></Col>
            <Col xs={24} md={12} lg={6}><Card loading={loading} title="Preflight P95(ms)"><Statistic value={stats?.slo?.preflightP95 || 0} /></Card></Col>
          </Row>
          <Row gutter={[16,16]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}><Card loading={loading} title="未读通知">{stats?.notificationsUnread ?? '-'}</Card></Col>
            <Col xs={24} md={12}><Card loading={loading} title="批量任务成功率(%)"><Statistic value={(stats?.batch?.successRate || 0)*100} precision={2} /></Card></Col>
          </Row>
        </Content>
      </Layout>
    </Layout>
  )}
