"use client"
import React, { useState } from 'react'
import { Button, Card, Typography, Space, message } from 'antd'
import { GoogleOutlined, CheckCircleTwoTone } from '@ant-design/icons'
import { googleLoginAndPersistSession, signOut } from '../../src/lib/firebaseClient'

const { Title, Paragraph } = Typography

export default function LoginPage() {
  const [user, setUser] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const onGoogle = async () => {
    try {
      setBusy(true)
      const u = await googleLoginAndPersistSession()
      setUser(u)
      message.success('登录成功，已写入会话')
    } catch (e:any) {
      message.error(e?.message || '登录失败')
    } finally { setBusy(false) }
  }
  const onOut = async () => {
    await signOut()
    setUser(null)
    message.success('已退出')
  }
  return (
    <div style={{ minHeight: '100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Card style={{ width: 420 }}>
        <Title level={4}>管理员登录</Title>
        <Paragraph>使用 Google 登录，成功后可访问仪表盘与后台资源（需管理员权限）。</Paragraph>
        <Space direction="vertical" style={{ width:'100%' }}>
          <Button type="primary" icon={<GoogleOutlined />} block onClick={onGoogle} loading={busy}>使用 Google 登录</Button>
          <Button onClick={onOut} disabled={!user}>退出登录</Button>
          {user && <div style={{ color:'#52c41a' }}><CheckCircleTwoTone twoToneColor="#52c41a"/> 已登录：{user.email}</div>}
        </Space>
      </Card>
    </div>
  )
}
