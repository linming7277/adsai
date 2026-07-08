"use client"
import React, { useEffect, useState } from 'react'
import { Layout, Menu, Typography, message, Card, List, Tag } from 'antd'
import { DashboardOutlined, UserOutlined, DatabaseOutlined, AlertOutlined, SettingOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Title } = Typography

export default function PlansPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const r = await fetch('/ops/console/config/v1', { cache: 'no-store' })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        const catalog = j?.config?.plans?.catalog || {}
        const arr = Object.entries(catalog).map(([k,v]:any)=>({ id:k, ...(v||{}) }))
        setPlans(arr)
      } catch (e:any) { message.error(`加载套餐失败: ${e.message||e}`) } finally { setLoading(false) }
    }
    load()
  }, [])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 48, margin: 12, color: '#fff' }}>AutoAds Console</div>
        <Menu theme="dark" defaultSelectedKeys={["plans"]} mode="inline" items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘', onClick:()=>location.assign('/') },
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
          <Title level={4} style={{ margin: 0 }}>套餐（只读）</Title>
        </Header>
        <Content style={{ margin: 16 }}>
          <Card loading={loading}>
            <List dataSource={plans} renderItem={(it:any)=> (
              <List.Item>
                <div>
                  <div><strong>{it.id}</strong> {it.name ? `· ${it.name}`:''} {it.tier ? <Tag>{it.tier}</Tag> : null}</div>
                  <div style={{color:'#888'}}>价格: {it.price ?? '-'} · 功能: {Array.isArray(it.features)? it.features.join(', '): '-'}</div>
                </div>
              </List.Item>
            )} />
          </Card>
        </Content>
      </Layout>
    </Layout>
  )
}
