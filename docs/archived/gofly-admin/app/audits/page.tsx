"use client"
import React, { useEffect, useState } from 'react'
import { Layout, Menu, Typography, message, Table, Card } from 'antd'
import { DashboardOutlined, UserOutlined, DatabaseOutlined, AlertOutlined, SettingOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Title } = Typography

type AnyRecord = Record<string, any>

export default function AuditsPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AnyRecord[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const r = await fetch('/api/go/api/v1/console/security/audits?limit=100', { cache: 'no-store' })
        if (r.status === 401 || r.status === 403) { message.warning('请先登录'); location.assign('/login'); return }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        const list = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : [])
        setItems(list)
      } catch (e:any) { message.error(`加载审计失败: ${e.message || e}`) } finally { setLoading(false) }
    }
    load()
  }, [])

  const columns = [
    { title: '时间', dataIndex: 'CreatedAt', key: 'ts', render: (_:any,row:AnyRecord)=> row?.CreatedAt || row?.createdAt || '-' },
    { title: '操作者', dataIndex: 'UserID', key: 'uid', render: (_:any,row:AnyRecord)=> row?.UserID || row?.userId || '-' },
    { title: '动作', dataIndex: 'Action', key: 'act', render: (_:any,row:AnyRecord)=> row?.Action || row?.action || '-' },
    { title: '对象', dataIndex: 'Target', key: 'tgt', render: (_:any,row:AnyRecord)=> row?.Target || row?.target || '-' },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 48, margin: 12, color: '#fff' }}>AutoAds Console</div>
        <Menu theme="dark" defaultSelectedKeys={["audits"]} mode="inline" items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘', onClick:()=>location.assign('/') },
          { key: 'users', icon: <UserOutlined />, label: '用户与套餐', onClick:()=>location.assign('/users') },
          { key: 'billing', icon: <DatabaseOutlined />, label: 'Token与计费', onClick:()=>location.assign('/billing') },
          { key: 'alerts', icon: <AlertOutlined />, label: '系统告警', onClick:()=>location.assign('/alerts') },
          { key: 'configs', icon: <SettingOutlined />, label: '动态配置', onClick:()=>location.assign('/configs') },
          { key: 'monitoring', icon: <DashboardOutlined />, label: '监控', onClick:()=>location.assign('/monitoring') },
          { key: 'apikeys', icon: <SettingOutlined />, label: 'API Keys', onClick:()=>location.assign('/apikeys') },
        ]} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', paddingInline: 16 }}>
          <Title level={4} style={{ margin: 0 }}>审计日志</Title>
        </Header>
        <Content style={{ margin: 16 }}>
          <Card>
            <Table rowKey={(_,i)=> String(i)} loading={loading} dataSource={items} columns={columns as any} pagination={{ pageSize: 20 }} />
          </Card>
        </Content>
      </Layout>
    </Layout>
  )
}
