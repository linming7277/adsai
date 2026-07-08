"use client"
import React, { useEffect, useState } from 'react'
import { Layout, Menu, Typography, message, Card, Table, Button, Modal, Form, Input, Space, Tag } from 'antd'
import { DashboardOutlined, UserOutlined, DatabaseOutlined, AlertOutlined, SettingOutlined, KeyOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

type AnyRecord = Record<string, any>

export default function ApiKeysPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AnyRecord[]>([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm()
  const [newToken, setNewToken] = useState<string>('')

  const load = async () => {
    try {
      setLoading(true)
      const r = await fetch('/api/go/api/v1/console/apikeys', { cache: 'no-store' })
      if (r.status === 401 || r.status === 403) { message.warning('请先登录'); location.assign('/login'); return }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      const list = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : [])
      setItems(list)
    } catch (e:any) { message.error(e.message || String(e)) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const onCreate = async () => {
    try {
      const vals = await form.validateFields()
      setCreating(true)
      const body = { name: vals.name, scopes: vals.scopes ? String(vals.scopes).split(',').map((s:string)=>s.trim()).filter(Boolean) : [], rpm: Number(vals.rpm||0) }
      const r = await fetch('/api/go/api/v1/console/apikeys', { method:'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error(`创建失败: HTTP ${r.status}`)
      const j = await r.json()
      setNewToken(j?.token || '')
      message.success('已创建 API Key')
      setOpen(false)
      form.resetFields()
      await load()
      if (j?.token) Modal.info({ title:'请复制你的 API Token（仅出现一次）', content: <pre style={{whiteSpace:'pre-wrap'}}>{j.token}</pre> })
    } catch (e:any) { if (e?.errorFields) return; message.error(e.message || String(e)) } finally { setCreating(false) }
  }

  const onRevoke = async (id:string) => {
    Modal.confirm({ title:'确认吊销此 Key?', onOk: async ()=>{
      try {
        const r = await fetch(`/api/go/api/v1/console/apikeys/${encodeURIComponent(id)}/revoke`, { method:'POST' })
        if (!r.ok) throw new Error(`吊销失败: HTTP ${r.status}`)
        message.success('已吊销')
        await load()
      } catch (e:any) { message.error(e.message || String(e)) }
    } })
  }

  const columns = [
    { title:'ID', dataIndex:'id', key:'id', width:200 },
    { title:'名称', dataIndex:'name', key:'name' },
    { title:'Scopes', dataIndex:'scopes', key:'scopes', render:(v:any)=> Array.isArray(v)? v.map((s:string)=><Tag key={s}>{s}</Tag>): '-' },
    { title:'RPM', dataIndex:'rpm', key:'rpm', width:100 },
    { title:'创建时间', dataIndex:'createdAt', key:'createdAt', width:200, render:(_:any,row:AnyRecord)=> row?.createdAt || '-' },
    { title:'状态', key:'status', width:120, render:(_:any,row:AnyRecord)=> row?.revokedAt ? <Tag color='red'>REVOKED</Tag> : <Tag color='green'>ACTIVE</Tag> },
    { title:'操作', key:'ops', width:120, render:(_:any,row:AnyRecord)=> <Button size='small' icon={<DeleteOutlined/>} danger disabled={!!row?.revokedAt} onClick={()=>onRevoke(row.id)}>吊销</Button> },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 48, margin: 12, color: '#fff' }}>AutoAds Console</div>
        <Menu theme="dark" defaultSelectedKeys={["apikeys"]} mode="inline" items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘', onClick:()=>location.assign('/') },
          { key: 'users', icon: <UserOutlined />, label: '用户与套餐', onClick:()=>location.assign('/users') },
          { key: 'billing', icon: <DatabaseOutlined />, label: 'Token与计费', onClick:()=>location.assign('/billing') },
          { key: 'alerts', icon: <AlertOutlined />, label: '系统告警', onClick:()=>location.assign('/alerts') },
          { key: 'configs', icon: <SettingOutlined />, label: '动态配置', onClick:()=>location.assign('/configs') },
          { key: 'apikeys', icon: <KeyOutlined />, label: 'API Keys' },
        ]} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', paddingInline: 16, display:'flex', alignItems:'center', gap:12 }}>
          <Title level={4} style={{ margin: 0, flex:1 }}>API Keys</Title>
          <Button type='primary' icon={<PlusOutlined/>} onClick={()=>setOpen(true)}>新建 Key</Button>
        </Header>
        <Content style={{ margin: 16 }}>
          <Card>
            <Table rowKey={(r)=> r.id || Math.random()} loading={loading} dataSource={items} columns={columns as any} pagination={{ pageSize: 20 }} />
          </Card>
        </Content>
      </Layout>
      <Modal title='新建 API Key' open={open} onCancel={()=>setOpen(false)} onOk={onCreate} confirmLoading={creating} okText='创建'>
        <Form form={form} layout='vertical'>
          <Form.Item label='名称' name='name' rules={[{ required:true, message:'请输入名称' }]}>
            <Input placeholder='例如: console-ci-key' />
          </Form.Item>
          <Form.Item label='Scopes (逗号分隔)' name='scopes'>
            <Input placeholder='read,write' />
          </Form.Item>
          <Form.Item label='RPM (每分钟限制)' name='rpm' initialValue={0}>
            <Input type='number' min={0} /></Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}

