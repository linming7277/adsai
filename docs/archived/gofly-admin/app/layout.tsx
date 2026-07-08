import 'antd/dist/reset.css'
import React from 'react'
import { ConfigProvider, App as AntApp, theme } from 'antd'

export const metadata = { title: 'AdsAI Console', description: 'Admin Console' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
          <AntApp>{children}</AntApp>
        </ConfigProvider>
      </body>
    </html>
  )
}

